import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import chatService from '../../services/chat.js';
import socketService from '../../services/socket.js';
import { MessageCircle, Send, ArrowLeft, ShoppingCart, Search, RefreshCw, Loader2, ImagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import ArmarPedidoModal from './ArmarPedidoModal.jsx';
import { getImageUrl } from '../../utils/imageHelper.js';

// Placeholder que usa el backend para una foto sin caption; la UI lo oculta.
const IMG_PLACEHOLDER = '📷 Foto';

/**
 * Página del chat del lado del VENDEDOR.
 *
 * Ruta: /dashboard/chat
 *
 * Layout:
 *  - Mobile-first: tabs entre "Conversaciones" y el chat activo.
 *  - Desktop: 2 columnas fijas (lista + chat).
 *
 * Actualización de datos:
 *  - Polling cada 6s (consistente con el chat del cliente).
 *  - Polling de la LISTA siempre activo (para ver no_leidos en tiempo
 *    casi-real aunque no haya socket). Se cancela en unmount.
 *  - Polling de MENSAJES solo cuando hay una conversación activa.
 *  - Botón de "refrescar" manual con spinner, en el header de la
 *    conversación activa (para forzar sync sin esperar 6s).
 *  - Socket queda activo para typing/presence + para empujar mensajes
 *    instantáneos cuando llegan (mientras el socket funcione); el polling
 *    es la red de seguridad si el socket falla.
 */

const POLL_INTERVAL_MS = 6000;

function formatearHora(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function formatearHoraCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const iniciales = (nombre) => {
  if (!nombre) return '?';
  return nombre.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
};

const BurbujaMensaje = memo(function BurbujaMensaje({ m }) {
  const esMio = m.emisor_tipo === 'vendedor';
  const esSistema = m.emisor_tipo === 'sistema';
  if (esSistema) {
    return (
      <div className="text-center text-xs text-[color:var(--text-muted)] py-1 px-2">
        {m.contenido}
      </div>
    );
  }
  const adj = (m.adjuntos_json && typeof m.adjuntos_json === 'object') ? m.adjuntos_json : null;
  const esImagen = adj?.tipo === 'imagen' && adj.url;
  const tieneProducto = adj?.nombre && !esImagen;
  const mostrarTexto = m.contenido && !(esImagen && m.contenido === IMG_PLACEHOLDER);
  return (
    <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[80%] rounded-2xl text-sm shadow-sm overflow-hidden',
          esImagen ? 'p-1' : 'px-3 py-2',
          esMio
            ? 'bg-[var(--color-primary)] text-white rounded-br-md'
            : 'bg-white dark:bg-gray-700 text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] rounded-bl-md',
        ].join(' ')}
      >
        {tieneProducto && (
          <div className="text-xs opacity-80 italic mb-0.5 px-1">📦 {adj.nombre}</div>
        )}
        {esImagen && (
          <a
            href={getImageUrl(adj.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            aria-label="Ver imagen completa"
          >
            <img
              src={getImageUrl(adj.url)}
              alt="Imagen del chat"
              loading="lazy"
              decoding="async"
              className="rounded-xl max-h-72 w-full object-cover"
            />
          </a>
        )}
        {mostrarTexto && (
          <div className={`whitespace-pre-wrap break-words ${esImagen ? 'px-2 pt-1.5' : ''}`}>
            {m.contenido}
          </div>
        )}
        <div className={`text-[10px] opacity-60 mt-0.5 text-right ${esImagen ? 'px-2 pb-0.5' : ''}`}>
          {formatearHoraCorta(m.created_at)}
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.m === next.m);

const ConversacionItem = memo(function ConversacionItem({ c, activa, onClick }) {
  return (
    <button
      onClick={() => onClick(c)}
      className={[
        'w-full text-left px-3 py-3 flex gap-3 hover:bg-[color:var(--bg-subtle)] border-b border-[color:var(--border-subtle)] transition-colors',
        activa ? 'bg-[color:var(--bg-subtle)]' : '',
      ].join(' ')}
    >
      <div className="relative w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {iniciales(c.cliente_nombre)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm text-[color:var(--text-primary)] truncate">
            {c.cliente_nombre || `Cliente #${c.id}`}
          </span>
          <span className="text-[10px] text-[color:var(--text-muted)] flex-shrink-0">
            {formatearHora(c.ultimo_mensaje_en || c.updated_at)}
          </span>
        </div>
        <div className="text-xs text-[color:var(--text-muted)] truncate">
          {c.ultimo_mensaje_preview || <em>Sin mensajes</em>}
        </div>
      </div>
      {Number(c.no_leidos) > 0 && (
        <span
          className="flex-shrink-0 self-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: '#ef4444' }}
        >
          {c.no_leidos > 9 ? '9+' : c.no_leidos}
        </span>
      )}
    </button>
  );
});

export default function ChatAdminPage() {
  const { user } = useAuth();
  const [conversaciones, setConversaciones] = useState([]);
  const [convActivaId, setConvActivaId] = useState(null);
  const [convActiva, setConvActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingChat, setRefreshingChat] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const [online, setOnline] = useState(false);
  const [noLeidosTotal, setNoLeidosTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [armarPedidoOpen, setArmarPedidoOpen] = useState(false);
  const [mobileMostrarChat, setMobileMostrarChat] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const convActivaIdRef = useRef(null);
  const convActivaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const prevMensajesLenRef = useRef(0);
  const listPollRef = useRef(null);
  const chatPollRef = useRef(null);
  convActivaIdRef.current = convActivaId;
  convActivaRef.current = convActiva;

  // ============ Refrescar lista de conversaciones ============

  const refrescarLista = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await chatService.adminListConversaciones({ estado: 'todas' });
      setConversaciones((prev) => {
        const nuevos = data.conversaciones || [];
        // Solo actualizar si hay cambios (evita re-renders innecesarios)
        if (prev.length === nuevos.length && prev.every((p, i) => p.id === nuevos[i].id && p.ultimo_mensaje_en === nuevos[i].ultimo_mensaje_en && p.no_leidos === nuevos[i].no_leidos)) {
          return prev;
        }
        return nuevos;
      });
      setNoLeidosTotal(data.no_leidos_total || 0);
    } catch (err) {
      console.warn('[chat-admin] refresh lista falló:', err.message);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  // Carga inicial + polling cada 6s
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const data = await chatService.adminListConversaciones({ estado: 'todas' });
        if (cancelled) return;
        setConversaciones(data.conversaciones || []);
        setNoLeidosTotal(data.no_leidos_total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitial();
    // Polling cada 6s (silencioso: sin spinner para no parpadear la UI)
    listPollRef.current = setInterval(() => refrescarLista(true), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (listPollRef.current) clearInterval(listPollRef.current);
    };
  }, [refrescarLista]);

  // ============ Refrescar mensajes del chat activo ============

  const refrescarChat = useCallback(async (silent = false) => {
    const convId = convActivaIdRef.current;
    if (!convId) return;
    if (!silent) setRefreshingChat(true);
    try {
      const data = await chatService.listMensajes(convId);
      const nuevos = data.mensajes || [];
      setMensajes((prev) => {
        if (prev.length === nuevos.length && prev.every((p, i) => p.id === nuevos[i].id)) {
          return prev;
        }
        const byId = new Map(prev.map((m) => [m.id, m]));
        return nuevos.map((m) => byId.get(m.id) || m);
      });
      // Re-leer la conv activa por si cambió el estado (ej: convertida)
      const all = await chatService.adminListConversaciones({ estado: 'todas' });
      const updated = (all.conversaciones || []).find((c) => c.id === convId);
      if (updated && convActivaRef.current && updated.estado !== convActivaRef.current.estado) {
        setConvActiva((c) => c ? { ...c, estado: updated.estado, pedido_id: updated.pedido_id } : c);
      }
    } catch (err) {
      console.warn('[chat-admin] refresh chat falló:', err.message);
    } finally {
      if (!silent) setRefreshingChat(false);
    }
  }, []);

  // Polling del chat activo solo cuando hay conv abierta
  useEffect(() => {
    if (!convActivaId) {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
      return;
    }
    chatPollRef.current = setInterval(() => refrescarChat(true), POLL_INTERVAL_MS);
    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
  }, [convActivaId, refrescarChat]);

  // ============ Listeners de socket (typing/presence + push instantáneo) ============

  useEffect(() => {
    const handleNew = (payload) => {
      if (!payload || !payload.mensaje) return;
      setConversaciones((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversacion_id);
        if (idx < 0) return prev;
        const updated = {
          ...prev[idx],
          ultimo_mensaje_en: payload.mensaje.created_at,
          ultimo_mensaje_preview: payload.mensaje.contenido,
          no_leidos: payload.mensaje.emisor_tipo === 'cliente'
            ? (Number(prev[idx].no_leidos) || 0) + (convActivaIdRef.current === payload.conversacion_id ? 0 : 1)
            : prev[idx].no_leidos,
        };
        const sinEste = prev.filter((_, i) => i !== idx);
        return [updated, ...sinEste];
      });
      if (convActivaIdRef.current === payload.conversacion_id) {
        setMensajes((prev) => prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]);
      }
    };
    const handleTyping = (payload) => {
      if (!payload || payload.conversacion_id !== convActivaIdRef.current) return;
      setOtroEscribiendo(!!payload.typing);
    };
    const handlePresence = (payload) => {
      if (!payload || payload.conversacion_id !== convActivaIdRef.current) return;
      setOnline(payload.online > 1);
    };

    socketService.onNewChatMessage(handleNew);
    socketService.onChatTyping(handleTyping);
    socketService.onChatPresence(handlePresence);

    return () => {
      socketService.offNewChatMessage(handleNew);
      socketService.offChatTyping(handleTyping);
      socketService.offChatPresence(handlePresence);
    };
  }, []);

  // ============ Abrir conversación ============

  const abrirConversacion = useCallback(async (conv) => {
    setConvActivaId(conv.id);
    setConvActiva(conv);
    setMobileMostrarChat(true);
    setMensajes([]);
    setOtroEscribiendo(false);
    stickToBottomRef.current = true;
    try {
      const ack = await socketService.joinConversation(conv.id);
      setOnline(ack.online > 1);
    } catch (e) {
      console.warn('[chat] joinConversation admin:', e.message);
    }
    // Cargar historial inmediato (sin esperar al primer poll)
    try {
      const data = await chatService.listMensajes(conv.id);
      setMensajes(data.mensajes || []);
      await chatService.markRead(conv.id);
      setConversaciones((prev) => prev.map((c) => c.id === conv.id ? { ...c, no_leidos: 0 } : c));
      setNoLeidosTotal((n) => Math.max(0, n - (conv.no_leidos || 0)));
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // ============ Enviar mensaje ============

  const enviarMensaje = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending || !convActivaId) return;
    const texto = input;
    setInput('');
    setSending(true);
    stickToBottomRef.current = true;
    try {
      const msg = await chatService.sendMensaje(convActivaId, { contenido: texto });
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setInput(texto);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  // ============ Enviar imagen ============

  const pickImage = () => fileInputRef.current?.click();

  const enviarImagen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permitir re-elegir la misma foto
    if (!file || !convActivaId) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La imagen supera el tamaño máximo (8MB)');
      return;
    }
    const caption = input;
    setInput('');
    setSending(true);
    stickToBottomRef.current = true;
    try {
      const msg = await chatService.sendImagen(convActivaId, file, caption);
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo enviar la imagen');
      setInput(caption);
    } finally {
      setSending(false);
    }
  };

  // Typing (sin debounce en admin — es menos frecuente que el cliente)
  useEffect(() => {
    if (convActivaId) {
      socketService.sendTyping(convActivaId, input.trim().length > 0);
    }
  }, [input, convActivaId]);

  // ============ Auto-scroll inteligente ============

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < 80;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const newLen = mensajes.length;
    const grew = newLen > prevMensajesLenRef.current;
    prevMensajesLenRef.current = newLen;
    if (grew && stickToBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [mensajes, otroEscribiendo]);

  // ============ Handlers UI ============

  const conversacionesFiltradas = useMemo(() => {
    if (!search.trim()) return conversaciones;
    const q = search.toLowerCase();
    return conversaciones.filter((c) =>
      (c.cliente_nombre || '').toLowerCase().includes(q) ||
      (c.cliente_telefono || '').toLowerCase().includes(q)
    );
  }, [conversaciones, search]);

  const volverALista = useCallback(() => {
    setMobileMostrarChat(false);
    if (convActivaId) {
      socketService.leaveConversation(convActivaId);
      setConvActivaId(null);
      setConvActiva(null);
    }
  }, [convActivaId]);

  // Handlers memoizados para los items de conversación
  const onClickConv = useCallback((c) => abrirConversacion(c), [abrirConversacion]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[color:var(--bg-subtle)]">
      {/* Header global */}
      <div className="bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] px-4 py-3 flex items-center gap-3">
        {mobileMostrarChat && (
          <button
            onClick={volverALista}
            className="md:hidden p-1 -ml-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            aria-label="Volver a la lista"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <MessageCircle size={20} className="text-[var(--color-primary)]" />
        <h1 className="font-bold text-lg text-[color:var(--text-primary)]">Chat con clientes</h1>
        {noLeidosTotal > 0 && (
          <span
            className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: '#ef4444' }}
          >
            {noLeidosTotal}
          </span>
        )}
        <Link to="/dashboard" className="ml-auto text-sm text-[var(--color-primary)] hover:underline">
          Volver al panel
        </Link>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de conversaciones */}
        <aside
          className={[
            'w-full md:w-80 md:border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] flex flex-col overflow-hidden',
            mobileMostrarChat ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >
          <div className="p-3 border-b border-[color:var(--border-subtle)] flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full pl-9 pr-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]"
              />
            </div>
            <button
              onClick={() => refrescarLista(false)}
              disabled={refreshing}
              className="px-2.5 border border-[color:var(--border-subtle)] rounded-md bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
              aria-label="Refrescar lista"
              title="Refrescar lista"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-sm text-[color:var(--text-muted)]">Cargando…</div>
            )}
            {error && (
              <div className="p-4 text-center text-sm text-red-600">{error}</div>
            )}
            {!loading && conversacionesFiltradas.length === 0 && (
              <div className="p-8 text-center text-sm text-[color:var(--text-muted)]">
                {search ? 'Sin resultados' : 'No hay conversaciones todavía.'}
              </div>
            )}
            {conversacionesFiltradas.map((c) => (
              <ConversacionItem
                key={c.id}
                c={c}
                activa={convActivaId === c.id}
                onClick={onClickConv}
              />
            ))}
          </div>
        </aside>

        {/* Panel de chat activo */}
        <section
          className={[
            'flex-1 flex flex-col bg-[color:var(--bg-subtle)] overflow-hidden',
            mobileMostrarChat ? 'flex' : 'hidden md:flex',
          ].join(' ')}
        >
          {!convActivaId && (
            <div className="flex-1 flex items-center justify-center text-[color:var(--text-muted)]">
              <div className="text-center px-4">
                <MessageCircle size={48} className="mx-auto opacity-30 mb-3" />
                <p className="text-sm">Elige una conversación para empezar</p>
              </div>
            </div>
          )}

          {convActivaId && (
            <>
              {/* Header del chat activo */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {iniciales(convActiva?.cliente_nombre)}
                  {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[color:var(--text-primary)] truncate">
                    {convActiva?.cliente_nombre || 'Cliente'}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] truncate">
                    {convActiva?.cliente_telefono || '—'}
                    {convActiva?.estado === 'convertida' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">
                        Pedido #{convActiva?.pedido_id} creado
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => refrescarChat(false)}
                  disabled={refreshingChat}
                  className="p-2 border border-[color:var(--border-subtle)] rounded-md bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50 flex-shrink-0"
                  aria-label="Refrescar mensajes"
                  title="Refrescar mensajes"
                >
                  {refreshingChat ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
                <button
                  onClick={() => setArmarPedidoOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-white text-sm font-semibold active:scale-95 transition-transform flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <ShoppingCart size={14} />
                  <span className="hidden sm:inline">Armar pedido</span>
                </button>
              </div>

              {/* Lista de mensajes */}
              <div
                ref={listRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 overscroll-contain"
              >
                {mensajes.length === 0 && (
                  <div className="text-center text-sm text-[color:var(--text-muted)] py-8">
                    Sin mensajes todavía. ¡Escríbele al cliente!
                  </div>
                )}
                {mensajes.map((m) => (
                  <BurbujaMensaje key={m.id} m={m} />
                ))}
                {otroEscribiendo && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-700 border border-[color:var(--border-subtle)] rounded-lg rounded-bl-sm px-3 py-2 text-sm">
                      <span className="inline-flex gap-0.5" aria-label="Escribiendo">
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={enviarMensaje}
                className="border-t border-[color:var(--border-subtle)] p-2 flex items-end gap-1.5 bg-[color:var(--bg-elevated)] flex-shrink-0"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={enviarImagen}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={pickImage}
                  disabled={sending}
                  className="flex-shrink-0 w-11 h-11 rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--bg-subtle)] disabled:opacity-50 flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
                  aria-label="Enviar una foto"
                  title="Enviar una foto"
                >
                  <ImagePlus size={20} />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={500}
                  placeholder="Escribe un mensaje…"
                  className="flex-1 px-4 py-2.5 border border-[color:var(--border-subtle)] rounded-2xl bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  style={{ maxHeight: '100px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-11 h-11 rounded-full text-white disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center touch-manipulation"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  aria-label="Enviar mensaje"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Modal de armar pedido */}
      {armarPedidoOpen && convActiva && (
        <ArmarPedidoModal
          conversacion={convActiva}
          onClose={() => setArmarPedidoOpen(false)}
          onCreated={(pedidoId) => {
            setArmarPedidoOpen(false);
            setConvActiva((c) => c ? { ...c, estado: 'convertida', pedido_id: pedidoId } : c);
            refrescarLista(true);
            refrescarChat(true);
          }}
        />
      )}
    </div>
  );
}
