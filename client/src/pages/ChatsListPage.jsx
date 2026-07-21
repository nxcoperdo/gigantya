import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MessageSquare,
  Store,
  Package,
  ArrowRight,
  Search,
  X,
  Inbox,
  CheckCheck,
} from 'lucide-react';
import chatService from '../services/chat.js';
import Loading from '../components/Loading.jsx';

/**
 * /chats — lista de conversaciones del cliente logueado con todos los
 * locales que tengan chat habilitado.
 *
 * Solo accesible para clientes logueados (ProtectedRoute requiredRole=cliente).
 * El cliente anónimo NO ve esta página — sigue usando el chat desde
 * /restaurant/:id con ChatIdentityModal.
 *
 * Patrón visual mobile-first (UI/UX Pro Max):
 *  - Header compacto con título, contador de no-leídos y buscador
 *  - Cards con jerarquía clara: avatar + nombre + preview + meta
 *  - Stagger animation al cargar
 *  - Pull-to-refresh implícito (polling 6s) + última actualización
 *  - Swipe gesture opcional (futuro: archive)
 *  - Empty state con CTA principal
 *
 * Diferencias con OrdersHistoryPage:
 *  - Sin filtros por estado (siempre muestra todas)
 *  - Polling 6s sin botón refrescar manual (UX consistente con chat)
 *  - Buscador por nombre de local (móvil-friendly)
 */

const POLL_INTERVAL_MS = 6000;

function tiempoRelativo(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHoras < 24) return `${diffHoras} h`;
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `${diffDias} d`;
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// Badge de estado semántico. Verde = activa, emerald = convertida, gris = cerrada.
function EstadoBadge({ estado, pedidoId }) {
  if (estado === 'convertida') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
        <Package size={10} strokeWidth={2.5} />
        Pedido #{pedidoId}
      </span>
    );
  }
  if (estado === 'cerrada') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        Cerrada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
      </span>
      Activa
    </span>
  );
}

