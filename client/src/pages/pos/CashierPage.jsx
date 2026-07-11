/**
 * Caja POS (Fase 5).
 *
 * Página principal del cajero. Tiene 3 zonas:
 *
 *   1. Header: estado de la caja de la sesión del cajero
 *      (abierta/cerrada, fondo, tiempo abierta). Si no hay sesión
 *      abierta, se muestra el botón "Abrir caja" con input de fondo.
 *
 *   2. Tabs: "Pendientes de pago" (pedidos que están Pendiente/Listo
 *      y aún no fueron Entregados) y "Cobrados hoy" (los que ya
 *      pasaron a Entregado en el día).
 *
 *   3. Click en un pedido pendiente → abre `ChargeModal` para cobrar.
 *      Click en un pedido cobrado → imprime el recibo en PDF.
 *
 * Realtime: escucha `pos:order_status_changed` y `pos:order_charged`
 * para mantener la grilla actualizada sin polling agresivo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote, RefreshCw, Receipt, Check, X, Plus, Printer,
  MapPin, ShoppingBasket, Bike, Clock, Loader2,
} from 'lucide-react';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import socketService from '../../services/socket';
import { posCashService, posOrdersService, printService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';
import { formatDateTime } from '../../utils/dateHelper';
import ChargeModal from '../../components/pos/ChargeModal';
import CashCountModal from '../../components/pos/CashCountModal';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 15_000;

function TipoIcon({ pedido }) {
  if (pedido.mesa_id) return { Icon: MapPin, label: `Mesa ${pedido.mesa_id}` };
  if (pedido.es_retiro_local) return { Icon: ShoppingBasket, label: 'Recoger' };
  return { Icon: Bike, label: 'Domicilio' };
}

const ESTADO_PILL = {
  Pendiente:  'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  Listo:      'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  Entregado:  'bg-zinc-500/15 text-zinc-200 border border-zinc-500/30',
};

export default function CashierPage() {
  // Mismo hook que KDS/OrdersList: para dueños `user.restaurante_id` es
  // null en el localStorage; el POSLayout hidrata el restaurante via
  // /api/restaurants/me y usePosRestaurante lo combina.
  const { user, restauranteId } = usePosRestaurante();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pendientes');

  // Sesión de caja
  const [sesion, setSesion] = useState(null);
  const [loadingSesion, setLoadingSesion] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  // Lo que el sistema espera que haya en la registradora AHORA
  // (fondo + Σ efectivo de cobros de esta sesión).
  const [esperadoActual, setEsperadoActual] = useState(0);

  // Pedidos
  const [pendientes, setPendientes] = useState([]);
  const [cobradosHoy, setCobradosHoy] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Cobre
  const [pedidoACobrar, setPedidoACobrar] = useState(null);
  // Recibo a reimprimir
  const [printUrl, setPrintUrl] = useState(null);

  // ===== Sesión de caja =====
  const loadSesion = useCallback(async () => {
    try {
      const r = await posCashService.currentSession();
      const s = r.data?.sesion || null;
      setSesion(s);
      // Si hay sesión abierta, refrescamos el "esperado actual" (Σ efectivo).
      if (s?.id) {
        try {
          const sum = await posCashService.sessionSummary(s.id);
          setEsperadoActual(Number(sum.data?.esperado_actual || 0));
        } catch { /* best-effort */ }
      } else {
        setEsperadoActual(0);
      }
    } catch (e) {
      // 404 = no hay sesión abierta, está OK.
      if (e.response?.status === 404) setSesion(null);
      else setError(e.response?.data?.error || e.message);
    } finally {
      setLoadingSesion(false);
    }
  }, []);

  const abrirCerrarCaja = () => {
    if (!sesion) return;
    // Antes de mostrar el modal de arqueo, refrescamos el "esperado" en vivo.
    posCashService.sessionSummary(sesion.id)
      .then((r) => setEsperadoActual(Number(r.data?.esperado_actual || 0)))
      .catch(() => { /* usamos el valor cacheado */ })
      .finally(() => setShowCloseModal(true));
  };

  useEffect(() => { loadSesion(); }, [loadSesion]);

  // ===== Pedidos =====
  const loadPendientes = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      // Pendiente y Listo son los estados cobrables (no Cancelado, no Entregado).
      const r = await posOrdersService.list({ estado: 'Pendiente,Listo' });
      setPendientes(r.data.pedidos || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const loadCobradosHoy = useCallback(async () => {
    try {
      const r = await posOrdersService.list({ estado: 'Entregado' });
      const hoy = new Date();
      // Filtrar a los del día actual (en hora local del navegador).
      const fil = (r.data.pedidos || []).filter((p) => {
        const f = new Date(p.creado_en);
        return f.getFullYear() === hoy.getFullYear()
          && f.getMonth() === hoy.getMonth()
          && f.getDate() === hoy.getDate();
      });
      setCobradosHoy(fil);
    } catch (e) {
      // No rompemos la pantalla si falla este secundario.
      console.warn('[Caja] no se pudieron cargar cobrados de hoy', e);
    }
  }, []);

  useEffect(() => {
    setLoadingPedidos(true);
    Promise.all([loadPendientes(), loadCobradosHoy()])
      .finally(() => setLoadingPedidos(false));
  }, [loadPendientes, loadCobradosHoy]);

  // Polling suave para mantener frescos los pendientes (10s del KDS es
  // demasiado rápido; caja puede refrescarse cada 15s).
  useEffect(() => {
    const t = setInterval(() => { loadPendientes(true); loadCobradosHoy(); }, POLL_MS);
    return () => clearInterval(t);
  }, [loadPendientes, loadCobradosHoy]);

  // Socket: si llega un cambio de estado o un cargo nuevo, refrescar.
  useEffect(() => {
    if (!restauranteId) return undefined;
    socketService.connectOrders();
    socketService.joinRestaurant(restauranteId, user.id);
    const onStatus = () => { loadPendientes(true); loadCobradosHoy(); };
    const onCharged = () => { loadPendientes(true); loadCobradosHoy(); };
    socketService.onStatusUpdate(onStatus);
    // El evento "pos:order_charged" se emite en el backend; usamos el
    // mismo handler (si no existe el método onOrderCharged, lo creamos).
    if (typeof socketService.onOrderCharged === 'function') {
      socketService.onOrderCharged(onCharged);
    }
    return undefined;
  }, [restauranteId, user?.id, loadPendientes, loadCobradosHoy]);

  // ===== Acciones =====
  const abrirCaja = async (montoApertura) => {
    try {
      const r = await posCashService.openSession({ monto_apertura: Number(montoApertura) || 0 });
      setSesion(r.data?.sesion || null);
      setShowOpenModal(false);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const cerrarCaja = async ({ monto_real, desglose_billetes, notas_cierre }) => {
    // Idempotency-Key: si el cajero le da click 2 veces al botón (o el
    // navegador reintenta la POST), el backend devuelve la misma respuesta
    // y no cierra la caja dos veces.
    const key = `close-${sesion.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const r = await posCashService.closeSession(
      sesion.id,
      { monto_cierre_real: monto_real, desglose_billetes, notas_cierre },
      key
    );
    // Mostramos la página de detalle del cierre.
    navigate(`/pos/caja/cierre/${sesion.id}`, { state: { sesion: r.data?.sesion } });
    setSesion(null);
  };

  const cobrarPedido = async (pedido, pagos) => {
    // El ChargeModal ya hizo la llamada. Sólo refrescamos y disparamos
    // la impresión del recibo.
    setPedidoACobrar(null);
    await Promise.all([loadPendientes(), loadCobradosHoy()]);
    // Imprimir recibo PDF.
    try {
      const r = await printService.receipt(pedido.id);
      const url = URL.createObjectURL(r.data);
      setPrintUrl(url);
    } catch (e) {
      console.warn('[Caja] no se pudo imprimir recibo', e);
    }
  };

  const reimprimirRecibo = async (pedidoId) => {
    try {
      const r = await printService.receipt(pedidoId);
      const url = URL.createObjectURL(r.data);
      setPrintUrl(url);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  // ===== Render =====
  const cajaAbierta = !!sesion;
  const totalCobrado = useMemo(
    () => cobradosHoy.reduce((s, p) => s + Number(p.total || 0), 0),
    [cobradosHoy]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          aria-hidden="true"
        >
          <Banknote className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-extrabold leading-tight">Caja</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {pendientes.length} pendientes · {cobradosHoy.length} cobrados hoy
          </p>
        </div>
        <button
          onClick={() => { loadSesion(); loadPendientes(); loadCobradosHoy(); }}
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

      {/* Estado de caja */}
      <section
        className={[
          'rounded-xl border-2 p-4 transition-colors',
          cajaAbierta
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-amber-500/40 bg-amber-500/5',
        ].join(' ')}
        aria-label="Estado de la caja"
      >
        {loadingSesion ? (
          <p className="text-sm text-[color:var(--text-muted)] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando estado de caja…
          </p>
        ) : cajaAbierta ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="font-bold text-emerald-300">Caja abierta</span>
            </div>
            <div className="text-sm">
              <span className="text-[color:var(--text-muted)]">Fondo:</span>{' '}
              <span className="font-mono font-semibold">{formatCurrency(sesion.monto_apertura)}</span>
            </div>
            <div className="text-sm flex items-center gap-1">
              <Clock className="w-3 h-3 text-[color:var(--text-muted)]" aria-hidden="true" />
              <span className="text-[color:var(--text-muted)]">Abierta:</span>{' '}
              <span>{formatDateTime(sesion.abierta_en)}</span>
            </div>
            <button
              onClick={abrirCerrarCaja}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold active:scale-95 transition-all shadow-sm"
              type="button"
            >
              <X className="w-4 h-4" /> Cerrar caja
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              <span className="font-bold text-amber-300">Caja cerrada</span>
            </div>
            <p className="text-sm text-[color:var(--text-muted)] flex-1 min-w-0">
              Abre la caja con un fondo inicial para empezar a cobrar.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold active:scale-95 transition-all shadow-sm"
              type="button"
            >
              <Plus className="w-4 h-4" /> Abrir caja
            </button>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[color:var(--border)]" role="tablist">
        {[
          { key: 'pendientes', label: 'Pendientes de pago', count: pendientes.length },
          { key: 'cobrados',   label: 'Cobrados hoy',       count: cobradosHoy.length },
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
            type="button"
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
        {tab === 'cobrados' && (
          <span className="ml-auto text-sm text-[color:var(--text-muted)] inline-flex items-center gap-2">
            Total del día:
            <span className="font-mono font-bold text-base text-[color:var(--text)]">{formatCurrency(totalCobrado)}</span>
          </span>
        )}
      </div>

      {loadingPedidos ? (
        <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Cargando pedidos…</span>
        </div>
      ) : tab === 'pendientes' ? (
        <PedidosPendientes pedidos={pendientes} onCharge={(p) => setPedidoACobrar(p)} />
      ) : (
        <PedidosCobrados pedidos={cobradosHoy} onReprint={reimprimirRecibo} />
      )}

      {/* Modales */}
      {showOpenModal && (
        <OpenCajaModal onClose={() => setShowOpenModal(false)} onConfirm={abrirCaja} />
      )}
      {showCloseModal && sesion && (
        <CashCountModal
          esperado={esperadoActual}
          onClose={() => setShowCloseModal(false)}
          onConfirm={cerrarCaja}
        />
      )}
      {pedidoACobrar && (
        <ChargeModal
          pedido={pedidoACobrar}
          onClose={() => setPedidoACobrar(null)}
          onCharged={(data) => cobrarPedido(pedidoACobrar, data)}
        />
      )}
      <AutoPrintIframe url={printUrl} onPrinted={() => {
        setTimeout(() => setPrintUrl(null), 3000);
      }} />
    </div>
  );
}

// =====================================================================
// Sub-componentes (archivo chico, sin necesidad de archivo aparte)
// =====================================================================

function PedidosPendientes({ pedidos, onCharge }) {
  if (pedidos.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border-2 border-dashed border-[color:var(--border)] rounded-xl p-10 text-center">
        <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p className="text-base font-semibold text-[color:var(--text)]">No hay pedidos pendientes</p>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          Los pedidos que estén en estado "Listo" aparecerán acá para cobrar.
        </p>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {pedidos.map((p) => {
        const { Icon, label: tipoLabel } = TipoIcon({ pedido: p });
        const pill = ESTADO_PILL[p.estado] || 'bg-zinc-500/15 text-zinc-200';
        return (
          <li
            key={p.id}
            className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-[color:var(--primary,#3b82f6)]/40 transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-base">#{p.id}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pill}`}>
                {p.estado}
              </span>
            </div>
            <div className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mb-1">
              <Icon className="w-3 h-3" aria-hidden="true" />
              {tipoLabel}
              <span aria-hidden="true">·</span>
              <span>{new Date(p.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {p.cliente_nombre && (
              <div className="text-xs text-[color:var(--text)] mb-2 truncate font-medium">{p.cliente_nombre}</div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[color:var(--border)]">
              <span className="font-mono font-extrabold text-lg">
                {formatCurrency(p.total)}
              </span>
              <button
                onClick={() => onCharge(p)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold active:scale-95 transition-all shadow-sm"
                type="button"
              >
                <Check className="w-3.5 h-3.5" /> Cobrar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PedidosCobrados({ pedidos, onReprint }) {
  if (pedidos.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border-2 border-dashed border-[color:var(--border)] rounded-xl p-10 text-center">
        <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p className="text-base font-semibold text-[color:var(--text)]">Aún no se cobraron pedidos hoy</p>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          Cuando cobres tu primer pedido, aparecerá acá.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {pedidos.map((p) => {
        const { Icon, label: tipoLabel } = TipoIcon({ pedido: p });
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl p-3 hover:border-[color:var(--primary,#3b82f6)]/40 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                <span>#{p.id}</span>
                <span className="font-mono font-extrabold text-emerald-300">{formatCurrency(p.total)}</span>
              </div>
              <div className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mt-0.5">
                <Icon className="w-3 h-3" aria-hidden="true" />
                {tipoLabel}
                <span aria-hidden="true">·</span>
                <span>{new Date(p.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                {p.cliente_nombre && <><span aria-hidden="true">·</span><span>{p.cliente_nombre}</span></>}
              </div>
            </div>
            <button
              onClick={() => onReprint(p.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors active:scale-95"
              type="button"
            >
              <Printer className="w-3.5 h-3.5" /> Recibo
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Modal minimal para abrir caja: input del fondo + confirmar.
 */
function OpenCajaModal({ onClose, onConfirm }) {
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onConfirm(monto);
    } catch (e) {
      setError(e.message || 'Error abriendo caja');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              aria-hidden="true"
            >
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-heading font-bold">Abrir caja</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            Indicá el fondo inicial de la caja registradora (efectivo disponible al abrir).
          </p>
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
              Fondo de apertura
            </span>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition"
              autoFocus
            />
          </label>
          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              {error}
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors"
            type="button"
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            {enviando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo…</>
            ) : (
              <><Banknote className="w-4 h-4" /> Abrir caja</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
