import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, ImagePlus, Wifi, WifiOff, Package } from 'lucide-react';
import chatService from '../services/chat.js';
import socketService from '../services/socket.js';
import ChatMessage from '../components/chat/ChatMessage.jsx';
import Loading from '../components/Loading.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * /chats/:id — vista fullscreen de UNA conversación del cliente logueado.
 *
 * No usa el ChatContext global (que está atado a restauranteIdActivo y
 * se inicializa desde RestaurantDetailsPage). En su lugar maneja su
 * propio estado local porque:
 *  1. La conversación ya existe (no hay que crearla con ensureConversation).
 *  2. El cliente está logueado, así que no hay ChatIdentityModal.
 *  3. El socket y el polling son específicos de esta conversación.
 *
 * El backend devuelve la conversación en `hist.conversacion`, lo que nos
 * da el nombre del local, el estado y el restaurante_id. Si el server
 * devuelve 403, redirigimos a /chats (la conversación no es del cliente).
 *
 * Polling cada 6s (mismo intervalo que ChatPanel) + socket solo para
 * typing/presence (consistente con el resto del chat).
 */

const POLL_INTERVAL_MS = 6000;
const TYPING_DEBOUNCE_MS = 500;
const TYPING_TIMEOUT_MS = 4000;
const MAX_PREVIEW_CHARS = 80;

