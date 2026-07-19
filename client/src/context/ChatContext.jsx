import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
 * NO maneja el lado del vendedor — eso lo hace la página /admin/chat
 * con su propio estado (sigue el mismo socket y los mismos endpoints).
 *
 * El panel del cliente se monta en /restaurant/:id SOLO cuando el id es
 * el del local 4 (piloto). Ver `RestaurantDetailsPage.jsx` para el gate.
 */

const ChatContext = createContext(null);

const LS_IDENTITY_KEY = (restaurante_id) => `chat_identity_${restaurante_id}`;

export function ChatProvider({ children }) {
  // Estado de UI
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityNeeded, setIdentityNeeded] = useState(false); // mostrar modal
  const [identity, setIdentity] = useState({ nombre: '', telefono: '' });
  const [restauranteIdActivo, setRestauranteIdActivo] = useState(null);
  // restauranteIdRef + identityRef + identifierServerRef: refs para leer
  // el estado actual desde callbacks async (sendMensaje, sendProductToChat)
  // sin depender de él y causar re-renders o stale closures.
  // `identifierServerRef` guarda el `cliente_identificador` que devolvió
  // el server (autoritativo), necesario para que sendMensaje pueda mandar
  // el `anon_identifier` correcto en cada request.
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

  // Refs para no recrear listeners en cada render
  const typingTimeoutRef = useRef(null);
  const convRef = useRef(null);
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
        // Abrir la conversación silenciosamente.
        await ensureConvInternal(restaurante_id, parsed.nombre, parsed.telefono);
        return;
      } catch {
        // localStorage corrupto, lo limpiamos
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
   * en un producto del catálogo. Garantiza que la conversación existe
   * y luego manda el mensaje con adjuntos.
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
      // La identidad para autenticarnos como anónimo en los endpoints REST
      // y en el socket SIEMPRE viene del server (cliente_identificador ya
      // normalizado). Si la recalculamos localmente con el `telefono`
      // que tipeó el cliente, podemos tener mismatch de formato (con/sin
      // '+', espacios, etc.) y el server rechaza la autorización con
      // "No autorizado para unirse a esta conversación".
      const chatIdentidad = {
        nombre,
        telefono,
        clienteIdentificadorServer: conv.cliente_identificador,
      };
      // Guardar el identificador del server en un ref para que
      // sendMensaje (que se llama después sin acceso a `conversacion`
      // actual) pueda mandar el anon_identifier correcto.
      identifierServerRef.current = conv.cliente_identificador;
      // Cargar historial
      const hist = await chatService.listMensajes(conv.id, chatIdentidad);
      setMensajes(hist.mensajes || []);
      // Unirse al room
      const anonIdentifier = conv.cliente_identificador.startsWith('anon:') ? conv.cliente_identificador : null;
      try {
        const ack = await socketService.joinConversation(conv.id, anonIdentifier);
        setOnlineCount(ack.online || 0);
      } catch (e) {
        console.warn('[chat] joinConversation falló:', e.message);
      }
      // Marcar como leído (los del vendedor que ya estaban)
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
      // El socket va a recibirlo también (broadcast del server) y lo
      // agrega via onNewChatMessage. Para evitar duplicados, solo
      // agregamos si el id no está ya.
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje');
      throw err;
    } finally {
      setSendingMensaje(false);
    }
  }

  // ============ Listeners de socket (mount una sola vez) ============

  useEffect(() => {
    const handleNew = (payload) => {
      if (!payload || !payload.mensaje) return;
      const conv = convRef.current;
      if (!conv || payload.conversacion_id !== conv.id) return;
      setMensajes((prev) => {
        if (prev.some((m) => m.id === payload.mensaje.id)) return prev;
        return [...prev, payload.mensaje];
      });
    };
    const handleTyping = (payload) => {
      if (!payload) return;
      const conv = convRef.current;
      if (!conv || payload.conversacion_id !== conv.id) return;
      // Si typing=true, mostrar el indicador; si false, ocultar.
      if (payload.typing) {
        setOtroEscribiendo(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtroEscribiendo(false), 3000);
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

    socketService.onNewChatMessage(handleNew);
    socketService.onChatTyping(handleTyping);
    socketService.onChatPresence(handlePresence);

    return () => {
      socketService.offNewChatMessage(handleNew);
      socketService.offChatTyping(handleTyping);
      socketService.offChatPresence(handlePresence);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Cleanup: cuando el local activo cambia, dejamos el room anterior
  useEffect(() => {
    return () => {
      if (convRef.current) {
        socketService.leaveConversation(convRef.current.id);
      }
    };
  }, [restauranteIdActivo]);

  const value = {
    // UI
    panelOpen,
    identityNeeded,
    openPanel: openPanelGuard,
    closePanel,
    setIdentityNeeded,
    // identidad
    identity,
    saveIdentity,
    // conversación
    conversacion,
    mensajes,
    loadingConv,
    sendingMensaje,
    error,
    onlineCount,
    otroEscribiendo,
    // acciones
    initForRestaurante,
    sendMensaje,
    sendProductToChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat debe usarse dentro de <ChatProvider>');
  }
  return ctx;
}
