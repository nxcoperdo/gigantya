import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import socketService from '../services/socket.js';
import chatService from '../services/chat.js';

/**
 * ChatContext — estado de la conversación del cliente con un local.
 *
 * Maneja:
 *  - Identidad del cliente (nombre + teléfono persistidos en localStorage
 *    por local, para no pedirlos cada vez).
 *  - Conversación actual (id, mensajes, conexión al room por socket).
 *  - "Escribiendo..." del otro lado (typing).
 *  - Apertura/cierre del panel.
 *
 * Actualización de mensajes:
 *  - Polling cada 6s cuando el panel está abierto (más simple y robusto
 *    que socket para MVP — no necesitamos latencia sub-segundo en un chat
 *    de mercado, y el socket estaba fallando por auth de anon_identifier).
 *  - El socket sigue activo para typing/presence pero NO para mensajes.
 *
 * NO maneja el lado del vendedor — eso lo hace la página /admin/chat
 * con su propio estado (sigue el mismo socket y los mismos endpoints).
 *
 * El panel del cliente se monta en /restaurant/:id SOLO cuando el id es
 * el del local 4 (piloto). Ver `RestaurantDetailsPage.jsx` para el gate.
 */

const ChatContext = createContext(null);

const LS_IDENTITY_KEY = (restaurante_id) => `chat_identity_${restaurante_id}`;
const POLL_INTERVAL_MS = 6000;       // 6s — buen balance entre "casi real-time" y batería
const TYPING_DEBOUNCE_MS = 500;      // Evita flood de eventos typing en mobile (teclado)
const TYPING_TIMEOUT_MS = 4000;      // Cuánto dura el indicador después del último typing

