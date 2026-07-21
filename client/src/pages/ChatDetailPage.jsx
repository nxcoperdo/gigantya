import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, ImagePlus, Wifi, WifiOff, Package, ExternalLink } from 'lucide-react';
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
 * Mobile-first (UI/UX Pro Max):
 *  - Header sticky con avatar + nombre + estado online + link al local
 *  - Swipe-edge-back gesture (iOS-like) con CSS overscroll-behavior
 *  - Safe-area-inset-bottom para que el input no choque con home indicator
 *  - Input auto-crece hasta 120px (sin layout shift)
 *  - Haptic feedback al enviar (vibration API cuando esté disponible)
 *  - Mensajes nuevos: animación slide-in direccional (mío vs. del vendedor)
 *  - Typing indicator con 3 dots animados (reduced-motion aware)
 *  - Polling cada 6s + socket para typing/presence
 */

const POLL_INTERVAL_MS = 6000;
const TYPING_DEBOUNCE_MS = 500;
const TYPING_TIMEOUT_MS = 4000;
const MAX_INPUT_HEIGHT = 120;

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
  const [imagenPreview, setImagenPreview] = useState(null);

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
  const inputAreaRef = useRef(null);

  // ============ Carga inicial ============

  if (!user || user.tipo_usuario !== 'cliente') {
    return <Loading />;
  }

  const fetchMensajes = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const hist = await chatService.listMensajes(conversacionId, null);
        setConversacion(hist.conversacion);
        setMensajes(hist.mensajes || []);
        setError(null);
      } catch (err) {
        console.error('[ChatDetail] fetch error:', err);
        if (err.response?.status === 403 || err.response?.status === 404) {
          navigate('/chats', { replace: true });
          return;
        }
        setError(err.response?.data?.error || err.message || 'No se pudo cargar la conversación');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversacionId, navigate]
  );

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

  // Si la pestaña vuelve a estar visible, refresca de inmediato
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchMensajes({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
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

  // Cuando aparece "escribiendo" del otro, scrollea al fondo solo si
  // el usuario ya estaba cerca del final.
  useEffect(() => {
    if (!otroEscribiendo || !listRef.current) return;
    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    }
  }, [otroEscribiendo]);

  // ============ Input auto-crece ============

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT);
    ta.style.height = `${next}px`;
  }, [input]);

  // ============ Envío de mensajes ============

  const sendTypingDebounced = useCallback(
    (typing) => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        if (typing !== lastTypingSentRef.current) {
          socketService.sendTyping(conversacionId, typing);
          lastTypingSentRef.current = typing;
        }
      }, TYPING_DEBOUNCE_MS);
    },
    [conversacionId]
  );

  useEffect(() => {
    sendTypingDebounced(input.trim().length > 0);
  }, [input, sendTypingDebounced]);

  // Haptic feedback breve al enviar (Android/soportado). No-op en iOS.
  const haptic = useCallback((ms = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_) { /* noop */ }
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!input.trim() || sending) return;
      const texto = input;
      setInput('');
      stickToBottomRef.current = true;
      haptic(8);
      try {
        setSending(true);
        const msg = await chatService.sendMensaje(conversacionId, { contenido: texto.trim() }, null);
        setMensajes((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'No se pudo enviar el mensaje');
        setInput(texto);
      } finally {
        setSending(false);
      }
    },
    [input, sending, conversacionId, haptic]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const caption = input;
      setInput('');
      stickToBottomRef.current = true;
      haptic(8);
      try {
        setSending(true);
        const msg = await chatService.sendImagen(conversacionId, file, caption, null);
        setMensajes((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'No se pudo enviar la foto');
        setInput(caption);
      } finally {
        setSending(false);
      }
    },
    [input, conversacionId, haptic]
  );

  // ============ Estado de la conversación ============

  const isConvertida = conversacion?.estado === 'convertida';
  const isCerrada = conversacion?.estado === 'cerrada';
  const puedeEscribir = conversacion?.estado === 'abierta';

  const nombreRestaurante = useMemo(() => {
    return (
      conversacion?.restaurante_nombre ||
      (conversacion?.restaurante_id ? `Local #${conversacion.restaurante_id}` : 'Cargando…')
    );
  }, [conversacion]);

  // ============ Render ============

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)] flex flex-col">
        <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] sticky top-0 z-20">
          <button
            onClick={() => navigate('/chats')}
            className="p-2 -ml-1 rounded-full hover:bg-[color:var(--bg-muted)] active:scale-90 transition-transform"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-5 w-32 rounded-md bg-[color:var(--bg-muted)] shimmer" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[color:var(--bg-subtle)] flex flex-col">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 bg-[color:var(--bg-elevated)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg-elevated)]/80 border-b border-[color:var(--border-subtle)] px-2.5 py-2 sm:px-4 sm:py-3 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/chats')}
          className="p-2 -ml-1 rounded-full hover:bg-[color:var(--bg-muted)] active:scale-90 transition-transform touch-manipulation"
          aria-label="Volver a la lista de chats"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Avatar mini + nombre + estado */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full bg-[color:var(--bg-muted)] flex items-center justify-center overflow-hidden ring-1 ring-[color:var(--border-subtle)]">
            {conversacion?.restaurante_imagen ? (
              <img
                src={conversacion.restaurante_imagen}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-[color:var(--text-muted)]">
                {nombreRestaurante.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[15px] sm:text-base text-[color:var(--text-primary)] truncate leading-tight">
              {nombreRestaurante}
            </h1>
            <div className="text-[11px] sm:text-xs text-[color:var(--text-muted)] flex items-center gap-1.5 leading-tight">
              {onlineCount > 1 ? (
                <>
                  <span
                    className="relative flex h-1.5 w-1.5"
                    aria-hidden="true"
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <Wifi size={11} className="sr-only" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">En línea</span>
                </>
              ) : (
                <>
                  <WifiOff size={11} aria-hidden="true" />
                  <span>Conectado</span>
                </>
              )}
              {isConvertida && conversacion.pedido_id && (
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 rounded text-[10px] font-semibold">
                  <Package size={10} strokeWidth={2.5} />
                  Pedido #{conversacion.pedido_id}
                </span>
              )}
              {isCerrada && (
                <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 rounded text-[10px] font-semibold">
                  Cerrada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Link al local (desktop) */}
        {conversacion?.restaurante_id && (
          <Link
            to={`/restaurant/${conversacion.restaurante_id}`}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-[color:var(--bg-muted)] text-[color:var(--color-primary)] flex-shrink-0 transition-colors"
          >
            Ver local
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      {/* Lista de mensajes */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 bg-gray-50 dark:bg-gray-900 overscroll-contain"
        role="log"
        aria-live="polite"
        aria-label="Mensajes del chat"
      >
        {mensajes.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-muted)] py-12 px-4">
            <div
              className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-[color:var(--bg-muted)] text-[color:var(--text-muted)] mb-3"
              aria-hidden="true"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-[color:var(--text-secondary)]">Aún no hay mensajes</p>
            <p className="mt-1 text-[13px]">¡Escribí el primero para empezar la conversación!</p>
          </div>
        )}
        {mensajes.map((m) => (
          <ChatMessage key={m.id} m={m} conversacionId={conversacionId} />
        ))}
        {otroEscribiendo && (
          <div className="flex justify-start chat-msg-in-theirs" aria-live="polite">
            <div className="bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] rounded-2xl rounded-bl-md px-3 py-2 shadow-sm flex items-center gap-1 text-[color:var(--text-muted)]">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="sr-only">El vendedor está escribiendo</span>
            </div>
          </div>
        )}
      </div>

      {/* Error flotante (no tapa el input) */}
      {error && (
        <div
          role="alert"
          className="px-3.5 py-2 bg-[var(--danger-bg)] text-[var(--danger-text)] text-xs flex-shrink-0 border-t border-[var(--danger-border)] flex items-start gap-2"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-semibold opacity-70 hover:opacity-100"
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input o mensaje de "no puedes escribir" */}
      {puedeEscribir ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-[color:var(--border-subtle)] px-2 py-2 sm:px-3 sm:py-2.5 flex items-end gap-1.5 bg-[color:var(--bg-elevated)] flex-shrink-0"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={handlePickImage}
            disabled={sending}
            className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] disabled:opacity-40 flex items-center justify-center touch-manipulation active:scale-90 transition-all"
            aria-label="Enviar una foto"
            title="Enviar una foto"
          >
            <ImagePlus size={20} />
          </button>
          <div ref={inputAreaRef} className="flex-1 min-w-0 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={500}
              placeholder="Escribí un mensaje…"
              aria-label="Mensaje"
              className="block w-full pl-3.5 pr-3 py-2 sm:py-2.5 border border-[color:var(--border-default)] rounded-2xl bg-[color:var(--bg-muted)] text-[15px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] resize-none leading-snug focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/40 focus:bg-[color:var(--bg-elevated)] transition-colors overflow-y-auto"
              style={{ maxHeight: `${MAX_INPUT_HEIGHT}px` }}
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full text-white shadow-sm active:scale-90 transition-all flex items-center justify-center touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            style={{ backgroundColor: 'var(--color-primary)' }}
            aria-label="Enviar mensaje"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      ) : (
        <div
          className="border-t border-[color:var(--border-subtle)] p-4 bg-[color:var(--bg-muted)] text-center text-sm text-[color:var(--text-secondary)] flex-shrink-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {isConvertida && conversacion?.pedido_id ? (
            <>
              Esta conversación ya se convirtió en el{' '}
              <Link
                to="/orders"
                className="text-[color:var(--color-primary)] font-semibold hover:underline"
              >
                pedido #{conversacion.pedido_id}
              </Link>
              . No se pueden enviar más mensajes por acá.
            </>
          ) : isCerrada ? (
            'Esta conversación está cerrada.'
          ) : (
            'No puedes escribir en esta conversación.'
          )}
        </div>
      )}
    </div>
  );
}
