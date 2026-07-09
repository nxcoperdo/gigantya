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
import { ClipboardList, Plus, RefreshCw, Receipt, Printer, X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import { posOrdersService, printService } from '../../services/api';
import { ORDER_STATES, labelFor } from '../../utils/orderStates';
import { formatCurrency } from '../../utils/formatHelper';
import { formatDateTime } from '../../utils/dateHelper';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 15_000;
const TAB_ACTIVOS = ['Pendiente', 'Preparando', 'Listo'];
const TAB_CERRADOS = ['Entregado', 'Cancelado'];

export default function OrdersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('activos');
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detalle, setDetalle] = useState(null); // pedido expandido
  const [printUrl, setPrintUrl] = useState(null);

  const fetchPedidos = useCallback(async () => {
    if (!user?.restaurante_id) {
      setError('Tu cuenta no está asociada a un restaurante. Pídele al dueño que te invite desde Personal.');
      setLoading(false);
      return;
    }
    try {
      const r = await posOrdersService.list({});
      setPedidos(r.data.pedidos || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  }, [user?.restaurante_id]);

  useEffect(() => {
    fetchPedidos();
    const t = setInterval(fetchPedidos, POLL_MS);
    return () => clearInterval(t);
  }, [fetchPedidos]);

  // Socket: refrescar al crear/cambiar estado
  useEffect(() => {
    if (!user?.restaurante_id) return;
    socketService.connectOrders();
    socketService.joinRestaurant(user.restaurante_id, user.id);
    const handler = () => fetchPedidos();
    socketService.onPosOrderCreated(handler);
    socketService.onStatusUpdate(handler);
  }, [user?.restaurante_id, user?.id, fetchPedidos]);

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
    if (!confirm(`¿Cancelar el pedido #${pedido.id}?`)) return;
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

  if (loading) {
    return <div className="p-8 text-center text-[color:var(--text-muted)]">Cargando pedidos…</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <header className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <button
          onClick={() => navigate('/pos/pedidos/nuevo')}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Tomar pedido
        </button>
        <button
          onClick={fetchPedidos}
          className="p-2 rounded hover:bg-[color:var(--bg-elevated)]"
          type="button"
          aria-label="Refrescar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[color:var(--border)]">
        <button
          onClick={() => setTab('activos')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            tab === 'activos'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)]'
          }`}
        >
          Activos ({pedidos.filter((p) => TAB_ACTIVOS.includes(p.estado)).length})
        </button>
        <button
          onClick={() => setTab('cerrados')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            tab === 'cerrados'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)]'
          }`}
        >
          Cerrados ({pedidos.filter((p) => TAB_CERRADOS.includes(p.estado)).length})
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Lista */}
        <ul className={`space-y-2 ${detalle ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {pedidosFiltrados.length === 0 && (
            <li className="text-center py-8 text-[color:var(--text-muted)] text-sm">
              No hay pedidos en esta vista.
            </li>
          )}
          {pedidosFiltrados.map((p) => (
            <li
              key={p.id}
              className={`bg-[color:var(--bg-elevated)] border rounded-lg p-3 cursor-pointer transition-colors ${
                detalle?.id === p.id
                  ? 'border-primary'
                  : 'border-[color:var(--border)] hover:border-primary/50'
              }`}
              onClick={() => setDetalle(p)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold">#{p.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.estado === 'Cancelado' ? 'bg-rose-500/20 text-rose-300' :
                  p.estado === 'Entregado' ? 'bg-emerald-500/20 text-emerald-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {labelFor(p.estado)}
                </span>
              </div>
              <div className="text-xs text-[color:var(--text-muted)] flex items-center justify-between">
                <span>
                  {p.mesa_id ? `Mesa ${p.mesa_id}` : p.es_retiro_local ? 'Recoger' : 'Domicilio'}
                  {p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}
                </span>
                <span>{formatCurrency(p.total)}</span>
              </div>
              <div className="text-xs text-[color:var(--text-muted)] mt-1">
                {formatDateTime(p.creado_en)}
              </div>
            </li>
          ))}
        </ul>

        {/* Detalle */}
        {detalle && (
          <aside className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-3 space-y-2 lg:sticky lg:top-4 h-fit">
            <header className="flex items-center justify-between">
              <h2 className="font-bold">Pedido #{detalle.id}</h2>
              <button onClick={() => setDetalle(null)} className="p-1 rounded hover:bg-[color:var(--bg)]">
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="text-xs text-[color:var(--text-muted)]">
              {formatDateTime(detalle.creado_en)} · {labelFor(detalle.estado)}
            </div>
            <ul className="text-sm space-y-1 border-y border-[color:var(--border)] py-2">
              {(detalle.items || []).map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.cantidad}× {it.nombre || it.producto_nombre}</span>
                  <span className="text-[color:var(--text-muted)]">{formatCurrency(it.subtotal || it.precio_total)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(detalle.total)}</span>
            </div>
            {detalle.notas && (
              <div className="text-xs italic text-amber-600">Nota: {detalle.notas}</div>
            )}
            <div className="flex flex-wrap gap-1 pt-2">
              <button
                onClick={() => reimprimir(detalle.id, 'kitchen')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[color:var(--bg)] border border-[color:var(--border)] text-xs"
              >
                <Printer className="w-3 h-3" /> Comanda
              </button>
              <button
                onClick={() => reimprimir(detalle.id, 'receipt')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[color:var(--bg)] border border-[color:var(--border)] text-xs"
              >
                <Receipt className="w-3 h-3" /> Recibo
              </button>
              {detalle.estado === 'Listo' && (
                <button
                  onClick={() => marcarEntregado(detalle)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500 text-white text-xs ml-auto"
                >
                  <Check className="w-3 h-3" /> Entregado
                </button>
              )}
              {['Pendiente', 'Preparando'].includes(detalle.estado) && (
                <button
                  onClick={() => cancelar(detalle)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-xs"
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
