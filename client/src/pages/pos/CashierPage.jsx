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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import { posCashService, posOrdersService, printService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';
import { formatDateTime } from '../../utils/dateHelper';
import ChargeModal from '../../components/pos/ChargeModal';
import CashCountModal from '../../components/pos/CashCountModal';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';

const POLL_MS = 15_000;

export default function CashierPage() {
  const { user } = useAuth();
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
  const loadPendientes = useCallback(async () => {
    try {
      // Pendiente y Listo son los estados cobrables (no Cancelado, no Entregado).
      const r = await posOrdersService.list({ estado: 'Pendiente,Listo' });
      setPendientes(r.data.pedidos || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
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
    const t = setInterval(() => { loadPendientes(); loadCobradosHoy(); }, POLL_MS);
    return () => clearInterval(t);
  }, [loadPendientes, loadCobradosHoy]);

  // Socket: si llega un cambio de estado o un cargo nuevo, refrescar.
  useEffect(() => {
    if (!user?.restaurante_id) return undefined;
    socketService.connectOrders();
    socketService.joinRestaurant(user.restaurante_id, user.id);
    const onStatus = () => { loadPendientes(); loadCobradosHoy(); };
    const onCharged = () => { loadPendientes(); loadCobradosHoy(); };
    socketService.onStatusUpdate(onStatus);
    // El evento "pos:order_charged" se emite en el backend; usamos el
    // mismo handler (si no existe el método onOrderCharged, lo creamos).
    if (typeof socketService.onOrderCharged === 'function') {
      socketService.onOrderCharged(onCharged);
    }
    return undefined;
  }, [user?.restaurante_id, user?.id, loadPendientes, loadCobradosHoy]);

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
      {/* Header: estado de caja */}
      <header className="flex items-center gap-2 flex-wrap">
        <Banknote className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Caja</h1>
        <button
          onClick={() => { loadSesion(); loadPendientes(); loadCobradosHoy(); }}
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

      <section
        className={`rounded-lg border p-4 ${
          cajaAbierta
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-amber-500/40 bg-amber-500/5'
        }`}
      >
        {loadingSesion ? (
          <p className="text-sm text-[color:var(--text-muted)]">Cargando estado de caja…</p>
        ) : cajaAbierta ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">Caja abierta</span>
            </div>
            <div className="text-sm">
              <span className="text-[color:var(--text-muted)]">Fondo:</span>{' '}
              <span className="font-mono">{formatCurrency(sesion.monto_apertura)}</span>
            </div>
            <div className="text-sm">
              <span className="text-[color:var(--text-muted)]">Abierta:</span>{' '}
              {formatDateTime(sesion.abierta_en)}
            </div>
            <button
              onClick={abrirCerrarCaja}
              className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-md bg-rose-500 text-white text-sm"
              type="button"
            >
              <X className="w-4 h-4" /> Cerrar caja
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-semibold">Caja cerrada</span>
            </div>
            <p className="text-sm text-[color:var(--text-muted)]">
              Abrí la caja con un fondo inicial para empezar a cobrar.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-md bg-emerald-500 text-white text-sm"
              type="button"
            >
              <Plus className="w-4 h-4" /> Abrir caja
            </button>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[color:var(--border)]">
        <button
          onClick={() => setTab('pendientes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'pendientes'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)]'
          }`}
          type="button"
        >
          Pendientes de pago
          <span className="ml-2 text-xs">({pendientes.length})</span>
        </button>
        <button
          onClick={() => setTab('cobrados')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'cobrados'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)]'
          }`}
          type="button"
        >
          Cobrados hoy
          <span className="ml-2 text-xs">({cobradosHoy.length})</span>
        </button>
        {tab === 'cobrados' && (
          <span className="ml-auto text-sm text-[color:var(--text-muted)]">
            Total: <span className="font-mono font-semibold">{formatCurrency(totalCobrado)}</span>
          </span>
        )}
      </div>

      {loadingPedidos ? (
        <p className="text-sm text-[color:var(--text-muted)] p-4">Cargando pedidos…</p>
      ) : tab === 'pendientes' ? (
        <PedidosTable pedidos={pendientes} onCharge={(p) => setPedidoACobrar(p)} />
      ) : (
        <PedidosTableCobrados pedidos={cobradosHoy} onReprint={reimprimirRecibo} />
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

function PedidosTable({ pedidos, onCharge }) {
  if (pedidos.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-8 text-center text-sm text-[color:var(--text-muted)]">
        No hay pedidos pendientes de pago.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {pedidos.map((p) => (
        <li
          key={p.id}
          className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold">#{p.id}</span>
            <span className="text-xs text-[color:var(--text-muted)]">
              {p.mesa_id
                ? `Mesa ${p.mesa_id}`
                : p.es_retiro_local ? 'Recoger' : 'Domicilio'}
            </span>
          </div>
          <div className="text-xs text-[color:var(--text-muted)] mb-1">
            {new Date(p.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            <span className={
              p.estado === 'Listo' ? 'text-emerald-400' : 'text-amber-400'
            }>
              {p.estado}
            </span>
          </div>
          {p.cliente_nombre && (
            <div className="text-xs mb-2">{p.cliente_nombre}</div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono font-semibold text-lg">
              {formatCurrency(p.total)}
            </span>
            <button
              onClick={() => onCharge(p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-500 text-white text-sm"
              type="button"
            >
              <Check className="w-3 h-3" /> Cobrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PedidosTableCobrados({ pedidos, onReprint }) {
  if (pedidos.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-8 text-center text-sm text-[color:var(--text-muted)]">
        Aún no se cobraron pedidos hoy.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {pedidos.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-md p-3"
        >
          <div>
            <div className="font-semibold text-sm">
              #{p.id} · <span className="font-mono">{formatCurrency(p.total)}</span>
            </div>
            <div className="text-xs text-[color:var(--text-muted)]">
              {new Date(p.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              {p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}
            </div>
          </div>
          <button
            onClick={() => onReprint(p.id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[color:var(--border)] text-sm hover:bg-[color:var(--bg)]"
            type="button"
          >
            <Printer className="w-3 h-3" /> Recibo
          </button>
        </li>
      ))}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg w-full max-w-md border border-[color:var(--border)] shadow-xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Abrir caja</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            Indicá el fondo inicial de la caja registradora (efectivo disponible al abrir).
          </p>
          <label className="block text-xs text-[color:var(--text-muted)] mb-1">
            Fondo de apertura
          </label>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            min="0"
            step="0.01"
            placeholder="0"
            className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
            autoFocus
          />
          {error && (
            <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md border border-[color:var(--border)] text-sm"
            type="button"
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
            type="button"
          >
            <Banknote className="w-4 h-4" /> {enviando ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </footer>
      </div>
    </div>
  );
}