// Card de conversación memoizada. Solo re-renderea si cambia la conv o el
// highlight de búsqueda. Móvil-first: tap target 64px, swipe-friendly.
const ConversacionCard = ({
  c,
  query,
  onOpen,
}) => {
  const handleClick = useCallback(() => onOpen(c.id), [c.id, onOpen]);
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Resalta el término buscado en el nombre (sin libs externas).
  const renderNombre = () => {
    if (!query || !c.restaurante_nombre) return c.restaurante_nombre || `Local #${c.restaurante_id}`;
    const nombre = c.restaurante_nombre;
    const idx = nombre.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return nombre;
    return (
      <>
        {nombre.slice(0, idx)}
        <mark className="bg-[var(--mark-bg)] text-[var(--mark-text)] rounded px-0.5">
          {nombre.slice(idx, idx + query.length)}
        </mark>
        {nombre.slice(idx + query.length)}
      </>
    );
  };

  const hasUnread = c.no_leidos > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Abrir chat con ${c.restaurante_nombre || 'el local'}${hasUnread ? `, ${c.no_leidos} mensajes sin leer` : ''}`}
      className={[
        'group w-full text-left flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5',
        'rounded-2xl border bg-[color:var(--bg-elevated)]',
        'transition-all duration-200 ease-out cursor-pointer',
        'active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40',
        hasUnread
          ? 'border-[color:var(--color-primary)]/30 shadow-sm'
          : 'border-[color:var(--border-default)] hover:border-[color:var(--color-primary)]/40 hover:shadow-md',
      ].join(' ')}
    >
      {/* Avatar con badge de no leídos superpuesto */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[color:var(--bg-muted)] flex items-center justify-center overflow-hidden ring-1 ring-[color:var(--border-subtle)]">
          {c.restaurante_imagen ? (
            <img
              src={c.restaurante_imagen}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <Store size={22} className="text-[color:var(--text-muted)]" />
          )}
        </div>
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[color:var(--bg-elevated)] shadow-sm"
          >
            {c.no_leidos > 99 ? '99+' : c.no_leidos > 9 ? '9+' : c.no_leidos}
          </span>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h3
            className={[
              'truncate text-[15px] sm:text-base',
              hasUnread
                ? 'font-bold text-[color:var(--text-primary)]'
                : 'font-semibold text-[color:var(--text-primary)]',
            ].join(' ')}
          >
            {renderNombre()}
          </h3>
          <span
            className={[
              'flex-shrink-0 text-[11px] sm:text-xs tabular-nums',
              hasUnread
                ? 'text-[color:var(--color-primary)] font-semibold'
                : 'text-[color:var(--text-muted)] font-medium',
            ].join(' ')}
          >
            {tiempoRelativo(c.ultimo_mensaje_en || c.updated_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p
            className={[
              'text-[13px] sm:text-sm truncate flex-1 min-w-0',
              hasUnread
                ? 'text-[color:var(--text-primary)] font-medium'
                : 'text-[color:var(--text-secondary)]',
            ].join(' ')}
          >
            {c.ultimo_mensaje_preview || (
              <span className="italic text-[color:var(--text-muted)]">Sin mensajes aún</span>
            )}
          </p>
          <div className="flex-shrink-0 hidden xs:block">
            <EstadoBadge estado={c.estado} pedidoId={c.pedido_id} />
          </div>
        </div>
      </div>

      {/* Flecha sutil que aparece en hover/focus (desktop) */}
      <ArrowRight
        size={16}
        strokeWidth={2}
        className="hidden sm:block flex-shrink-0 text-[color:var(--text-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-all duration-200"
      />
    </button>
  );
};

// Skeleton que se muestra durante la carga inicial.
function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-3 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[color:var(--bg-muted)] shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-[color:var(--bg-muted)] shimmer" />
            <div className="h-3 w-2/3 rounded bg-[color:var(--bg-muted)] shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatsListPage() {
  const navigate = useNavigate();
  const [conversaciones, setConversaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const pollRef = useRef(null);

  const fetchConversaciones = useCallback(async () => {
    try {
      const res = await chatService.clienteListConversaciones();
      setConversaciones(res.conversaciones || []);
      setError(null);
    } catch (err) {
      console.error('[ChatsList] error:', err);
      setError(err.response?.data?.error || err.message || 'No se pudieron cargar los chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchConversaciones();
  }, [fetchConversaciones]);

  // Polling cada 6s mientras la página está montada
  useEffect(() => {
    pollRef.current = setInterval(() => fetchConversaciones(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchConversaciones]);

  // Si la página vuelve a ser visible después de estar oculta, refresca
  // inmediatamente (mejor percepción que esperar 6s).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchConversaciones();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchConversaciones]);

  const handleOpenChat = useCallback(
    (conversacionId) => {
      navigate(`/chats/${conversacionId}`);
    },
    [navigate]
  );

  const conversacionesFiltradas = useMemo(() => {
    if (!query.trim()) return conversaciones;
    const q = query.trim().toLowerCase();
    return conversaciones.filter((c) =>
      (c.restaurante_nombre || '').toLowerCase().includes(q)
    );
  }, [conversaciones, query]);

  const totalNoLeidos = useMemo(
    () => conversaciones.reduce((acc, c) => acc + (c.no_leidos || 0), 0),
    [conversaciones]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)]">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 pt-4 sm:pt-8 pb-24 md:pb-10">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-7 w-32 rounded-lg bg-[color:var(--bg-muted)] shimmer" />
            <div className="h-9 w-9 rounded-full bg-[color:var(--bg-muted)] shimmer" />
          </div>
          <div className="h-11 w-full rounded-xl bg-[color:var(--bg-muted)] shimmer mb-4" />
          <ListSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)]">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 pt-4 sm:pt-8 pb-24 md:pb-10">
        {/* Header móvil-first: título + contador en una fila, search sticky abajo */}
        <header className="mb-3 sm:mb-5">
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                <span
                  className="inline-flex w-9 h-9 sm:w-10 sm:h-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]"
                  aria-hidden="true"
                >
                  <MessageSquare size={20} strokeWidth={2.4} />
                </span>
                <span className="truncate">Mis Chats</span>
              </h1>
              <p className="text-xs sm:text-sm text-[color:var(--text-secondary)] mt-1 flex items-center gap-1.5">
                <span>
                  {conversaciones.length === 0
                    ? 'Sin conversaciones'
                    : `${conversaciones.length} ${conversaciones.length === 1 ? 'conversación' : 'conversaciones'}`}
                </span>
                {totalNoLeidos > 0 && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-primary)]">
                      <span
                        className="w-1.5 h-1.5 bg-[color:var(--color-primary)] rounded-full"
                        aria-hidden="true"
                      />
                      {totalNoLeidos} sin leer
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Buscador — solo si hay conversaciones. Sticky para que no
              desaparezca al scrollear listas largas. */}
          {conversaciones.length > 0 && (
            <div className="sticky top-0 z-10 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 bg-[color:var(--bg-subtle)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg-subtle)]/80">
              <label className="relative block">
                <span className="sr-only">Buscar conversaciones</span>
                <Search
                  size={16}
                  strokeWidth={2.2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar local…"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[color:var(--bg-elevated)] border border-[color:var(--border-default)] text-[15px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/30 focus:border-[color:var(--color-primary)]/40 transition-colors"
                  inputMode="search"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)] active:scale-90 transition-transform"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                )}
              </label>
            </div>
          )}
        </header>

        {/* Error inline con recovery */}
        {error && (
          <div
            role="alert"
            className="mb-3 px-3.5 py-2.5 bg-[var(--danger-bg)] text-[var(--danger-text)] text-sm rounded-xl border border-[var(--danger-border)] flex items-start gap-2"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={fetchConversaciones}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Lista */}
        {conversaciones.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 card-lg">
            <div
              className="inline-flex w-16 h-16 sm:w-20 sm:h-20 items-center justify-center rounded-3xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] mb-4"
              aria-hidden="true"
            >
              <Inbox size={32} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)] mb-1.5">
              Aún no tienes chats
            </h2>
            <p className="text-sm sm:text-base text-[color:var(--text-secondary)] mb-6 max-w-sm mx-auto leading-relaxed">
              Cuando hables con un local, la conversación va a aparecer aquí. Puedes chatear desde
              la página de cualquier local.
            </p>
            <Link
              to="/"
              className="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl"
            >
              <Store size={16} />
              Explorar locales
            </Link>
          </div>
        ) : conversacionesFiltradas.length === 0 ? (
          <div className="text-center py-10">
            <Search
              size={40}
              strokeWidth={1.5}
              className="text-[color:var(--text-muted)] mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-[color:var(--text-secondary)]">
              No encontramos chats con <span className="font-semibold">"{query}"</span>
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-3 text-sm font-semibold text-[color:var(--color-primary)] hover:underline"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <>
            {/* Indicador sutil: "todos leídos" cuando no hay no-leídos */}
            {totalNoLeidos === 0 && conversaciones.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-[color:var(--text-muted)]"
                aria-hidden="true"
              >
                <CheckCheck size={14} className="text-emerald-500" />
                <span>Todo al día — sin mensajes pendientes</span>
              </div>
            )}

            <ul className="space-y-1.5 sm:space-y-2 list-none" role="list">
              {conversacionesFiltradas.map((c, idx) => (
                <li
                  key={c.id}
                  className="chat-list-item"
                  style={{
                    animationDelay: `${Math.min(idx * 35, 350)}ms`,
                  }}
                >
                  <ConversacionCard c={c} query={query} onOpen={handleOpenChat} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
