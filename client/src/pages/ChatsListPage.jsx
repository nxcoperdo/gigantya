import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Store, Package, RefreshCcw, ArrowRight } from 'lucide-react';
import chatService from '../services/chat.js';
import Loading from '../components/Loading.jsx';
import { formatDateTime } from '../utils/dateHelper.js';

/**
 * /chats — lista de conversaciones del cliente logueado con todos los
 * locales que tengan chat habilitado.
 *
 * Solo accesible para clientes logueados (ProtectedRoute requiredRole=cliente).
 * El cliente anónimo NO ve esta página — sigue usando el chat desde
 * /restaurant/:id con ChatIdentityModal.
 *
 * Patrón visual inspirado en OrdersHistoryPage: card por conversación,
 * estado vacío amigable, polling cada 6s con botón de refrescar manual.
 *
 * Diferencias con OrdersHistoryPage:
 *  - No hay filtros por estado (siempre muestra todas: abierta/convertida/cerrada).
 *  - Cada card es clickeable y navega a /chats/:id (no abre un modal).
 *  - Polling más rápido (6s en vez de refresh manual) porque el chat es
 *    más "vivo" que los pedidos.
 */

const POLL_INTERVAL_MS = 6000;

// "hace 5 min", "ayer", "12 jun" — para el preview de la última actividad.
function tiempoRelativo(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHoras < 24) return `hace ${diffHoras} h`;
  if (diffDias === 1) return 'ayer';
  if (diffDias < 7) return `hace ${diffDias} días`;
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function EstadoBadge({ estado, pedidoId }) {
  if (estado === 'convertida') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Package size={11} />
        Pedido #{pedidoId}
      </span>
    );
  }
  if (estado === 'cerrada') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        Cerrada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
      Abierta
    </span>
  );
}

export default function ChatsListPage() {
  const navigate = useNavigate();
  const [conversaciones, setConversaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  const fetchConversaciones = useCallback(async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) setLoading(true); else setRefreshing(true);
      const res = await chatService.clienteListConversaciones();
      setConversaciones(res.conversaciones || []);
      setLastRefreshedAt(new Date());
      setError(null);
    } catch (err) {
      console.error('[ChatsList] error:', err);
      setError(err.response?.data?.error || err.message || 'No se pudieron cargar los chats');
    } finally {
      if (showSpinner) setLoading(false); else setRefreshing(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchConversaciones();
  }, [fetchConversaciones]);

  // Polling cada 6s mientras la página está montada
  useEffect(() => {
    pollRef.current = setInterval(() => fetchConversaciones({ showSpinner: false }), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchConversaciones]);

  const handleRefresh = useCallback(() => {
    if (!refreshing && !loading) {
      fetchConversaciones({ showSpinner: false });
    }
  }, [refreshing, loading, fetchConversaciones]);

  const handleOpenChat = useCallback((conversacionId) => {
    navigate(`/chats/${conversacionId}`);
  }, [navigate]);

  // Total de no leídos (suma de todas las conversaciones) para mostrar
  // un numerito en el header si hay.
  const totalNoLeidos = useMemo(
    () => conversaciones.reduce((acc, c) => acc + (c.no_leidos || 0), 0),
    [conversaciones]
  );

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-6 md:py-10">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-[color:var(--text-primary)] flex items-center gap-2">
              <MessageSquare className="text-[color:var(--color-primary)]" size={28} />
              Mis Chats
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">
              Tus conversaciones con los locales.
              {totalNoLeidos > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 font-semibold text-[color:var(--color-primary)]">
                  {totalNoLeidos} sin leer
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn btn-outline inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Refrescar chats"
            >
              <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualizando…' : 'Refrescar'}
            </button>
            {lastRefreshedAt && (
              <span className="text-xs text-[color:var(--text-muted)]">
                Actualizado: {formatDateTime(lastRefreshedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        {/* Lista */}
        {conversaciones.length > 0 ? (
          <div className="space-y-3">
            {conversaciones.map((c) => (
              <button
                key={c.id}
                onClick={() => handleOpenChat(c.id)}
                className="w-full text-left card-lg hover:shadow-lg transition-all duration-300 hover:translate-y-[-1px] active:scale-[0.99] flex items-center gap-3 cursor-pointer"
              >
                {/* Avatar del local */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[color:var(--bg-muted)] flex items-center justify-center overflow-hidden">
                  {c.restaurante_imagen ? (
                    <img
                      src={c.restaurante_imagen}
                      alt={c.restaurante_nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store size={20} className="text-[color:var(--text-muted)]" />
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="font-bold text-[color:var(--text-primary)] truncate">
                      {c.restaurante_nombre || `Local #${c.restaurante_id}`}
                    </h3>
                    <span className="text-xs text-[color:var(--text-muted)] flex-shrink-0">
                      {tiempoRelativo(c.ultimo_mensaje_en || c.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[color:var(--text-secondary)] truncate flex-1">
                      {c.ultimo_mensaje_preview || <span className="italic opacity-60">Sin mensajes aún</span>}
                    </p>
                    <EstadoBadge estado={c.estado} pedidoId={c.pedido_id} />
                  </div>
                </div>

                {/* Badge de no leídos + flecha */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {c.no_leidos > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                      {c.no_leidos > 9 ? '9+' : c.no_leidos}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-[color:var(--text-muted)]" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 card-lg">
            <MessageSquare size={72} className="text-[color:var(--color-primary)] mb-4 mx-auto opacity-30" />
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-2">
              Aún no tienes chats
            </h2>
            <p className="text-[color:var(--text-secondary)] mb-6 max-w-sm mx-auto">
              Cuando hables con un local, la conversación va a aparecer acá.
              Podés chatear desde la página de cualquier local.
            </p>
            <Link to="/" className="btn btn-primary inline-flex items-center gap-2">
              <Store size={16} />
              Explorar locales
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