export default function ChatDetailPage() {
  const { id: conversacionIdParam } = useParams();
  const conversacionId = Number(conversacionIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estado
  const [conversacion, setConversacion] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Refs
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const prevMensajesLenRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const lastTypingSentRef = useRef(false);

  // ============ Carga inicial ============

  // Guard de seguridad: si por alguna razón el cliente no está logueado
  // (raro porque ProtectedRoute ya redirige), no intentamos pegarle al
  // endpoint como anónimo — sería confuso.
  if (!user || user.tipo_usuario !== 'cliente') {
    return <Loading />;
  }

  const fetchMensajes = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const hist = await chatService.listMensajes(conversacionId, null);
      setConversacion(hist.conversacion);
      setMensajes(hist.mensajes || []);
      setError(null);
    } catch (err) {
      console.error('[ChatDetail] fetch error:', err);
      if (err.response?.status === 403 || err.response?.status === 404) {
        // No es del cliente o no existe → redirigir a la lista
        navigate('/chats', { replace: true });
        return;
      }
      setError(err.response?.data?.error || err.message || 'No se pudo cargar la conversación');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversacionId, navigate]);

  useEffect(() => {
    if (!conversacionId || isNaN(conversacionId)) {
      navigate('/chats', { replace: true });
      return;
    }
    fetchMensajes();
  }, [conversacionId, fetchMensajes, navigate]);

  // Marcar como leído al cargar
  useEffect(() => {
    chatService.markRead(conversacionId, null).catch(() => {});
  }, [conversacionId]);

  // Unirse al room del socket (typing/presence)
  useEffect(() => {
    if (!conversacionId) return;
    let cancelled = false;
    (async () => {
      try {
        const ack = await socketService.joinConversation(conversacionId, null);
        if (!cancelled && ack?.online != null) setOnlineCount(ack.online);
      } catch (e) {
        console.warn('[ChatDetail] socket join falló:', e.message);
      }
    })();
    return () => {
      cancelled = true;
      socketService.leaveConversation(conversacionId);
    };
  }, [conversacionId]);

  // ============ Polling ============

  useEffect(() => {
    pollRef.current = setInterval(() => fetchMensajes({ silent: true }), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchMensajes]);

  // ============ Listeners de socket (typing/presence) ============

  useEffect(() => {
    const handleTyping = (payload) => {
      if (!payload || payload.conversacion_id !== conversacionId) return;
      if (payload.typing) {
        setOtroEscribiendo(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtroEscribiendo(false), TYPING_TIMEOUT_MS);
      } else {
        setOtroEscribiendo(false);
      }
    };
    const handlePresence = (payload) => {
      if (!payload || payload.conversacion_id !== conversacionId) return;
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
  }, [conversacionId]);

  // ============ Auto-scroll ============

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
  }, [mensajes]);

  // Auto-scroll al cargar
  useEffect(() => {
    if (!loading && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
        stickToBottomRef.current = true;
      });
    }
  }, [loading]);

  // Focus al cargar
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // ============ Envío de mensajes ============

  const sendTypingDebounced = useCallback((typing) => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      if (typing !== lastTypingSentRef.current) {
        socketService.sendTyping(conversacionId, typing);
        lastTypingSentRef.current = typing;
      }
    }, TYPING_DEBOUNCE_MS);
  }, [conversacionId]);

  useEffect(() => {
    sendTypingDebounced(input.trim().length > 0);
  }, [input, sendTypingDebounced]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const texto = input;
    setInput('');
    stickToBottomRef.current = true;
    try {
      setSending(true);
      const msg = await chatService.sendMensaje(conversacionId, { contenido: texto.trim() }, null);
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo enviar el mensaje');
      setInput(texto);
    } finally {
      setSending(false);
    }
  }, [input, sending, conversacionId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const caption = input;
    setInput('');
    stickToBottomRef.current = true;
    try {
      setSending(true);
      const msg = await chatService.sendImagen(conversacionId, file, caption, null);
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo enviar la foto');
      setInput(caption);
    } finally {
      setSending(false);
    }
  }, [input, conversacionId]);

  // ============ Estado de la conversación ============

  const isConvertida = conversacion?.estado === 'convertida';
  const isCerrada = conversacion?.estado === 'cerrada';
  const puedeEscribir = conversacion?.estado === 'abierta';

  const nombreRestaurante = useMemo(() => {
    return conversacion?.restaurante_nombre || (conversacion?.restaurante_id ? `Local #${conversacion.restaurante_id}` : 'Cargando…');
  }, [conversacion]);

  // ============ Render ============

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border-subtle)] bg-white dark:bg-gray-800 sticky top-0 z-10">
          <button onClick={() => navigate('/chats')} className="p-1.5 rounded-lg hover:bg-[color:var(--bg-muted)]" aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold">Cargando…</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] flex flex-col">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-[color:var(--border-subtle)] px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/chats')}
          className="p-1.5 rounded-lg hover:bg-[color:var(--bg-muted)] flex-shrink-0"
          aria-label="Volver a la lista de chats"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base sm:text-lg text-[color:var(--text-primary)] truncate">
            {nombreRestaurante}
          </h1>
          <div className="text-[11px] sm:text-xs text-[color:var(--text-muted)] flex items-center gap-1.5">
            {onlineCount > 1 ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{onlineCount > 1 ? 'en línea' : 'conectado'}</span>
            {isConvertida && conversacion.pedido_id && (
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                <Package size={10} />
                Pedido #{conversacion.pedido_id}
              </span>
            )}
            {isCerrada && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-semibold">
                Cerrada
              </span>
            )}
          </div>
        </div>
        {/* Link al local (útil para ver catálogo o pedir otro producto) */}
        {conversacion?.restaurante_id && (
          <Link
            to={`/restaurant/${conversacion.restaurante_id}`}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-[color:var(--bg-muted)] text-[color:var(--color-primary)] flex-shrink-0"
          >
            Ver local
          </Link>
        )}
      </div>

      {/* Lista de mensajes */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-gray-50 dark:bg-gray-900 overscroll-contain"
      >
        {mensajes.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-muted)] py-12">
            <p className="font-medium">Aún no hay mensajes.</p>
            <p className="mt-1">¡Escribe el primero!</p>
          </div>
        )}
        {mensajes.map((m) => (
          <ChatMessage key={m.id} m={m} conversacionId={conversacionId} />
        ))}
        {otroEscribiendo && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="inline-flex gap-0.5" aria-label="Escribiendo">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error flotante */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs flex-shrink-0 border-t border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Input o mensaje de "no podés escribir" */}
      {puedeEscribir ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-[color:var(--border-subtle)] p-2 flex items-end gap-1.5 bg-white dark:bg-gray-800 flex-shrink-0"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={handlePickImage}
            disabled={sending}
            className="flex-shrink-0 w-11 h-11 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
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
            placeholder="Escribe tu mensaje…"
            aria-label="Mensaje"
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-transparent"
            style={{ maxHeight: '120px' }}
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
      ) : (
        <div className="border-t border-[color:var(--border-subtle)] p-4 bg-gray-50 dark:bg-gray-900 text-center text-sm text-[color:var(--text-muted)] flex-shrink-0">
          {isConvertida && conversacion?.pedido_id ? (
            <>
              Esta conversación ya se convirtió en el{' '}
              <Link to={`/orders`} className="text-[color:var(--color-primary)] font-semibold hover:underline">
                pedido #{conversacion.pedido_id}
              </Link>
              . No se pueden enviar más mensajes por acá.
            </>
          ) : isCerrada ? (
            'Esta conversación está cerrada.'
          ) : (
            'No podés escribir en esta conversación.'
          )}
        </div>
      )}
    </div>
  );
}
