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
import { ChefHat, Printer, RefreshCw, ArrowRight, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import { posOrdersService, printService } from '../../services/api';
import { ORDER_STATES, KDS_COLUMNS, labelFor, canTransition } from '../../utils/orderStates';
import { formatCurrency } from '../../utils/formatHelper';
import NewOrderToast from '../../components/pos/NewOrderToast';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 10_000;

export default function KDSPage() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastData, setToastData] = useState(null);
  const [printUrl, setPrintUrl] = useState(null);
  const [lastSeenId, setLastSeenId] = useState(null);

  const fetchPedidos = useCallback(async () => {
    if (!user?.restaurante_id) {
      // Sin restaurante no hay pedidos que mostrar. Salimos del loading con
      // error explícito en vez de quedar en "Cargando…" para siempre.
      setError('Tu cuenta no está asociada a un restaurante. Pídele al dueño que te invite desde Personal.');
      setLoading(false);
      return;
    }
    try {
      const r = await posOrdersService.list({ estado: 'Pendiente,Preparando,Listo' });
      setPedidos(r.data.pedidos || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  }, [user?.restaurante_id]);

  // Carga inicial + polling.
  useEffect(() => {
    fetchPedidos();
    const t = setInterval(fetchPedidos, POLL_MS);
    return () => clearInterval(t);
  }, [fetchPedidos]);

  // Socket: nuevo pedido → toast + sonido + auto-print.
  useEffect(() => {
    if (!user?.restaurante_id) return;
    socketService.connectOrders();
    socketService.joinRestaurant(user.restaurante_id, user.id);

    const onNew = (data) => {
      setToastData({ ...data, _stamp: Date.now() });
      // Si el pedido es nuevo, autogenerar la URL del PDF.
      if (data.pedido_id && data.pedido_id !== lastSeenId) {
        setLastSeenId(data.pedido_id);
        loadAndPrint(data.pedido_id);
      }
      // Refrescar la grilla.
      fetchPedidos();
    };
    const onStatus = () => fetchPedidos();
    socketService.onPosOrderCreated(onNew);
    socketService.onStatusUpdate(onStatus); // reusamos el status_update del cliente
    return () => {
      // No removemos listeners porque socketService es singleton; el KDS
      // puede montarse/desmontarse varias veces. Los handlers viejos se
      // acumulan. Para Fase 4 es aceptable; si en el futuro hay leaks
      // visibles, agregamos `socketService.off` específico.
    };
  }, [user?.restaurante_id, user?.id, fetchPedidos, lastSeenId]);

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
      await posOrdersService.updateStatus(pedido.id, nuevoEstado);
      // Optimista: refrescamos apenas vuelva el PATCH.
      fetchPedidos();
    } catch (e) {
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
    return <div className="p-8 text-center text-[color:var(--text-muted)]">Cargando pedidos…</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <header className="flex items-center gap-2">
        <ChefHat className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Cocina (KDS)</h1>
        <button
          onClick={fetchPedidos}
          className="ml-auto p-2 rounded hover:bg-[color:var(--bg-elevated)]"
          type="button"
          aria-label="Refrescar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {error && (
        <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {KDS_COLUMNS.map((estado) => (
          <section
            key={estado}
            className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-3 min-h-[60vh]"
          >
            <h2 className="font-semibold text-sm mb-2 flex items-center justify-between">
              <span>{labelFor(estado)}</span>
              <span className="text-xs text-[color:var(--text-muted)]">
                {pedidosPorEstado[estado].length}
              </span>
            </h2>
            <ul className="space-y-2">
              {pedidosPorEstado[estado].map((p) => (
                <li
                  key={p.id}
                  className="bg-[color:var(--bg)] border border-[color:var(--border)] rounded-md p-3 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">#{p.id}</span>
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {p.mesa_id
                        ? `Mesa ${p.mesa_id}`
                        : p.es_retiro_local ? 'Recoger' : 'Domicilio'}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] mb-2">
                    {new Date(p.creado_en).toLocaleTimeString('es-CO', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] mb-2">
                    Total: {formatCurrency(p.total)}
                  </div>
                  {p.notas && (
                    <div className="text-xs italic text-amber-600 mb-2">
                      Nota: {p.notas}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {p.estado === 'Pendiente' && (
                      <button
                        onClick={() => advance(p, 'Preparando')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500 text-white text-xs"
                        type="button"
                      >
                        Empezar <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {p.estado === 'Preparando' && (
                      <button
                        onClick={() => advance(p, 'Listo')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500 text-white text-xs"
                        type="button"
                      >
                        Listo <Check className="w-3 h-3" />
                      </button>
                    )}
                    {(p.estado === 'Pendiente' || p.estado === 'Preparando') && (
                      <button
                        onClick={() => advance(p, 'Cancelado')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-xs"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => reimprimir(p.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border)] text-xs ml-auto"
                      type="button"
                    >
                      <Printer className="w-3 h-3" /> Re-imprimir
                    </button>
                  </div>
                </li>
              ))}
              {pedidosPorEstado[estado].length === 0 && (
                <li className="text-xs text-[color:var(--text-muted)] text-center py-6">
                  Sin pedidos en este estado
                </li>
              )}
            </ul>
          </section>
        ))}
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
