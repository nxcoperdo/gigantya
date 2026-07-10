/**
 * Lista de pedidos POS (Fase 3 — era placeholder POSComingSoon).
 *
 * Pestañas por estado:
 *   - Activos  : Pendiente | Preparando | Listo
 *   - Cerrados : Entregado | Cancelado
 *
 * Muestra pedidos del restaurante del staff (el backend ya filtra por
 * `restaurante_id` a partir del token). Click en un pedido → panel de
 * detalle inline con items. Botón "Tomar pedido" navega a /pos/pedidos/nuevo.
 *
 * Diferencia con KDSPage: este es el "panel del mesero/cajero" — muestra
 * TODOS los pedidos (incluyendo los cobrados y cancelados del día) para
 * poder reimprimir o consultar. El KDS solo muestra los 3 estados de cocina.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, RefreshCw, Receipt, Printer, X, Check, MapPin, ShoppingBasket, Bike } from 'lucide-react';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import socketService from '../../services/socket';
import { posOrdersService, printService } from '../../services/api';
import { labelFor } from '../../utils/orderStates';
import { formatCurrency } from '../../utils/formatHelper';
import { formatDateTime } from '../../utils/dateHelper';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 15_000;
const TAB_ACTIVOS = ['Pendiente', 'Preparando', 'Listo'];
const TAB_CERRADOS = ['Entregado', 'Cancelado'];

const ESTADO_PILL = {
  Pendiente:  'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  Preparando: 'bg-blue-500/15 text-blue-200 border border-blue-500/30',
  Listo:      'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  Entregado:  'bg-zinc-500/15 text-zinc-200 border border-zinc-500/30',
  Cancelado:  'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

function TipoIcon({ pedido }) {
  if (pedido.mesa_id) return { Icon: MapPin, label: `Mesa ${pedido.mesa_id}` };
  if (pedido.es_retiro_local) return { Icon: ShoppingBasket, label: 'Recoger' };
  return { Icon: Bike, label: 'Domicilio' };
}

export default function OrdersListPage() {
  // Mismo hook que KDSPage: combina user.restaurante_id (staff) con el
  // restaurante hidratado del Outlet context (dueños). Sin esto, un
  // dueño ve "no estás asociado a un restaurante" en cada página POS.
  const { user, restauranteId } = usePosRestaurante();
  const navigate = useNavigate();
  const [tab, setTab] = useState('activos');
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [detalle, setDetalle] = useState(null); // pedido expandido
  const [printUrl, setPrintUrl] = useState(null);

  const fetchPedidos = useCallback(async (silent = false) => {
    if (!restauranteId) {
      setError('Tu cuenta no está asociada a un restaurante. Pídele al dueño que te invite desde Personal.');
      setLoading(false);
      return;
    }
    if (!silent) setRefreshing(true);
    try {
      const r = await posOrdersService.list({});
      setPedidos(r.data.pedidos || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error cargando pedidos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restauranteId]);

  useEffect(() => {
    fetchPedidos();
    const t = setInterval(fetchPedidos, POLL_MS);
    return () => clearInterval(t);
  }, [fetchPedidos]);

  // Socket: refrescar al crear/cambiar estado
  useEffect(() => {
    if (!restauranteId) return;
    socketService.connectOrders();
    socketService.joinRestaurant(restauranteId, user.id);
    const handler = () => fetchPedidos(true);
    socketService.onPosOrderCreated(handler);
    socketService.onStatusUpdate(handler);
  }, [restauranteId, user?.id, fetchPedidos]);

  const reimprimir = useCallback(async (pedidoId, tipo = 'kitchen') => {
    try {
      const r = tipo === 'receipt'
        ? await printService.receipt(pedidoId)
        : await printService.kitchenTicket(pedidoId);
      const url = URL.createObjectURL(r.data);
      setPrintUrl(url);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo reimprimir');
    }
  }, []);

  const cancelar = useCallback(async (pedido) => {
    if (!window.confirm(`¿Cancelar el pedido #${pedido.id}?`)) return;
    try {
      await posOrdersService.updateStatus(pedido.id, 'Cancelado');
      fetchPedidos();
      setDetalle(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cancelar');
    }
  }, [fetchPedidos]);

  const marcarEntregado = useCallback(async (pedido) => {
    try {
      await posOrdersService.updateStatus(pedido.id, 'Entregado');
      fetchPedidos();
      setDetalle(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo marcar como entregado');
    }
  }, [fetchPedidos]);

  const pedidosFiltrados = useMemo(() => {
    const estados = tab === 'activos' ? TAB_ACTIVOS : TAB_CERRADOS;
    return pedidos
      .filter((p) => estados.includes(p.estado))
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
  }, [pedidos, tab]);

  const countActivos = useMemo(() => pedidos.filter((p) => TAB_ACTIVOS.includes(p.estado)).length, [pedidos]);
  const countCerrados = useMemo(() => pedidos.filter((p) => TAB_CERRADOS.includes(p.estado)).length, [pedidos]);

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
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-extrabold leading-tight">Pedidos</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {countActivos} activos · {countCerrados} cerrados
          </p>
        </div>
        <button
          onClick={() => navigate('/pos/pedidos/nuevo')}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Tomar pedido
        </button>
        <button
          onClick={() => fetchPedidos()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm font-medium hover:bg-[color:var(--bg)] transition-colors disabled:opacity-50"
          type="button"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[color:var(--border)]" role="tablist">
        {[
          { key: 'activos',  label: 'Activos',  count: countActivos },
          { key: 'cerrados', label: 'Cerrados', count: countCerrados },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-2',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
            ].join(' ')}
          >
            {t.label}
            <span className={[
              'text-[10px] font-bold rounded-full px-1.5 py-0.5',
              tab === t.key ? 'bg-primary/15' : 'bg-[color:var(--bg-elevated)]',
            ].join(' ')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline font-medium hover:no-underline">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Lista */}
        <ul className={`space-y-2 ${detalle ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {pedidosFiltrados.length === 0 && (
            <li className="flex flex-col items-center justify-center text-center py-12 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-xl">
              <ClipboardList className="w-8 h-8 mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">No hay pedidos en esta vista</p>
              <p className="text-xs mt-1">
                {tab === 'activos' ? 'Tocá "Tomar pedido" para crear uno.' : 'Los pedidos cerrados aparecerán acá.'}
              </p>
            </li>
          )}
          {pedidosFiltrados.map((p) => {
            const { Icon, label: tipoLabel } = TipoIcon({ pedido: p });
            const pill = ESTADO_PILL[p.estado] || 'bg-zinc-500/15 text-zinc-200';
            const isSelected = detalle?.id === p.id;
            return (
              <li
                key={p.id}
                className={[
                  'bg-[color:var(--bg-elevated)] border rounded-xl p-3 cursor-pointer transition-all',
                  isSelected
                    ? 'border-primary shadow-md ring-1 ring-primary/30'
                    : 'border-[color:var(--border)] hover:border-primary/50 hover:shadow-sm',
                ].join(' ')}
                onClick={() => setDetalle(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalle(p); } }}
                aria-label={`Pedido #${p.id} ${labelFor(p.estado)}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-base">#{p.id}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pill}`}>
                    {labelFor(p.estado)}
                  </span>
                </div>
                <div className="text-xs text-[color:var(--text-muted)] flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    {tipoLabel}
                    {p.cliente_nombre && <span className="opacity-70">· {p.cliente_nombre}</span>}
                  </span>
                  <span className="font-mono font-semibold text-[color:var(--text)]">{formatCurrency(p.total)}</span>
                </div>
                <div className="text-[10px] text-[color:var(--text-muted)] mt-1">
                  {formatDateTime(p.creado_en)}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Detalle */}
        {detalle && (
          <aside className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl p-4 space-y-3 lg:sticky lg:top-4 h-fit shadow-sm animate-fadeIn">
            <header className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-heading font-bold text-lg">Pedido #{detalle.id}</h2>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {formatDateTime(detalle.creado_en)} · {labelFor(detalle.estado)}
                </p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="p-1.5 rounded-md hover:bg-[color:var(--bg)] transition-colors"
                type="button"
                aria-label="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <ul className="text-sm space-y-1.5 border-y border-[color:var(--border)] py-3">
              {(detalle.items || []).map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span className="text-[color:var(--text)]">
                    <span className="font-semibold">{it.cantidad}×</span> {it.nombre || it.producto_nombre}
                  </span>
                  <span className="text-[color:var(--text-muted)] font-mono shrink-0">
                    {formatCurrency(it.subtotal || it.precio_total)}
                  </span>
                </li>
              ))}
              {(detalle.items || []).length === 0 && (
                <li className="text-xs text-[color:var(--text-muted)] italic text-center py-2">
                  Sin items registrados
                </li>
              )}
            </ul>
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(detalle.total)}</span>
            </div>
            {detalle.notas && (
              <div className="text-xs italic text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5 leading-snug">
                Nota: {detalle.notas}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => reimprimir(detalle.id, 'kitchen')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[color:var(--bg)] hover:bg-[color:var(--bg-hover)] border border-[color:var(--border)] text-xs font-medium transition-colors"
                type="button"
              >
                <Printer className="w-3 h-3" /> Comanda
              </button>
              <button
                onClick={() => reimprimir(detalle.id, 'receipt')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[color:var(--bg)] hover:bg-[color:var(--bg-hover)] border border-[color:var(--border)] text-xs font-medium transition-colors"
                type="button"
              >
                <Receipt className="w-3 h-3" /> Recibo
              </button>
              {detalle.estado === 'Listo' && (
                <button
                  onClick={() => marcarEntregado(detalle)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold ml-auto transition-colors active:scale-95"
                  type="button"
                >
                  <Check className="w-3 h-3" /> Entregado
                </button>
              )}
              {['Pendiente', 'Preparando'].includes(detalle.estado) && (
                <button
                  onClick={() => cancelar(detalle)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition-colors"
                  type="button"
                >
                  <X className="w-3 h-3" /> Cancelar
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      <AutoPrintIframe url={printUrl} onPrinted={() => setTimeout(() => setPrintUrl(null), 3000)} />
    </div>
  );
}