export function ChatProvider({ children }) {
  // Estado de UI
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityNeeded, setIdentityNeeded] = useState(false);
  const [identity, setIdentity] = useState({ nombre: '', telefono: '' });
  const [restauranteIdActivo, setRestauranteIdActivo] = useState(null);

  // restauranteIdRef + identityRef + identifierServerRef: refs para leer
  // el estado actual desde callbacks async (sendMensaje, sendProductToChat)
  // sin depender de él y causar re-renders o stale closures.
  const restauranteIdRef = useRef(null);
  const identityRef = useRef({ nombre: '', telefono: '' });
  const identifierServerRef = useRef(null);
  useEffect(() => { restauranteIdRef.current = restauranteIdActivo; }, [restauranteIdActivo]);
  useEffect(() => { identityRef.current = identity; }, [identity]);

  // Estado de la conversación
  const [conversacion, setConversacion] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [sendingMensaje, setSendingMensaje] = useState(false);
  const [error, setError] = useState(null);

  // Presencia / typing
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Refs varios
  const typingTimeoutRef = useRef(null);
  const pollRef = useRef(null);
  const convRef = useRef(null);
  const convIdRef = useRef(null);            // para el polling
  const chatIdentidadRef = useRef(null);     // para el polling
  const typingDebounceRef = useRef(null);
  const lastTypingSentRef = useRef(false);
  convRef.current = conversacion;

  // ============ API pública ============

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  /**
   * Llamado por RestaurantDetailsPage al montar, con el id del local
   * actual. Carga la identidad del localStorage y, si existe, abre la
   * conversación en background (no fuerza abrir el panel).
   */
  const initForRestaurante = useCallback(async (restaurante_id) => {
    setRestauranteIdActivo(restaurante_id);
    const raw = localStorage.getItem(LS_IDENTITY_KEY(restaurante_id));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setIdentity({ nombre: parsed.nombre || '', telefono: parsed.telefono || '' });
        await ensureConvInternal(restaurante_id, parsed.nombre, parsed.telefono);
        return;
      } catch {
        localStorage.removeItem(LS_IDENTITY_KEY(restaurante_id));
      }
    }
    setIdentityNeeded(true);
  }, []);

  /**
   * Llamado desde ChatIdentityModal cuando el usuario llena el form.
   * Persiste en localStorage y abre la conversación.
   */
  const saveIdentity = useCallback(async ({ nombre, telefono }) => {
    const trimmed = { nombre: nombre.trim(), telefono: telefono.trim() };
    if (!trimmed.nombre || !trimmed.telefono) {
      throw new Error('Nombre y teléfono son obligatorios');
    }
    if (restauranteIdActivo == null) {
      throw new Error('No hay local activo');
    }
    localStorage.setItem(LS_IDENTITY_KEY(restauranteIdActivo), JSON.stringify(trimmed));
    setIdentity(trimmed);
    setIdentityNeeded(false);
    setPanelOpen(true);
    await ensureConvInternal(restauranteIdActivo, trimmed.nombre, trimmed.telefono);
  }, [restauranteIdActivo]);

  /**
   * Llamado por ChatPanel al abrir o por un usuario anónimo que quiere
   * mandar un mensaje antes de tener identidad. Si no hay identidad,
   * fuerza el modal.
   */
  const openPanelGuard = useCallback(() => {
    if (!identity.nombre || !identity.telefono) {
      setIdentityNeeded(true);
      return;
    }
    setPanelOpen(true);
  }, [identity]);

  /**
   * Llamado por ProductQuickSend cuando el cliente hace "Enviar al chat"
   * en un producto del catálogo.
   */
  const sendProductToChat = useCallback(async (producto) => {
    if (!restauranteIdActivo) return;
    let conv = convRef.current;
    if (!conv) {
      if (!identity.nombre || !identity.telefono) {
        setIdentityNeeded(true);
        return;
      }
      conv = await ensureConvInternal(restauranteIdActivo, identity.nombre, identity.telefono);
    }
    setPanelOpen(true);
    await sendMensajeInternal(conv.id, {
      contenido: `Quiero ${producto.nombre}`,
      adjuntos: { producto_id: producto.id, nombre: producto.nombre, precio: producto.precio },
    });
  }, [restauranteIdActivo, identity]);

  const sendMensaje = useCallback(async (contenido) => {
    if (!contenido || !contenido.trim()) return;
    const conv = convRef.current;
    if (!conv) return;
    await sendMensajeInternal(conv.id, { contenido: contenido.trim(), adjuntos: null });
  }, []);

  /**
   * Sube una imagen al chat. `file` es un File del input; `caption` es
   * texto opcional. Valida tamaño/tipo del lado del cliente antes de subir
   * (el server igual re-valida). Optimista: appendea el mensaje devuelto.
   */
  const sendImagen = useCallback(async (file, caption) => {
    const conv = convRef.current;
    if (!conv || !file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La imagen supera el tamaño máximo (8MB)');
      return;
    }
    setSendingMensaje(true);
    setError(null);
    try {
      const identidad = identityRef.current;
      const chatIdentidad = {
        nombre: identidad.nombre,
        telefono: identidad.telefono,
        clienteIdentificadorServer: identifierServerRef.current,
      };
      const msg = await chatService.sendImagen(conv.id, file, caption, chatIdentidad);
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo enviar la imagen');
      throw err;
    } finally {
      setSendingMensaje(false);
    }
  }, []);

  // ============ Internals ============

  async function ensureConvInternal(restaurante_id, nombre, telefono) {
    setLoadingConv(true);
    setError(null);
    try {
      const conv = await chatService.ensureConversation({
        restaurante_id,
        cliente_nombre: nombre,
        cliente_telefono: telefono,
      });
      setConversacion(conv);
      const chatIdentidad = {
        nombre,
        telefono,
        clienteIdentificadorServer: conv.cliente_identificador,
      };
      identifierServerRef.current = conv.cliente_identificador;
      convIdRef.current = conv.id;
      chatIdentidadRef.current = chatIdentidad;

      // Cargar historial
      const hist = await chatService.listMensajes(conv.id, chatIdentidad);
      setMensajes(hist.mensajes || []);

      // Unirse al room del socket (solo para typing/presence, no para mensajes)
      const anonIdentifier = conv.cliente_identificador.startsWith('anon:') ? conv.cliente_identificador : null;
      try {
        const ack = await socketService.joinConversation(conv.id, anonIdentifier);
        setOnlineCount(ack.online || 0);
      } catch (e) {
        console.warn('[chat] joinConversation falló (no bloquea el chat):', e.message);
      }

      // Marcar como leído
      try { await chatService.markRead(conv.id, chatIdentidad); } catch {}
      return conv;
    } catch (err) {
      setError(err.message || 'No se pudo abrir el chat');
      throw err;
    } finally {
      setLoadingConv(false);
    }
  }

  async function sendMensajeInternal(conv_id, payload) {
    setSendingMensaje(true);
    try {
      const identidad = identityRef.current;
      const chatIdentidad = {
        nombre: identidad.nombre,
        telefono: identidad.telefono,
        clienteIdentificadorServer: identifierServerRef.current,
      };
      const msg = await chatService.sendMensaje(conv_id, payload, chatIdentidad);
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje');
      throw err;
    } finally {
      setSendingMensaje(false);
    }
  }

  /**
   * Refresca los mensajes del servidor. Llamado por el polling y al
   * abrir el panel. Mergea por id, no reemplaza — los mensajes que el
   * cliente ya tiene (los suyos propios) no se duplican.
   */
  const refrescarMensajes = useCallback(async () => {
    const convId = convIdRef.current;
    const chatIdentidad = chatIdentidadRef.current;
    if (!convId || !chatIdentidad) return;
    try {
      const hist = await chatService.listMensajes(convId, chatIdentidad);
      const nuevos = hist.mensajes || [];
      setMensajes((prev) => {
        if (prev.length === nuevos.length && prev.every((m, i) => m.id === nuevos[i].id)) {
          return prev; // sin cambios — no re-render
        }
        // Merge: si hay mensajes nuevos, los appendeamos; si los del server
        // tienen contenido más completo (ej: edited), actualizamos.
        const prevById = new Map(prev.map((m) => [m.id, m]));
        const merged = nuevos.map((m) => prevById.get(m.id) || m);
        return merged;
      });
    } catch (err) {
      console.warn('[chat] polling falló:', err.message);
    }
  }, []);

  /**
   * Notifica al server que el cliente está escribiendo. Debounce en mobile
   * (el socket puede colapsar si mandamos 1 por keystroke). Solo emite
   * el cambio de estado (true→false o false→true), no cada keystroke.
   */
  const sendTypingDebounced = useCallback((typing) => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      const conv = convRef.current;
      if (conv && typing !== lastTypingSentRef.current) {
        socketService.sendTyping(conv.id, typing);
        lastTypingSentRef.current = typing;
      }
    }, TYPING_DEBOUNCE_MS);
  }, []);

  // ============ Polling ============

  // Polling SOLO cuando el panel está abierto Y hay conversación.
  // Esto evita consumir batería cuando el cliente no está mirando el chat.
  useEffect(() => {
    if (!panelOpen || !convIdRef.current) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    // Refrescar inmediatamente al abrir, después cada POLL_INTERVAL_MS.
    refrescarMensajes();
    pollRef.current = setInterval(refrescarMensajes, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [panelOpen, refrescarMensajes]);

  // ============ Listeners de socket (typing/presence) ============

  useEffect(() => {
    const handleTyping = (payload) => {
      if (!payload) return;
      const conv = convRef.current;
      if (!conv || payload.conversacion_id !== conv.id) return;
      if (payload.typing) {
        setOtroEscribiendo(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtroEscribiendo(false), TYPING_TIMEOUT_MS);
      } else {
        setOtroEscribiendo(false);
      }
    };
    const handlePresence = (payload) => {
      if (!payload) return;
      const conv = convRef.current;
      if (!conv || payload.conversacion_id !== conv.id) return;
      setOnlineCount(payload.online || 0);
    };

    socketService.onChatTyping(handleTyping);
    socketService.onChatPresence(handlePresence);

    return () => {
      socketService.offChatTyping(handleTyping);
      socketService.offChatPresence(handlePresence);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

  // Cleanup: cuando el local activo cambia, dejamos el room anterior
  useEffect(() => {
    return () => {
      if (convRef.current) {
        socketService.leaveConversation(convRef.current.id);
      }
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [restauranteIdActivo]);

  // Memo del value para evitar re-renders innecesarios de consumers.
  // Sin esto, el value se recrea en cada render y todos los useChat()
  // consumers re-renderean. En mobile con React Native Web esto es
  // un asesino de performance.
  const value = useMemo(() => ({
    panelOpen,
    identityNeeded,
    openPanel: openPanelGuard,
    closePanel,
    setIdentityNeeded,
    identity,
    saveIdentity,
    conversacion,
    mensajes,
    loadingConv,
    sendingMensaje,
    error,
    onlineCount,
    otroEscribiendo,
    initForRestaurante,
    sendMensaje,
    sendImagen,
    sendProductToChat,
    sendTypingDebounced,
    refrescarMensajes,
  }), [panelOpen, identityNeeded, openPanelGuard, closePanel, identity, saveIdentity, conversacion, mensajes, loadingConv, sendingMensaje, error, onlineCount, otroEscribiendo, initForRestaurante, sendMensaje, sendImagen, sendProductToChat, sendTypingDebounced, refrescarMensajes]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat debe usarse dentro de <ChatProvider>');
  }
  return ctx;
}
