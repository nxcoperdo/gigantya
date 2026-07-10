/**
 * KDS — Kitchen Display System (Fase 4).
 *
 * Tablero de cocina con 3 columnas: Pendiente → En preparación → Listo.
 *
 *   - Carga pedidos `canal='pos'` del restaurante del staff (con cache
 *     fresca cada 10s + por socket).
 *   - Escucha `pos:order_created` (suma nuevo pedido + suena ding +
 *     auto-imprime comanda).
 *   - Escucha `pos:order_status_changed` (refresca).
 *   - Botones "Empezar" / "Listo" avanzan estado (PATCH /pos/orders/:id/status).
 *   - Botón "Re-imprimir" re-emite la comanda.
 *
 * El estado del pedido NO depende de la impresión. La transición se
 * confirma al click. Si la impresión falla, el cocinero puede
 * reimprimir con un click más.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChefHat, Printer, RefreshCw, ArrowRight, Check, X, Clock, MapPin, ShoppingBasket, Bike, FileText, Utensils } from 'lucide-react';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import socketService from '../../services/socket';
import { posOrdersService, printService } from '../../services/api';
import { KDS_COLUMNS, labelFor, canTransition } from '../../utils/orderStates';
import { formatCurrency } from '../../utils/formatHelper';
import NewOrderToast from '../../components/pos/NewOrderToast';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 10_000;

const COL_META = {
  Pendiente:  { accent: 'border-amber-500/50',  dot: 'bg-amber-400',   pill: 'bg-amber-500/15 text-amber-200' },
  Preparando: { accent: 'border-blue-500/50',   dot: 'bg-blue-400',    pill: 'bg-blue-500/15 text-blue-200' },
  Listo:      { accent: 'border-emerald-500/50',dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-200' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60}m`;
}

function TipoBadge({ pedido }) {
  if (pedido.mesa_id) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-200 text-[11px] font-medium">
        <MapPin className="w-3 h-3" aria-hidden="true" /> Mesa {pedido.mesa_id}
      </span>
    );
  }
  if (pedido.es_retiro_local) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-200 text-[11px] font-medium">
        <ShoppingBasket className="w-3 h-3" aria-hidden="true" /> Recoger
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 text-[11px] font-medium">
      <Bike className="w-3 h-3" aria-hidden="true" /> Domicilio
    </span>
  );
}

export default function KDSPage() {
  // usePosRestaurante combina `user.restaurante_id` (poblado para staff,
  // null para dueños) con el restaurante hidratado del Outlet context
  // (poblado para dueños, hidratado por el POSLayout via /api/restaurants/me).
  const { user, restauranteId } = usePosRestaurante();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastData, setToastData] = useState(null);
  const [printUrl, setPrintUrl] = useState(null);
  const [lastSeenId, setLastSeenId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchPedidos = useCallback(async (silent = false) => {
    if (!restauranteId) {
      // Sin restaurante no hay pedidos que mostrar. Salimos del loading con
      // error explícito en vez de quedar en "Cargando…" para siempre.
      setError('Tu cuenta no está asociada a un restaurante. Pídele al dueño que te invite desde Personal.');
      setLoading(false);
      return;
    }
    if (!silent) setRefreshing(true);
    try {
      const r = await posOrdersService.list({ estado: 'Pendiente,Preparando,Listo' });
      setPedidos(r.data.pedidos || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error cargando pedidos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restauranteId]);

  // Carga inicial + polling.
  useEffect(() => {
    fetchPedidos();
    const t = setInterval(fetchPedidos, POLL_MS);
    return () => clearInterval(t);
  }, [fetchPedidos]);

  // Reloj para "X min" en cada card.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Socket: nuevo pedido → toast + sonido + auto-print.
  useEffect(() => {
    if (!restauranteId) return;
    socketService.connectOrders();
    socketService.joinRestaurant(restauranteId, user.id);

    const onNew = (data) => {
      setToastData({ ...data, _stamp: Date.now() });
      // Si el pedido es nuevo, autogenerar la URL del PDF.
      if (data.pedido_id && data.pedido_id !== lastSeenId) {
        setLastSeenId(data.pedido_id);
        loadAndPrint(data.pedido_id);
      }
      // Refrescar la grilla.
      fetchPedidos(true);
    };
    const onStatus = () => fetchPedidos(true);
    socketService.onPosOrderCreated(onNew);
    socketService.onStatusUpdate(onStatus); // reusamos el status_update del cliente
    return () => {
      // No removemos listeners porque socketService es singleton; el KDS
      // puede montarse/desmontarse varias veces. Los handlers viejos se
      // acumulan. Para Fase 4 es aceptable; si en el futuro hay leaks
      // visibles, agregamos `socketService.off` específico.
    };
  }, [restauranteId, user?.id, fetchPedidos, lastSeenId]);

  // Genera la URL blob del PDF y la setea para que AutoPrintIframe la
  // monte y dispare `window.print()`.
  const loadAndPrint = useCallback(async (pedidoId) => {
    try {
      const r = await printService.kitchenTicket(pedidoId);
      const url = URL.createObjectURL(r.data);
      setPrintUrl(url);
    } catch (e) {
      console.warn('[KDS] no se pudo auto-imprimir comanda', e);
    }
  }, []);

  const reimprimir = useCallback(async (pedidoId) => {
    await loadAndPrint(pedidoId);
  }, [loadAndPrint]);

  const advance = useCallback(async (pedido, nuevoEstado) => {
    if (!canTransition(pedido.estado, nuevoEstado)) return;
    try {
      // Optimista: actualizamos el estado localmente para feedback inmediato.
      setPedidos((prev) => prev.map((p) => p.id === pedido.id ? { ...p, estado: nuevoEstado } : p));
      await posOrdersService.updateStatus(pedido.id, nuevoEstado);
      fetchPedidos(true);
    } catch (e) {
      // Revertimos si falla.
      setPedidos((prev) => prev.map((p) => p.id === pedido.id ? { ...p, estado: pedido.estado } : p));
      setError(e.response?.data?.error || e.message);
    }
  }, [fetchPedidos]);

  const pedidosPorEstado = useMemo(() => {
    const buckets = { Pendiente: [], Preparando: [], Listo: [] };
    for (const p of pedidos) {
      if (buckets[p.estado]) buckets[p.estado].push(p);
    }
    // Más recientes primero.
    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    }
    return buckets;
  }, [pedidos]);

  if (loading) {
    return (
      <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)] rounded-full animate-spin" />
        <span>Cargando pedidos…</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
          aria-hidden="true"
        >
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-extrabold leading-tight">Cocina (KDS)</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {pedidos.length} {pedidos.length === 1 ? 'pedido activo' : 'pedidos activos'}
          </p>
        </div>
        <button
          onClick={() => fetchPedidos()}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm font-medium hover:bg-[color:var(--bg)] transition-colors disabled:opacity-50"
          type="button"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline font-medium hover:no-underline">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {KDS_COLUMNS.map((estado) => {
          const meta = COL_META[estado];
          const items = pedidosPorEstado[estado];
          return (
            <section
              key={estado}
              aria-labelledby={`kds-col-${estado}`}
              className={`bg-[color:var(--bg-elevated)] border border-[color:var(--border)] border-t-4 ${meta.accent} rounded-xl p-3 min-h-[60vh] flex flex-col`}
            >
              <h2
                id={`kds-col-${estado}`}
                className="font-heading font-bold text-sm mb-3 flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                  {labelFor(estado)}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.pill}`}>
                  {items.length}
                </span>
              </h2>
              <ul className="space-y-2 flex-1">
                {items.map((p) => {
                  const elapsed = now - new Date(p.creado_en).getTime();
                  const urgente = estado === 'Pendiente' && elapsed > 10 * 60_000;
                  return (
                    <li
                      key={p.id}
                      className={`bg-[color:var(--bg)] border rounded-lg p-3 text-sm shadow-sm transition-all ${
                        urgente
                          ? 'border-rose-500/50 ring-1 ring-rose-500/30 animate-pulse-soft'
                          : 'border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">#{p.id}</span>
                          <TipoBadge pedido={p} />
                        </div>
                        <span className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${
                          urgente ? 'text-rose-300' : 'text-[color:var(--text-muted)]'
                        }`}>
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {timeAgo(p.creado_en)}
                        </span>
                      </div>
                      {p.cliente_nombre && (
                        <div className="text-xs text-[color:var(--text-muted)] mb-1.5 truncate">
                          {p.cliente_nombre}
                        </div>
                      )}
                      {p.notas && (
                        <div className="text-xs italic text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 mb-2 leading-snug">
                          <FileText className="w-3 h-3 inline mr-1 -mt-0.5" aria-hidden="true" />
                          {p.notas}
                        </div>
                      )}

                      {/* Lista de productos a cocinar (lo más importante del KDS) */}
                      {p.items && p.items.length > 0 ? (
                        <ul className="mb-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] divide-y divide-[color:var(--border)] overflow-hidden">
                          {p.items.map((it) => (
                            <li
                              key={it.id}
                              className="px-2.5 py-1.5 flex items-start gap-2 text-xs"
                            >
                              <span className="shrink-0 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 rounded-md bg-[color:var(--primary,#3b82f6)]/15 text-[color:var(--primary,#3b82f6)] font-bold font-mono text-[11px]">
                                ×{Number(it.cantidad || 1)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[color:var(--text)] leading-snug">
                                  {it.producto_nombre || `Producto #${it.producto_id}`}
                                </div>
                                {it.especificaciones && (
                                  <div className="text-[10px] italic text-amber-300/90 leading-snug mt-0.5">
                                    <FileText className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" aria-hidden="true" />
                                    {it.especificaciones}
                                  </div>
                                )}
                                {it.removidos_json && (() => {
                                  let quitados = null;
                                  try {
                                    const parsed = typeof it.removidos_json === 'string'
                                      ? JSON.parse(it.removidos_json)
                                      : it.removidos_json;
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                      quitados = parsed.map((r) => r.nombre || r.ingrediente_nombre || `#${r.ingrediente_id}`).join(', ');
                                    }
                                  } catch { /* ignore */ }
                                  if (!quitados) return null;
                                  return (
                                    <div className="text-[10px] text-rose-300/90 leading-snug mt-0.5">
                                      <X className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" aria-hidden="true" />
                                      sin: {quitados}
                                    </div>
                                  );
                                })()}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mb-2 text-[10px] text-[color:var(--text-muted)] italic flex items-center gap-1">
                          <Utensils className="w-3 h-3" aria-hidden="true" />
                          Sin ítems
                        </div>
                      )}

                      <div className="text-[11px] text-[color:var(--text-muted)] mb-2 font-mono">
                        Total: {formatCurrency(p.total)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.estado === 'Pendiente' && (
                          <button
                            onClick={() => advance(p, 'Preparando')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors active:scale-95"
                            type="button"
                          >
                            Empezar <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        {p.estado === 'Preparando' && (
                          <button
                            onClick={() => advance(p, 'Listo')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors active:scale-95"
                            type="button"
                          >
                            Listo <Check className="w-3 h-3" />
                          </button>
                        )}
                        {(p.estado === 'Pendiente' || p.estado === 'Preparando') && (
                          <button
                            onClick={() => advance(p, 'Cancelado')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition-colors active:scale-95"
                            type="button"
                            aria-label="Cancelar pedido"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => reimprimir(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[color:var(--bg-elevated)] hover:bg-[color:var(--bg-hover)] border border-[color:var(--border)] text-xs font-medium ml-auto transition-colors"
                          type="button"
                        >
                          <Printer className="w-3 h-3" /> Re-imprimir
                        </button>
                      </div>
                    </li>
                  );
                })}
                {items.length === 0 && (
                  <li className="flex flex-col items-center justify-center text-xs text-[color:var(--text-muted)] text-center py-10 border-2 border-dashed border-[color:var(--border)] rounded-lg">
                    <ChefHat className="w-6 h-6 mb-1 opacity-40" aria-hidden="true" />
                    Sin pedidos en este estado
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <NewOrderToast data={toastData} onClose={() => setToastData(null)} />
      <AutoPrintIframe url={printUrl} onPrinted={() => {
        // Limpiamos la URL después de un rato para que el iframe
        // pueda re-imprimir el mismo PDF.
        setTimeout(() => setPrintUrl(null), 3000);
      }} />
    </div>
  );
}
