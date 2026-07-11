import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService, orderService, productService, couponService, restaurantService, paymentService, exportService, userService } from '../services/api';
import Loading from '../components/Loading';
import ProductModal from '../components/ProductModal';
import RestaurantModal from '../components/RestaurantModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import CouponsView from '../components/CouponsView';
import PaymentTabs from '../components/PaymentTabs';
import PageBuilder from '../components/PageBuilder';
import RestaurantShippingTaxModal from '../components/RestaurantShippingTaxModal';
import OnboardingTip from '../components/help/OnboardingTip';
import DashboardHelpBanner from '../components/help/DashboardHelpBanner';
import DashboardTour from '../components/help/DashboardTour';
import ReactivateHelpMenuItem from '../components/help/ReactivateHelpMenuItem';
import { getPlanLimit } from '../utils/planFeatures';
import {
  LayoutDashboard,
  Clock3,
  CheckCircle,
  Package,
  RefreshCcw,
  AlertCircle,
  ArrowUpRight,
  ToggleLeft,
  ToggleRight,
  UtensilsCrossed,
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  Settings,
  Eye,
  Image as ImageIcon,
  BarChart3,
  Banknote,
  ShieldCheck,
  Ticket,
  FileText,
  Palette,
  Users,
  TrendingUp,
  Lock,
  Truck,
  DollarSign,
  Store,
  Printer,
} from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatDate, formatDateTime, formatShortDate } from '../utils/dateHelper';

// Estilos de estado de pedido: usan vars semánticas (legibles en dark mode).
// Devuelven {backgroundColor, color, borderColor} para pasar a style={}.
const ORDER_STATE_STYLES = {
  Pendiente:         { backgroundColor: 'var(--warning-bg)',  color: 'var(--warning-text)',  borderColor: 'var(--warning-border)' },
  Preparando:        { backgroundColor: 'var(--info-bg)',     color: 'var(--info-text)',     borderColor: 'var(--info-border)' },
  Listo:             { backgroundColor: 'var(--accent-purple-bg)', color: 'var(--accent-purple-text)', borderColor: 'var(--accent-purple-border, var(--border-subtle))' },
  Entregado:         { backgroundColor: 'var(--success-bg)',  color: 'var(--success-text)',  borderColor: 'var(--success-border)' },
  Cancelado:         { backgroundColor: 'var(--danger-bg)',   color: 'var(--danger-text)',   borderColor: 'var(--danger-border)' },
  'Comprobante Enviado': { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' },
  'Pago Confirmado': { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' },
  'Pago Rechazado':  { backgroundColor: 'var(--danger-bg)',  color: 'var(--danger-text)',  borderColor: 'var(--danger-border)' },
};

const NEXT_STATUS_BY_STATE = {
  Pendiente: 'Preparando',
  Preparando: 'Listo',
  Listo: 'Entregado',
};

const PAYMENT_METHOD_LABELS = {
  contra_entrega: 'Contra entrega',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bre_b: 'BreezB',
};

function OrderCard({ order, updatingOrderId, handleStatusChange, handleCancelOrder, onViewDetails, onPrint, isMuted = false }) {
  const nextStatus = NEXT_STATUS_BY_STATE[order.estado];
  return (
    <article className={`border border-[color:var(--border-default)] rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-[color:var(--bg-elevated)] hover:shadow-md hover:border-[color:var(--border-strong)] transition-all duration-200 ${isMuted ? 'opacity-80 grayscale-[0.2]' : ''}`}>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-primary)]">Pedido #{order.id}</h3>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold border tabular-nums"
              style={ORDER_STATE_STYLES[order.estado] || { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
            >
              {order.estado}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] border border-[color:var(--border-default)] flex items-center gap-1">
              <Banknote size={14} />
              <span className="hidden xs:inline">{PAYMENT_METHOD_LABELS[order.metodo_pago] || order.metodo_pago || 'No definido'}</span>
              <span className="xs:hidden">{(PAYMENT_METHOD_LABELS[order.metodo_pago] || order.metodo_pago || 'No definido').slice(0, 8)}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            <p className="text-[color:var(--text-secondary)]">Cliente: <span className="font-semibold text-[color:var(--text-primary)]">{order.cliente_nombre || 'Sin nombre'}</span></p>
            <p className="text-[color:var(--text-secondary)]">Teléfono: {order.cliente_telefono || 'No disponible'}</p>
          </div>
          {/* Indicador de modalidad del pedido (persistido en
              pedidos.es_retiro_local / pedidos.es_consumo_en_local al
              momento de crear el pedido):
              - es_consumo_en_local = 1 → "Consumo en el local" (badge)
              - es_retiro_local = 1     → "Retira en local" (badge)
              - ambos = 0                → muestra dirección de envío + costo
              Precedencia: consumo en local > retiro > envío (un pedido
              no puede ser de las 2 modalidades sin envío a la vez, pero
              por las dudas validamos la primera primero).
              Usamos las columnas persistidas en lugar del flag actual
              del local para que el badge siga siendo correcto aunque
              el local cambie sus flags después de tomar el pedido. */}
          {(order.es_consumo_en_local === true || Number(order.es_consumo_en_local) === 1) ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border w-fit"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' }}
            >
              <UtensilsCrossed size={12} />
              Consumo en el local
            </span>
          ) : (order.es_retiro_local === true || Number(order.es_retiro_local) === 1) ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border w-fit"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' }}
            >
              <Store size={12} />
              Retira en local
            </span>
          ) : (
            <p className="text-sm text-[color:var(--text-secondary)]">
              Enviar a: <span className="font-semibold text-[color:var(--text-primary)]">{order.direccion_entrega || 'Sin dirección'}</span>
              {order.barrio_nombre && ` · ${order.barrio_nombre}`}
              {order.sector_nombre && `, ${order.sector_nombre}`}
              {Number(order.costo_envio) > 0 && ` (envío: $${Number(order.costo_envio).toLocaleString('es-CO')})`}
            </p>
          )}
          <p className="text-[color:var(--text-secondary)] text-sm">Fecha: {formatDateTime(order.creado_en)}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[color:var(--border-subtle)]">
          <div className="space-y-1">
            <p className="text-xl sm:text-2xl font-heading font-bold text-primary">${Number(order.total || 0).toLocaleString('es-CO')}</p>
            <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">{order.items_count || 0} producto(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onViewDetails(order)}
              className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
              title="Ver detalles del pedido"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">Detalles</span>
            </button>
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(order)}
                className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
                title="Imprimir pedido"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            )}
            {nextStatus && (
              <button
                type="button"
                disabled={updatingOrderId === order.id}
                onClick={() => handleStatusChange(order.id, nextStatus)}
                className="btn btn-primary btn-small inline-flex items-center gap-1.5 min-h-[40px] flex-1 sm:flex-none justify-center"
              >
                {updatingOrderId === order.id ? '...' : `Pasar a ${nextStatus}`}
              </button>
            )}
            <button
              type="button"
              disabled={updatingOrderId === order.id}
              onClick={() => handleStatusChange(order.id, 'Entregado')}
              className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
              title="Marcar entregados"
            >
              <CheckCircle size={14} />
              <span className="hidden sm:inline">Entregar</span>
            </button>
            {order.estado !== 'Entregado' && (
              <button
                type="button"
                disabled={updatingOrderId === order.id}
                onClick={() => handleCancelOrder(order.id)}
                className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
                style={{ color: 'var(--danger-text)' }}
                title="Cancelar pedido"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, action, reason, onReasonChange }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-scaleUp">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-[color:var(--text-primary)] mb-2">{title}</h3>
          <p className="text-[color:var(--text-secondary)] mb-6">{message}</p>

          {action === 'cancel' && (
            <div className="text-left mb-6">
              <label className="block text-sm font-bold text-[color:var(--text-secondary)] mb-2">
                Motivo de la cancelación *
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                className="w-full p-3 border-2 border-[color:var(--border-default)] rounded-xl bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:border-primary outline-none transition-colors min-h-[100px] text-sm"
                placeholder="Ej: El cliente canceló por teléfono, falta de ingredientes, etc."
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RestaurantDashboardPage() {
  const [profileLoading, setProfileLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [togglingProductId, setTogglingProductId] = useState(null);
  const [error, setError] = useState('');
  // `authUser` es el usuario cacheado en AuthContext (cargado al login,
  // refrescado en cada navegación). Lo usamos como fallback inmediato
  // para `restaurant.plan` mientras `loadProfile` corre, evitando que se
  // muestren bloqueos de "Premium requerido" durante el primer render.
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [restaurant, setRestaurant] = useState(authUser?.restaurante || null);
  const [statsData, setStatsData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [pendingProofsCount, setPendingProofsCount] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  // Tour guiado: se dispara desde el banner o desde el FAB `?`.
  // Usamos un counter para forzar remontaje del modal cuando se
  // reabre (así el state interno de DashboardTour resetea a step 0).
  const [tourKey, setTourKey] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [isShippingTaxModalOpen, setIsShippingTaxModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, orderId: null, nextStatus: null, action: 'status' });
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [autoPrintOrder, setAutoPrintOrder] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const ordersPollingRef = useRef(null);
  const ordersRequestInFlightRef = useRef(false);

  const handleExport = async (type, format) => {
    try {
      setExporting(true);
      setExportError('');

      let response;
      if (type === 'stats') {
        response = format === 'pdf'
          ? await exportService.exportStatsPDF(30)
          : await exportService.exportStatsExcel(30);
      } else {
        response = format === 'pdf'
          ? await exportService.exportOrdersPDF('todos', 100)
          : await exportService.exportOrdersExcel('todos', 500);
      }

      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      const extension = format === 'excel' ? 'xlsx' : format;
      link.download = `${type}_gigantya_${date}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando:', error);
      setExportError('No se pudo exportar el archivo. Intente nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  // Capa 3 del manual contextual: marca `ultimo_acceso_dashboard` cada
  // vez que el dueño abre esta pantalla. Es el flag que mira el cron
  // semanal para decidir si mandar el email de repaso. Fire-and-forget:
  // si falla (sin red, server caído) la app sigue funcionando; la
  // próxima visita lo reintenta.
  //
  // Throttle: solo escribimos si pasaron al menos 60s desde la última
  // actualización. Evita golpear la BD con un PUT cada vez que el user
  // navega entre tabs del dashboard (Pedidos → Gestión → Stats → ...).
  useEffect(() => {
    const ULTIMO_ACCESO_KEY = 'gigantya_ultimo_acceso_dashboard_ts';
    const MIN_INTERVAL_MS = 60_000;

    const lastTs = Number(localStorage.getItem(ULTIMO_ACCESO_KEY) || 0);
    const now = Date.now();
    if (now - lastTs < MIN_INTERVAL_MS) return;

    localStorage.setItem(ULTIMO_ACCESO_KEY, String(now));
    userService
      .setOnboardingKey('ultimo_acceso_dashboard', new Date().toISOString())
      .catch((err) => {
        // Rollback del throttle para reintentar la próxima vez
        localStorage.removeItem(ULTIMO_ACCESO_KEY);
        console.warn('[dashboard] no se pudo marcar ultimo_acceso_dashboard:', err?.response?.data?.error || err.message);
      });
  }, []);

  // Auto-tour la primera vez. Si el estado del banner es 'new' y nunca
  // se completó el tour, abrimos el modal automáticamente después de
  // 1.2s (le da tiempo al dueño a ver el header + el banner antes de
  // que el tour le tape la pantalla).
  //
  // La condición se evalúa 1 sola vez por mount del dashboard. Si el
  // user navega a /pos y vuelve, vuelve a entrar acá — pero para ese
  // momento el banner ya cambió a 'active' (se setea al clickear
  // "Iniciar tour" o al cerrar el tour) y no se vuelve a abrir solo.
  const autoTourFiredRef = useRef(false);
  useEffect(() => {
    if (autoTourFiredRef.current) return;
    const state = authUser?.otros_datos?.onboarding?.dashboard_help_banner_state;
    const tourDone = !!authUser?.otros_datos?.onboarding?.dashboard_tour_completed;
    if (state !== 'new' || tourDone) return;
    autoTourFiredRef.current = true;
    const t = setTimeout(() => {
      setTourKey((k) => k + 1);
      setTourOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [authUser]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setError('');
        setProfileLoading(true);
        const response = await authService.getProfile();
        const usuario = response.data?.usuario || null;
        setProfile(usuario);
        setRestaurant(usuario?.restaurante || null);

        if (usuario?.restaurante?.plan && usuario.restaurante.plan !== 'basico') {
          try {
            const statsRes = await restaurantService.getStats();
            setStatsData(statsRes.data?.estadisticas || null);
          } catch (e) {
            console.error('Error cargando estadísticas avanzadas:', e);
          }
        }
      } catch (err) {
        console.error('Error cargando perfil del restaurante:', err);
        setError(err.response?.data?.error || 'No se pudo cargar la información del local');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
    loadPendingProofsCount();
  }, []);

  const loadOrders = async ({ silent = false } = {}) => {
    if (!restaurant?.id || ordersRequestInFlightRef.current) return;

    try {
      ordersRequestInFlightRef.current = true;
      if (!silent) setError('');
      if (!silent) setOrdersLoading(true);

      const response = await orderService.getRestaurantOrders({});
      setOrders(response.data?.pedidos || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Error cargando pedidos del restaurante:', err);
      if (!silent) {
        setError(err.response?.data?.error || 'No se pudieron cargar los pedidos');
      }
    } finally {
      ordersRequestInFlightRef.current = false;
      if (!silent) setOrdersLoading(false);
    }
  };

  const loadPendingProofsCount = async () => {
    try {
      const response = await paymentService.getPendingProofs();
      setPendingProofsCount(response.data?.comprobantes?.length || 0);
    } catch (err) {
      console.error('Error cargando contador de comprobantes:', err);
    }
  };

  useEffect(() => {
    if (!restaurant?.id) return;

    loadOrders();
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id) return;

    if (ordersPollingRef.current) {
      clearInterval(ordersPollingRef.current);
      ordersPollingRef.current = null;
    }

    ordersPollingRef.current = setInterval(() => {
      loadOrders({ silent: true });
      loadPendingProofsCount();
    }, 7000);

    return () => {
      if (ordersPollingRef.current) {
        clearInterval(ordersPollingRef.current);
        ordersPollingRef.current = null;
      }
    };
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id) return;

    const loadProducts = async () => {
      try {
        setError('');
        setProductsLoading(true);
        const response = await productService.getByRestaurant(restaurant.id);
        setProducts(response.data?.productos || response.data || []);
        setLastRefreshedAt(new Date());
      } catch (err) {
        console.error('Error cargando productos del restaurante:', err);
        setError(err.response?.data?.error || 'No se pudieron cargar los productos');
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, [restaurant?.id]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((order) => order.estado === 'Pendiente').length;
    const preparingOrders = orders.filter((order) => order.estado === 'Preparando').length;
    const deliveredOrders = orders.filter((order) => order.estado === 'Entregado').length;
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const activeProducts = products.filter((product) => product.disponible === 1 || product.disponible === true).length;

    return {
      totalOrders,
      pendingOrders,
      preparingOrders,
      deliveredOrders,
      revenue,
      activeProducts,
    };
  }, [orders, products]);

  const refreshData = async () => {
    if (!restaurant?.id) return;

    try {
      setError('');
      setOrdersLoading(true);
      setProductsLoading(true);
      const [ordersResponse, productsResponse] = await Promise.all([
        orderService.getRestaurantOrders({}),
        productService.getByRestaurant(restaurant.id),
      ]);

      setOrders(ordersResponse.data?.pedidos || []);
      setProducts(productsResponse.data?.productos || productsResponse.data || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Error refrescando dashboard de restaurante:', err);
      setError(err.response?.data?.error || 'No se pudo refrescar la información');
    } finally {
      setOrdersLoading(false);
      setProductsLoading(false);
    }
  };

  const handleStatusChange = (orderId, nextStatus) => {
    setConfirmAction({
      isOpen: true,
      orderId,
      nextStatus,
      action: 'status',
    });
  };

  const handleCancelOrder = (orderId) => {
    setConfirmAction({
      isOpen: true,
      orderId,
      action: 'cancel',
    });
    setCancellationReason('');
  };

  const confirmStatusChange = async () => {
    const { orderId, nextStatus, action } = confirmAction;
    if (!orderId) return;

    try {
      setError('');
      setUpdatingOrderId(orderId);

      if (action === 'cancel') {
        if (!cancellationReason || cancellationReason.trim().length < 3) {
          setError('El motivo de cancelación es obligatorio y debe tener al menos 3 caracteres');
          return;
        }
        await orderService.cancelOrder(orderId, { motivo: cancellationReason });
      } else if (nextStatus) {
        await orderService.updateStatus(orderId, nextStatus);
      }

      await refreshData();
      setConfirmAction({ isOpen: false, orderId: null, nextStatus: null, action: 'status' });
      setCancellationReason('');
    } catch (err) {
      console.error('Error procesando acción del pedido:', err);
      setError(err.response?.data?.error || err.response?.data?.detalles || 'Hubo un error al procesar la solicitud');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleToggleProduct = async (productId) => {
    try {
      setError('');
      setTogglingProductId(productId);
      await productService.toggle(productId);
      await refreshData();
    } catch (err) {
      console.error('Error actualizando producto:', err);
      setError(err.response?.data?.error || 'No se pudo cambiar la disponibilidad del producto');
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleSaveProduct = async () => {
    await refreshData();
  };

  const handleSaveRestaurant = async (updatedRestaurantData) => {
    if (updatedRestaurantData) {
      setRestaurant((prev) => ({ ...prev, ...updatedRestaurantData }));
    }
    await refreshData();
  };

  const openProductModal = (product = null) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) return;

    try {
      setError('');
      setDeletingProductId(productId);
      await productService.delete(productId);
      await refreshData();
    } catch (err) {
      console.error('Error eliminando producto:', err);
      setError(err.response?.data?.error || 'No se pudo eliminar el producto');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleViewOrderDetails = (order) => {
    setSelectedOrderForDetails(order);
    setAutoPrintOrder(false);
    setIsOrderDetailsModalOpen(true);
  };

  // Abre el modal de detalles con autoPrint=true: el modal dispara
  // window.print() una vez que los datos están cargados.
  const handlePrintOrder = (order) => {
    setSelectedOrderForDetails(order);
    setAutoPrintOrder(true);
    setIsOrderDetailsModalOpen(true);
  };

  const closeOrderDetailsModal = () => {
    setIsOrderDetailsModalOpen(false);
    setAutoPrintOrder(false);
  };

  if (profileLoading) {
    return <Loading />;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)] py-12 md:py-20 flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center animate-fadeIn">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary/10 mb-6">
            <AlertCircle size={48} className="text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-[color:var(--text-primary)] mb-4 tracking-tight">
            No tienes un local asociado
          </h1>
          <div className="w-20 h-1 bg-gradient-primary rounded-full mx-auto mb-5"></div>
          <p className="text-[color:var(--text-secondary)] max-w-xl mx-auto mb-6 leading-relaxed">
            Tu cuenta está registrada como local, pero todavía no hay un perfil de local configurado.
            Contacta al equipo administrativo para habilitar tu panel operativo.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--bg-elevated)] border border-[color:var(--border-default)] text-sm text-[color:var(--text-secondary)]">
            <span className="text-[color:var(--text-muted)]">Usuario:</span>
            <span className="font-bold text-[color:var(--text-primary)]">{profile?.nombre}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 space-y-4 sm:space-y-6 md:space-y-8">
        <section className="card-lg relative overflow-hidden bg-gradient-to-br from-[color:var(--bg-elevated)] to-red-50/60">
          {/* Decoración esquina */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--color-primary), transparent 70%)' }}
          />
          <div className="flex flex-col gap-4 sm:gap-6 relative">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm mb-3 ring-1 ring-primary/15">
                <LayoutDashboard size={16} />
                Dashboard del local
                {restaurant.plan && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[color:var(--bg-elevated)] text-primary text-[10px] uppercase font-extrabold shadow-sm border border-primary/20 tracking-wide">
                    Plan {restaurant.plan}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-extrabold text-[color:var(--text-primary)] mb-2 break-words tracking-tight">
                {restaurant.nombre}
              </h1>
              <p className="text-[color:var(--text-secondary)] text-sm sm:text-base max-w-2xl">
                Gestiona tu negocio de manera eficiente desde un solo lugar.
              </p>
              {/* Item de menú "Activar ayuda de nuevo" — solo se muestra
                  si el dueño descartó el banner de ayuda en algún momento. */}
              <div className="mt-2">
                <ReactivateHelpMenuItem
                  onActivated={() => {
                    setTourKey((k) => k + 1);
                    setTourOpen(true);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-4">
              {/* Mobile: Scrollable tabs */}
              <div className="flex overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-hide gap-2">
                <button
                  onClick={() => setActiveTab('orders')}
                  data-tour="dashboard-tab-pedidos"
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                      : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <ClipboardList size={16} />
                  Pedidos
                  {stats.pendingOrders > 0 && (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('management')}
                  data-tour="dashboard-tab-gestion"
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    activeTab === 'management'
                      ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                      : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <Settings size={16} />
                  Gestión
                </button>
                <button
                  onClick={() => {
                    setActiveTab('payments');
                    setPendingProofsCount(0);
                  }}
                  data-tour="dashboard-tab-pagos"
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    activeTab === 'payments'
                      ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                      : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <FileText size={16} />
                  Pagos
                  {pendingProofsCount > 0 && (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('coupons')}
                  data-tour="dashboard-tab-cupones"
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    activeTab === 'coupons'
                      ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                      : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <Ticket size={16} />
                  Cupones
                </button>
                {restaurant?.plan && restaurant.plan !== 'basico' && (
                  <>
                    <button
                      onClick={() => setActiveTab('builder')}
                      className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'builder'
                          ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                          : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                      }`}
                    >
                      <Palette size={16} />
                      Page Builder
                    </button>
                    <button
                      onClick={() => setActiveTab('stats')}
                      data-tour="dashboard-tab-stats"
                      className={`relative flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'stats'
                          ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                          : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] bg-[color:var(--bg-muted)]'
                      }`}
                    >
                      <BarChart3 size={16} />
                      Estadísticas
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsShippingTaxModalOpen(true)}
                  data-tour="dashboard-shipping"
                  className="btn btn-outline inline-flex items-center justify-center gap-2 min-h-[44px] border-primary/40 text-primary hover:bg-primary/5"
                >
                  <DollarSign size={16} />
                  Envíos e Impuestos
                </button>
                <button
                  type="button"
                  onClick={refreshData}
                  data-tour="dashboard-refresh"
                  className="btn btn-primary inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <RefreshCcw size={16} />
                  Refrescar datos
                </button>
                {lastRefreshedAt && (
                  <div className="text-xs text-[color:var(--text-muted)] space-y-0.5">
                    <span className="block">Última actualización: {formatDateTime(lastRefreshedAt)}</span>
                    <span className="block font-medium text-primary/80">Cada 7 segundos</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-error animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        {restaurant?.fecha_vencimiento_plan && (() => {
          const dias = Math.ceil(
            (new Date(restaurant.fecha_vencimiento_plan) - new Date()) / (1000 * 60 * 60 * 24)
          );
          if (dias > 5) return null;
          const esVencido = dias <= 0;
          return (
            <div
              className="rounded-2xl p-4 border-2 flex items-start gap-3"
              style={{
                backgroundColor: esVencido ? 'var(--danger-bg)' : 'var(--warning-bg)',
                borderColor: esVencido ? 'var(--danger-border)' : 'var(--warning-border)',
                color: esVencido ? 'var(--danger-text)' : 'var(--warning-text)'
              }}
            >
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {esVencido
                    ? 'Tu suscripción ha vencido'
                    : `Tu plan vence en ${dias} día${dias === 1 ? '' : 's'}`}
                </p>
                <p className="text-sm opacity-90">
                  {esVencido
                    ? 'Tu local pasó a plan Básico. Contacta al administrador para renovar.'
                    : `Renueva antes del ${formatDate(restaurant.fecha_vencimiento_plan)} para no perder funciones.`}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Capa 2 del manual contextual: banner persistente con 3 estados.
            Solo se muestra si el dueño NO descartó la ayuda. */}
        <DashboardHelpBanner
          onStartTour={() => {
            setTourKey((k) => k + 1);
            setTourOpen(true);
          }}
        />

        {activeTab === 'orders' ? (
          <OrdersView
            orders={orders}
            ordersLoading={ordersLoading}
            updatingOrderId={updatingOrderId}
            handleStatusChange={handleStatusChange}
            handleCancelOrder={handleCancelOrder}
            handleViewOrderDetails={handleViewOrderDetails}
            handlePrintOrder={handlePrintOrder}
            stats={stats}
            handleExport={handleExport}
            exporting={exporting}
          />
        ) : activeTab === 'payments' ? (
          <PaymentTabs refreshData={refreshData} />
        ) : activeTab === 'stats' ? (
          <StatsView statsData={statsData} restaurant={restaurant} handleExport={handleExport} exporting={exporting} exportError={exportError} />
        ) : activeTab === 'coupons' ? (
          <CouponsView
            restaurant={restaurant}
            refreshData={refreshData}
          />
        ) : activeTab === 'builder' ? (
          <PageBuilder
            restaurant={restaurant}
            onSave={refreshData}
          />
        ) : (
          <>
            {/* Capa 1 — manual contextual: tips contextuales.
                Cada tip aparece solo cuando tiene sentido:
                  - crear_producto:    siempre que entra a Gestión
                  - adiciones_corrientazo: solo si ya hay ≥1 producto
                    (es el caso de uso clásico: corrientazos y
                    desayunos usan adiciones obligatorias y opcionales
                    para que el cliente arme su plato)
                  - pausar_producto:   solo si ya hay ≥1 producto
                El tip de modificadores_producto lo agregaremos en otro
                commit: debe vivir adentro del ProductModal (cuando el
                dueño está editando un producto, no en la lista). */}
            {activeTab === 'management' && (
              <>
                <OnboardingTip
                  tipKey="crear_producto"
                  title="¿Cómo creo mi primer producto?"
                  steps={[
                    'Haz click en "+ Nuevo producto"',
                    'Llena nombre, descripción y precio',
                    'Elige una categoría y sube una foto',
                    'Marca el switch "Disponible" y guarda',
                  ]}
                />
                {products.length > 0 && (
                  <>
                    <OnboardingTip
                      tipKey="adiciones_corrientazo"
                      title="Corrientazos y desayunos: usa adiciones"
                      steps={[
                        'Abre un producto (ej: "Almuerzo corrientazo")',
                        'En la sección "Adiciones", crea un grupo (ej: "Proteína")',
                        'Marca el grupo como obligatorio · elige 1 opción',
                        'Agrega las opciones (ej: "Pollo", "Carne", "Cerdo")',
                        'Repite con "Acompañamiento" (Arroz, Pasta, Papa)',
                        'El cliente arma su plato y tú cobras el extra de cada adición',
                      ]}
                    />
                    <OnboardingTip
                      tipKey="pausar_producto"
                      title="Pausar un producto sin eliminarlo"
                      steps={[
                        'Haz click en el switch verde/rojo del producto',
                        'Pasa a "No disponible" — desaparece del menú del cliente',
                        'Cuando lo vuelvas a activar, aparece de nuevo automáticamente',
                        'Ideal para fin de jornada o cuando se te agota un ingrediente',
                      ]}
                    />
                  </>
                )}
              </>
            )}
            {activeTab === 'payments' && (
              <OnboardingTip
                tipKey="subir_comprobante"
                title="¿Cómo subo el comprobante de pago?"
                steps={[
                  'Haz click en "Subir comprobante"',
                  'Arrastra la foto del recibo o PDF (drag & drop)',
                  'O click en el área para elegir el archivo',
                  'Elige el mes que corresponde y confirma',
                ]}
              />
            )}
            {activeTab === 'coupons' && (
              <OnboardingTip
                tipKey="crear_cupon"
                title="¿Cómo creo un cupón?"
                steps={[
                  'Haz click en "+ Nuevo cupón"',
                  'Elige si es porcentaje (%) o monto fijo ($)',
                  'Define vigencia y cantidad máxima de usos',
                  'El código lo ven los clientes al pedir (ej: "VERANO20")',
                ]}
              />
            )}
            {/* Nota: NO agregamos tip de "plan_y_vencimiento" porque ya hay
                una alerta naranja grande en el header (línea 842) que
                cumple esa función. Poner 2 banners amarillos sería ruido. */}
            <ManagementView
              products={products}
              productsLoading={productsLoading}
              stats={stats}
              togglingProductId={togglingProductId}
              handleToggleProduct={handleToggleProduct}
              openProductModal={openProductModal}
              handleDeleteProduct={handleDeleteProduct}
              deletingProductId={deletingProductId}
              restaurant={restaurant}
              profile={profile}
              setIsRestaurantModalOpen={setIsRestaurantModalOpen}
            />
          </>
        )}
      </div>

      {/* Capa 2 del manual contextual: tour guiado. Se monta solo cuando
          `tourOpen` es true. El `key={tourKey}` fuerza remontaje cada
          vez que se reabre, así el step counter arranca en 0. El
          `onActivateTab` permite que el tour cambie de tab antes de
          iluminar el target (steps 4, 5, 8, 9, 10). */}
      {tourOpen && (
        <DashboardTour
          key={tourKey}
          onClose={() => setTourOpen(false)}
          onActivateTab={(tabId) => {
            if (tabId === 'stats' || tabId === 'builder') {
              // Stats/Builder solo existen en planes != básico
              if (restaurant?.plan && restaurant.plan !== 'basico') {
                setActiveTab(tabId);
              }
            } else {
              setActiveTab(tabId);
            }
          }}
        />
      )}

      <ConfirmationModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ isOpen: false, orderId: null, nextStatus: null, action: 'status' })}
        onConfirm={confirmStatusChange}
        title={confirmAction.action === 'cancel' ? 'Cancelar Pedido' : 'Confirmar Cambio de Estado'}
        message={confirmAction.action === 'cancel'
          ? `¿Estás seguro de que deseas cancelar el pedido #${confirmAction.orderId}? Esta acción no se puede deshacer.`
          : `¿Estás seguro de que deseas cambiar el estado del pedido #${confirmAction.orderId} a ${confirmAction.nextStatus}?`}
        action={confirmAction.action}
        reason={cancellationReason}
        onReasonChange={setCancellationReason}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={selectedProduct}
        restaurantId={restaurant?.id}
        restaurante={restaurant}
      />

      <RestaurantModal
        isOpen={isRestaurantModalOpen}
        onClose={() => setIsRestaurantModalOpen(false)}
        onSave={handleSaveRestaurant}
        restaurant={restaurant}
      />

      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={closeOrderDetailsModal}
        order={selectedOrderForDetails}
        autoPrint={autoPrintOrder}
      />

      <RestaurantShippingTaxModal
        isOpen={isShippingTaxModalOpen}
        onClose={() => setIsShippingTaxModalOpen(false)}
        onSucceeded={refreshData}
        restaurant={restaurant}
      />
    </div>
  );
}

function OrdersView({ orders, ordersLoading, updatingOrderId, handleStatusChange, handleCancelOrder, handleViewOrderDetails, handlePrintOrder, stats, handleExport, exporting }) {
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  const { activeOrders, completedOrders } = useMemo(() => {
    return {
      activeOrders: orders.filter(o => o.estado === 'Pendiente' || o.estado === 'Preparando' || o.estado === 'Listo'),
      completedOrders: orders.filter(o => o.estado === 'Entregado'),
    };
  }, [orders]);

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Pedidos totales"
          value={stats.totalOrders}
          icon={<ShoppingBag size={20} />}
          description="Todos los pedidos registrados"
        />
        <StatCard
          title="Pendientes"
          value={stats.pendingOrders}
          icon={<Clock3 size={20} />}
          description="Pedidos por preparar"
        />
        <StatCard
          title="En proceso"
          value={stats.preparingOrders}
          icon={<ArrowUpRight size={20} />}
          description="Pedidos en cocina"
        />
        <StatCard
          title="Ingresos estimados"
          value={`$${stats.revenue.toLocaleString('es-CO')}`}
          icon={<CheckCircle size={20} />}
          description="Suma de totales generales"
        />
      </section>

      <div className="card-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)]">Recepción de Pedidos</h2>
            <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm">Gestiona la operatividad de tu local en tiempo real.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('orders', 'pdf')}
              disabled={exporting}
              className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
              title="Exportar pedidos a PDF"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={() => handleExport('orders', 'excel')}
              disabled={exporting}
              className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[40px]"
              title="Exportar pedidos a Excel"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {ordersLoading ? (
          <div className="py-10 text-center text-[color:var(--text-muted)]">
            <div className="spinner spinner-md mx-auto mb-3"></div>
            <p>Cargando pedidos...</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* --- ACTIVE ORDERS --- */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-5 sm:h-6 bg-primary rounded-full"></div>
                <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-primary)]">Pedidos Activos</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {activeOrders.length}
                </span>
              </div>

              {activeOrders.length === 0 ? (
                <div className="py-8 text-center bg-[color:var(--bg-subtle)] rounded-2xl border-2 border-dashed border-[color:var(--border-default)] text-[color:var(--text-muted)]">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm sm:text-base">No hay pedidos activos en este momento.</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      updatingOrderId={updatingOrderId}
                      handleStatusChange={handleStatusChange}
                      handleCancelOrder={handleCancelOrder}
                      onViewDetails={handleViewOrderDetails}
                      onPrint={handlePrintOrder}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* --- COMPLETED ORDERS --- */}
            <section className="pt-4 sm:pt-6 border-t border-[color:var(--border-subtle)]">
              <button
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex items-center justify-between w-full p-3 rounded-xl bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-muted)] transition-colors group active:scale-95 touch-feedback"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-5 sm:h-6 bg-[color:var(--text-subtle)] rounded-full"></div>
                  <h3 className="text-sm sm:text-md font-bold text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)] transition-colors">Pedidos Completados / Recientes</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] text-xs font-bold">
                    {completedOrders.length}
                  </span>
                </div>
                <RefreshCcw
                  size={16}
                  className={`text-[color:var(--text-subtle)] transition-transform duration-300 flex-shrink-0 ${isCompletedExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {isCompletedExpanded && (
                <div className="mt-4 space-y-3 sm:space-y-4">
                  {completedOrders.length === 0 ? (
                    <div className="py-8 text-center bg-[color:var(--bg-subtle)] rounded-2xl border-2 border-dashed border-[color:var(--border-default)] text-[color:var(--text-muted)]">
                      <Package size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm sm:text-base">No hay pedidos completados recientemente.</p>
                    </div>
                  ) : (
                    completedOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        updatingOrderId={updatingOrderId}
                        handleStatusChange={handleStatusChange}
                        handleCancelOrder={handleCancelOrder}
                        onViewDetails={handleViewOrderDetails}
                        onPrint={handlePrintOrder}
                        isMuted={true}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function ManagementView({ products, productsLoading, stats, togglingProductId, handleToggleProduct, openProductModal, handleDeleteProduct, deletingProductId, restaurant, profile, setIsRestaurantModalOpen }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
      <div className="xl:col-span-2 card-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)]">Gestión de Productos</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs sm:text-sm text-[color:var(--text-secondary)]">
              <span className="font-semibold text-success">{stats.activeProducts}</span> activos de {' '}
              <span className="font-semibold">{products.length}</span> totales
            </p>
            {(() => {
              // Guard de plan Free: si el local está en Free y llegó al
              // límite de productos, deshabilitamos el botón y mostramos
              // un mensaje discreto (sin CTA, sin pop-up, sin link — el
              // Free simplemente vive con su límite y se entera al
              // intentar usarlo). El backend ya valida y rechaza con 403
              // si el dueño intenta por API igual.
              const planActual = restaurant?.plan;
              const maxProductos = getPlanLimit(planActual, 'max_productos');
              const alLimite = maxProductos !== null && products.length >= maxProductos;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => openProductModal()}
                    disabled={alLimite}
                    data-tour="dashboard-new-product"
                    title={alLimite ? `Máximo ${maxProductos} productos en tu plan` : undefined}
                    aria-disabled={alLimite || undefined}
                    className="btn btn-primary btn-small inline-flex items-center gap-1.5 min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    <span className="hidden xs:inline">Nuevo</span>
                  </button>
                  {alLimite && (
                    <p className="text-xs text-[color:var(--text-muted)]">
                      Máximo {maxProductos} productos en tu plan. Para agregar más, contacta al administrador.
                    </p>
                  )}
                </>
              );
            })()}
            <Package className="text-primary" size={20} />
          </div>
        </div>
        {productsLoading ? (
          <div className="py-8 text-center text-[color:var(--text-muted)]">Cargando productos...</div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-[color:var(--text-muted)]">
            <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm sm:text-base">No tienes productos cargados todavía.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] sm:max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {products.map((product, idx) => {
              const available = product.disponible === 1 || product.disponible === true;
              return (
                <div key={product.id} className="border border-[color:var(--border-default)] rounded-xl p-3 sm:p-4 bg-[color:var(--bg-elevated)] hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {product.imagen_url && (
                        <img src={getImageUrl(product.imagen_url)} alt={product.nombre} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover bg-[color:var(--bg-muted)] flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[color:var(--text-primary)] truncate">{product.nombre}</h3>
                        <p className="text-xs sm:text-sm text-[color:var(--text-muted)] line-clamp-1">{product.descripcion || 'Sin descripción'}</p>
                        <p className="mt-1 text-sm font-bold text-primary">${Number(product.precio || 0).toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleProduct(product.id)}
                        disabled={togglingProductId === product.id}
                        data-tour={idx === 0 ? 'dashboard-toggle-product' : undefined}
                        className="text-primary hover:text-primaryDark transition-colors p-1"
                        title={available ? 'Desactivar disponibilidad' : 'Activar disponibilidad'}
                      >
                        {available ? <ToggleRight size={24} className="sm:size-28" /> : <ToggleLeft size={24} className="sm:size-28" />}
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openProductModal(product)} className="p-2 text-[color:var(--text-muted)] hover:text-primary transition-colors"><Pencil size={16} /></button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deletingProductId === product.id}
                          className="p-2 transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger-text)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <Trash2 size={16} className={deletingProductId === product.id ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`mt-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold`}
                    style={available
                      ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }
                      : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: available ? 'var(--success-text)' : 'var(--text-subtle)' }}
                    />
                    {available ? 'Disponible' : 'No disponible'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <aside className="space-y-4 sm:space-y-6">
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-2xl font-bold text-[color:var(--text-primary)]">Datos del Local</h2>
            <button
              type="button"
              onClick={() => setIsRestaurantModalOpen(true)}
              className="btn btn-outline btn-small inline-flex items-center gap-1.5 min-h-[36px]"
            >
              <Pencil size={14} />
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>
          <div className="mb-4">
            {restaurant.imagen_url ? (
              <img
                src={getImageUrl(restaurant.imagen_url)}
                alt={restaurant.nombre || 'Imagen del local'}
                className="w-full h-32 sm:h-40 rounded-xl object-cover border border-[color:var(--border-default)]"
              />
            ) : (
              <div className="w-full h-32 sm:h-40 rounded-xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] flex flex-col items-center justify-center text-[color:var(--text-muted)]">
                <ImageIcon size={24} className="mb-2" />
                <p className="text-xs sm:text-sm font-medium">Sin imagen del local</p>
                <p className="text-xs">Usa el boton Editar para agregar una foto</p>
              </div>
            )}
          </div>
          <div className="space-y-2.5 text-xs sm:text-sm text-[color:var(--text-secondary)]">
            <InfoRow label="Ciudad" value={restaurant.ciudad || 'No definida'} />
            <InfoRow label="Dirección" value={restaurant.direccion || 'No definida'} />
            <InfoRow label="Teléfono" value={restaurant.telefono || 'No disponible'} />
            <InfoRow label="Horario" value={`${restaurant.horario_apertura?.slice(0, 5) || '--:--'} - ${restaurant.horario_cierre?.slice(0, 5) || '--:--'}`} />
            <InfoRow label="Responsable" value={profile?.nombre || 'Sin dato'} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatCard({ title, value, icon, description }) {
  return (
    <div className="card-lg bg-[color:var(--bg-elevated)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-[color:var(--text-muted)] font-medium truncate">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-heading font-bold text-[color:var(--text-primary)] mt-1.5 break-words">{value}</h3>
          <p className="text-xs text-[color:var(--text-muted)] mt-1.5 line-clamp-2">{description}</p>
        </div>
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 border-b border-[color:var(--border-subtle)] pb-2.5 last:border-0 last:pb-0">
      <span className="font-semibold text-[color:var(--text-muted)] text-xs sm:text-sm">{label}</span>
      <span className="text-right text-[color:var(--text-primary)] text-xs sm:text-sm break-words">{value}</span>
    </div>
  );
}

function StatsView({ statsData, restaurant, handleExport, exporting, exportError }) {
  // `restaurant` puede llegar null mientras `loadProfile` está en curso.
  // Para no mostrar bloqueos falsos durante esa ventana, hacemos fallback
  // al usuario del AuthContext (sincronizado al login y persistido en localStorage).
  // Golden Plus hereda TODO Premium (incluye POS).
  const { user: authUser } = useAuth();
  const plan = restaurant?.plan || authUser?.restaurante?.plan || null;
  const isGoldenPlus = plan === 'golden_plus';
  const isPremium = plan === 'premium' || isGoldenPlus;
  const isProfessional = plan === 'profesional';

  if (!statsData) {
    return (
      <div className="card-lg p-12 text-center text-[color:var(--text-muted)]">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
        <p>Cargando estadísticas avanzadas...</p>
      </div>
    );
  }

  // Métricas premium bloqueadas (para mostrar el contador en el banner de upgrade)
  const premiumMetricsCount = 17;

  // Calcular porcentaje de métodos de pago
  const totalPedidosPago = statsData.metodos_pago?.reduce((sum, m) => sum + Number(m.cantidad), 0) || 0;
  const metodosPagoConPorcentaje = statsData.metodos_pago?.map(m => ({
    ...m,
    porcentaje: totalPedidosPago > 0 ? ((Number(m.cantidad) / totalPedidosPago) * 100).toFixed(1) : 0,
  })) || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Resumen del Plan */}
      <section className="card-lg bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[color:var(--text-primary)] mb-1">
              Estadísticas del Local
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Plan actual: <span className="font-bold text-primary capitalize">{restaurant?.plan || 'básico'}</span>
              {isGoldenPlus ? (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}
                >
                  👑 Golden Plus
                </span>
              ) : isPremium && (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}
                >
                  ⭐ Premium
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('stats', 'pdf')}
              disabled={exporting}
              className="btn btn-outline btn-small inline-flex items-center gap-2"
              title="Exportar estadísticas a PDF"
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExport('stats', 'excel')}
              disabled={exporting}
              className="btn btn-outline btn-small inline-flex items-center gap-2"
              title="Exportar estadísticas a Excel"
            >
              📊 Excel
            </button>
          </div>
        </div>
        {exportError && (
          <div
          className="mt-3 p-2 rounded-lg text-sm"          style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}
        >
            {exportError}
          </div>
        )}
      </section>

      {/* ========== BANNER UPGRADE A GOLDEN PLUS (antes que Premium) ========== */}
      {/* Golden Plus incluye TODO Premium + el POS. Si el local aún no tiene
          Golden Plus, mostramos este banner más prominente. El de Premium
          queda como segunda opción (por si el local no quiere POS). */}
      {!isGoldenPlus && (
        <section
          className="card-lg border-2 relative overflow-hidden"
          style={{
            borderColor: '#f59e0b',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              👑
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900">
                Desbloquea el POS completo con Golden Plus
              </h3>
              <p className="text-sm text-amber-800">
                Plano de mesas, KDS, caja registradora, inventario con BOM/kardex,
                reportes, split bill, transfer de mesa y más. <strong>$150.000/mes</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const mensaje = `Hola, soy un local con plan ${(restaurant?.plan || 'basico').toUpperCase()} y quiero actualizar al Plan Golden Plus de GigantYA para activar el POS. ¿Me pueden dar información?`;
              window.open(`https://wa.me/573115320211?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
          >
            👑 Actualizar a Golden Plus · $150.000/mes
          </button>
        </section>
      )}

      {/* ========== BANNER UPGRADE A PREMIUM (solo para planes no-Premium) ========== */}
      {!isPremium && (
        <section
          className="card-lg border-2 relative overflow-hidden"
          style={{
            borderColor: 'var(--warning-border)',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          }}
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              <TrendingUp size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-amber-900">Desbloquea {premiumMetricsCount} métricas avanzadas con Premium</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-900 text-amber-50">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-amber-800 mb-3">
                Conoce tu <strong>hora pico</strong>, tus <strong>clientes recurrentes</strong>, la <strong>tasa de cancelación</strong>, el <strong>tiempo promedio de preparación</strong>, los <strong>productos sin ventas</strong> y mucho más.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const mensaje = `Hola, soy un local con plan ${(restaurant?.plan || 'basico').toUpperCase()} y quiero actualizar mi plan a Premium en GigantYA. ¿Me pueden dar información?`;
                    window.open(`https://wa.me/573115320211?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                >
                  ⭐ Actualizar a Premium · $80.000/mes
                </button>
                <span className="text-xs text-amber-800 font-medium">
                  Menos de $3.000 al día · 17 métricas exclusivas
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== PLAN PROFESIONAL Y PREMIUM: VENTAS TOTALES ========== */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Ventas Totales</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Ventas de Hoy"
            value={`$${Number(statsData.ventas?.hoy || 0).toLocaleString('es-CO')}`}
            icon={<Banknote size={20} />}
            description="Ingresos del día actual"
          />
          <StatCard
            title="Ventas de la Semana"
            value={`$${Number(statsData.ventas?.semana || 0).toLocaleString('es-CO')}`}
            icon={<Banknote size={20} />}
            description="Ingresos de esta semana"
          />
          <StatCard
            title="Ventas del Mes"
            value={`$${Number(statsData.ventas?.mes || 0).toLocaleString('es-CO')}`}
            icon={<Banknote size={20} />}
            description="Ingresos del mes actual"
          />
        </div>
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: PEDIDOS ========== */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Pedidos</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Pedidos"
            value={statsData.pedidos?.total || 0}
            icon={<ShoppingBag size={20} />}
            description="Todos los pedidos registrados"
          />
          <StatCard
            title="Pedidos Completados"
            value={statsData.pedidos?.completados || 0}
            icon={<CheckCircle size={20} />}
            description="Pedidos entregados exitosamente"
          />
          <StatCard
            title="Pedidos Cancelados"
            value={statsData.pedidos?.cancelados || 0}
            icon={<AlertCircle size={20} />}
            description="Pedidos cancelados"
          />
          <StatCard
            title="Pedidos Pendientes"
            value={statsData.pedidos?.pendientes || 0}
            icon={<Clock3 size={20} />}
            description="Pedidos por procesar"
          />
        </div>
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: TICKET PROMEDIO ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Ticket Promedio</h3>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-primary">
            ${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')}
          </span>
          <span className="text-sm text-[color:var(--text-muted)]">Valor promedio por pedido entregado</span>
        </div>
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: PRODUCTOS MÁS VENDIDOS ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <UtensilsCrossed className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Productos Más Vendidos (Top 10)</h3>
        </div>
        {!statsData.productos_mas_vendidos || statsData.productos_mas_vendidos.length === 0 ? (
          <p className="text-[color:var(--text-muted)] text-center py-8">No hay productos vendidos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad Vendida</th>
                  <th className="px-4 py-3 text-right">Ingresos Generados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {statsData.productos_mas_vendidos
                  .filter(p => p.nombre != null)
                  .slice(0, 10)
                  .map((prod, idx) => (
                    <tr key={`prod-${prod.id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-bold text-[color:var(--text-subtle)]">#{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{prod.nombre || 'Sin nombre'}</td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{prod.cantidad_vendida || 0}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(prod.ingresos_generados || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: VENTAS POR DÍA ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Ventas por Día (Últimos 30 días)</h3>
        </div>
        {statsData.ventas_diarias?.length === 0 ? (
          <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de ventas registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total Ventas</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {statsData.ventas_diarias?.map((day, idx) => {
                  const fecha = day.fecha ? new Date(day.fecha) : null;
                  return (
                    <tr key={`day-${day.fecha}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">
                        {fecha && !isNaN(fecha.getTime()) ? formatShortDate(fecha) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(day.total_ventas || 0).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">
                        {day.total_pedidos || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: MÉTODOS DE PAGO ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <Banknote className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Métodos de Pago</h3>
        </div>
        {statsData.metodos_pago?.length === 0 ? (
          <p className="text-[color:var(--text-muted)] text-center py-8">No hay registros de métodos de pago.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metodosPagoConPorcentaje.map((metodo, idx) => (
              <div key={`${metodo.metodo_pago}-${idx}`} className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[color:var(--text-secondary)] capitalize">
                    {PAYMENT_METHOD_LABELS[metodo.metodo_pago] || metodo.metodo_pago}
                  </span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {metodo.porcentaje}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-[color:var(--text-primary)]">{metodo.cantidad}</p>
                <p className="text-xs text-[color:var(--text-muted)]">pedidos</p>
                <p className="text-sm font-bold text-primary mt-2">
                  ${Number(metodo.total_ventas || 0).toLocaleString('es-CO')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: CATEGORÍAS MÁS VENDIDAS ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <Package className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Categorías Más Vendidas</h3>
        </div>
        {!statsData.categorias_mas_vendidas || statsData.categorias_mas_vendidas.length === 0 ? (
          <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de categorías registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                <tr>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Cantidad Vendida</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {statsData.categorias_mas_vendidas
                  .filter(c => c.categoria != null)
                  .map((cat, idx) => (
                    <tr key={`cat-${cat.categoria}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{cat.categoria || 'Sin categoría'}</td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{cat.cantidad_vendida || 0}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(cat.ingresos_generados || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: RESUMEN GENERAL ========== */}
      <section className="card-lg bg-gradient-to-br from-primary/5 to-[color:var(--bg-elevated)]">
        <div className="flex items-center gap-3 mb-4">
          <LayoutDashboard className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Resumen General</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Ingresos Totales</p>
            <p className="text-2xl font-bold text-primary">
              ${Number(statsData.resumen?.ingresos_totales || 0).toLocaleString('es-CO')}
            </p>
          </div>
          <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Total Pedidos</p>
            <p className="text-2xl font-bold text-[color:var(--text-primary)]">{statsData.pedidos?.total || 0}</p>
          </div>
          <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Ticket Promedio</p>
            <p className="text-xl font-bold text-[color:var(--text-primary)]">
              ${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')}
            </p>
          </div>
          <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Producto Estrella</p>
            <p className="text-sm font-bold text-[color:var(--text-primary)] truncate">
              {statsData.resumen?.producto_estrella?.nombre || 'N/A'}
            </p>
            <p className="text-xs text-[color:var(--text-muted)]">
              {statsData.resumen?.producto_estrella?.cantidad_vendida || 0} unidades
            </p>
          </div>
        </div>
      </section>

      {/* ========== SOLO PREMIUM: HORARIOS CON MÁS VENTAS ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock3 className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Horarios con Más Ventas</h3>
            </div>
            {statsData.hora_pico?.hora != null && (
              <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
            >
                ⏰ Hora pico: {String(statsData.hora_pico.hora).padStart(2, '0')}:00 - {String(statsData.hora_pico.hora + 1).padStart(2, '0')}:00
              </span>
            )}
          </div>
          {statsData.ventas_por_hora?.length === 0 || !statsData.ventas_por_hora ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de horarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.ventas_por_hora?.filter(h => h.hora != null).map((hora, idx) => (
                    <tr key={`${hora.hora}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">
                        {String(hora.hora).padStart(2, '0')}:00 - {String(hora.hora + 1).padStart(2, '0')}:00
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{hora.cantidad_pedidos}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(hora.total_ventas || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Horarios con Más Ventas" description="Gráfico por horas, hora pico y horas de menor actividad" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: DÍAS MÁS RENTABLES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Días Más Rentables</h3>
            </div>
            {statsData.dia_mas_rentable && (
              <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
            >
                📈 Día con más ingresos: {statsData.dia_mas_rentable?.dia || 'N/A'}
              </span>
            )}
          </div>
          {statsData.dias_rentables?.length === 0 || !statsData.dias_rentables ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de días rentables registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Día</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.dias_rentables?.map((dia, idx) => (
                    <tr key={`${dia.numero_dia}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] capitalize">{dia.dia || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{dia.cantidad_pedidos || 0}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(dia.total_ventas || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Días Más Rentables" description="Comparativa semanal y día con más ingresos" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: CLIENTES RECURRENTES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Clientes Recurrentes (Top 10)</h3>
          </div>
          {statsData.clientes_recurrentes?.length === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay clientes recurrentes registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Teléfono</th>
                    <th className="px-4 py-3 text-right">Total Pedidos</th>
                    <th className="px-4 py-3 text-right">Gasto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.clientes_recurrentes?.map((cliente, idx) => (
                    <tr key={`${cliente.id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{cliente.nombre}</td>
                      <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{cliente.telefono || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {cliente.total_pedidos}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(cliente.gasto_total || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Clientes Recurrentes" description="Top clientes, número de pedidos y gasto total" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: CLIENTES NUEVOS VS RECURRENTES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Clientes Nuevos vs Recurrentes</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statsData.clientes_nuevos_vs_recurrentes?.map((tipo, idx) => (
              <div key={`${tipo.tipo_cliente}-${idx}`} className="border border-[color:var(--border-default)] rounded-xl p-6 bg-[color:var(--bg-elevated)] text-center">
                <p className="text-sm font-bold text-[color:var(--text-secondary)] mb-2 capitalize">{tipo.tipo_cliente}</p>
                <p className="text-4xl font-bold text-primary">{tipo.cantidad}</p>
                <p className="text-xs text-[color:var(--text-muted)] mt-1">clientes</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Clientes Nuevos vs Recurrentes" description="Gráfico comparativo de clientes" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: EVOLUCIÓN DE VENTAS ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <ArrowUpRight className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Evolución de Ventas</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Comparación mensual */}
            <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
              <h4 className="font-bold text-[color:var(--text-primary)] mb-4">Este Mes vs Mes Anterior</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[color:var(--text-secondary)]">Este mes</span>
                  <span className="font-bold text-primary">
                    ${Number(statsData.evolucion_ventas?.este_mes?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[color:var(--text-secondary)]">Mes anterior</span>
                  <span className="font-bold text-[color:var(--text-secondary)]">
                    ${Number(statsData.evolucion_ventas?.mes_anterior?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="pt-3 border-t border-[color:var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[color:var(--text-secondary)]">Variación</span>
                    <span
                          className="font-bold"
                          style={{ color: Number(statsData.crecimiento_mensual) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
                        >
                      {Number(statsData.crecimiento_mensual) >= 0 ? '+' : ''}{statsData.crecimiento_mensual}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Comparación semanal */}
            <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)]">
              <h4 className="font-bold text-[color:var(--text-primary)] mb-4">Esta Semana vs Semana Anterior</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[color:var(--text-secondary)]">Esta semana</span>
                  <span className="font-bold text-primary">
                    ${Number(statsData.evolucion_ventas?.esta_semana?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[color:var(--text-secondary)]">Semana anterior</span>
                  <span className="font-bold text-[color:var(--text-secondary)]">
                    ${Number(statsData.evolucion_ventas?.semana_anterior?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="pt-3 border-t border-[color:var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[color:var(--text-secondary)]">Variación</span>
                    <span
                    className="font-bold"
                    style={{
                      color: Number(statsData.evolucion_ventas?.esta_semana?.total) >= Number(statsData.evolucion_ventas?.semana_anterior?.total)
                        ? 'var(--success-text)'
                        : 'var(--danger-text)'
                    }}
                  >
                      {Number(statsData.evolucion_ventas?.esta_semana?.total) >= Number(statsData.evolucion_ventas?.semana_anterior?.total) ? '+' : '-'}${Math.abs(Number(statsData.evolucion_ventas?.esta_semana?.total) - Number(statsData.evolucion_ventas?.semana_anterior?.total)).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Evolución de Ventas" description="Comparación mes a mes y semana a semana" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: TASA DE CRECIMIENTO ========== */}
      {isPremium ? (
        <section
          className="card-lg"
          style={{ backgroundImage: 'linear-gradient(to right, var(--success-bg), var(--bg-elevated))' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp style={{ color: 'var(--success-text)' }} size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Tasa de Crecimiento Mensual</h3>
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="text-4xl font-bold"
              style={{ color: Number(statsData.crecimiento_mensual) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {Number(statsData.crecimiento_mensual) >= 0 ? '+' : ''}{statsData.crecimiento_mensual}%
            </span>
            <span className="text-sm text-[color:var(--text-secondary)]">
              {Number(statsData.crecimiento_mensual) >= 0 ? 'de crecimiento' : 'de decrecimiento'} respecto al mes anterior
            </span>
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Tasa de Crecimiento" description="Porcentaje de crecimiento de ventas mensual" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: RENDIMIENTO DE PROMOCIONES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Ticket className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Rendimiento de Promociones</h3>
          </div>
          {statsData.cupones_mas_utilizados?.length === 0 || !statsData.cupones_mas_utilizados ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay cupones utilizados registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Cupón</th>
                    <th className="px-4 py-3 text-center">Descuento</th>
                    <th className="px-4 py-3 text-right">Veces Usado</th>
                    <th className="px-4 py-3 text-right">Descuento Otorgado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.cupones_mas_utilizados.map((cupon, idx) => (
                    <tr key={`${cupon.codigo}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                      <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">
                        <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold">
                          {cupon.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-[color:var(--text-secondary)]">
                        {cupon.tipo_descuento === 'porcentaje' ? `${cupon.descuento || 0}%` : `$${Number(cupon.descuento || 0).toLocaleString('es-CO')}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                        >
                          {cupon.veces_utilizado || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(cupon.descuento_otorgado || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Rendimiento de Promociones" description="Cupones más utilizados y promociones más rentables" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: PRODUCTOS CON MAYOR RENTABILIDAD ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Productos con Mayor Rentabilidad</h3>
          </div>
          {!statsData.productos_mayor_rentabilidad || statsData.productos_mayor_rentabilidad.length === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de rentabilidad registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.productos_mayor_rentabilidad
                    .filter(p => p.nombre != null)
                    .map((prod, idx) => (
                      <tr key={`rent-${prod.id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                        <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{prod.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{Number(prod.cantidad_vendida) || 0}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                          ${Number(prod.ingresos_generados || 0).toLocaleString('es-CO')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-[color:var(--text-secondary)]">
                          ${Number(prod.ticket_promedio || 0).toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}
                    </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Productos con Mayor Rentabilidad" description="Producto, cantidad vendida e ingreso generado" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: TENDENCIAS DE CONSUMO ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Tendencias de Consumo</h3>
          </div>
          {!statsData.tendencias_productos || statsData.tendencias_productos.length === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay datos de tendencias registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Últimos 15 días</th>
                    <th className="px-4 py-3 text-right">15-30 días</th>
                    <th className="px-4 py-3 text-right">Tendencia</th>
                    <th className="px-4 py-3 text-right">Variación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {statsData.tendencias_productos
                    .filter(p => p.nombre != null)
                    .map((prod, idx) => (
                      <tr key={`trend-${prod.id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                        <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{prod.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{Number(prod.cantidad_ultimos_15_dias) || 0}</td>
                        <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">{Number(prod.cantidad_15_a_30_dias) || 0}</td>
                        <td className="px-4 py-3 text-right">
                          {prod.tendencia === 'crecimiento' && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-bold"
                              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                            >
                              📈 crecimiento
                            </span>
                          )}
                          {prod.tendencia === 'descenso' && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-bold"
                              style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}
                            >
                              📉 descenso
                            </span>
                          )}
                          {prod.tendencia === 'nuevo' && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-bold"
                              style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}
                            >
                              ✨ nuevo
                            </span>
                          )}
                          {prod.tendencia === 'estable' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-[color:var(--bg-muted)] text-[color:var(--text-primary)]">
                              ➖ estable
                            </span>
                          )}
                          {!prod.tendencia && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-[color:var(--bg-muted)] text-[color:var(--text-primary)]">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold">
                          {prod.variacion === 'N/A' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-[color:var(--bg-muted)] text-[color:var(--text-primary)]">
                              N/A
                            </span>
                          )}
                          {prod.variacion && prod.variacion !== 'N/A' && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: String(prod.variacion).startsWith('-') ? 'var(--danger-bg)' : 'var(--success-bg)',
                                color: String(prod.variacion).startsWith('-') ? 'var(--danger-text)' : 'var(--success-text)',
                                border: '1px solid ' + (String(prod.variacion).startsWith('-') ? 'var(--danger-border)' : 'var(--success-border)')
                              }}
                            >
                              {prod.variacion.endsWith('%') ? prod.variacion : `${prod.variacion}%`}
                            </span>
                          )}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Tendencias de Consumo" description="Productos en crecimiento y descenso" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: TASA DE CANCELACIÓN ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Tasa de Cancelación</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
              <p className="text-xs text-[color:var(--text-muted)] mb-1">% Cancelados</p>
              <p
                className="text-3xl font-bold"
                style={{ color: Number(statsData.tasa_cancelacion?.porcentaje || 0) > 10 ? 'var(--danger-text)' : 'var(--success-text)' }}
              >
                {Number(statsData.tasa_cancelacion?.porcentaje || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-[color:var(--text-muted)] mt-1">
                {Number(statsData.tasa_cancelacion?.porcentaje || 0) > 10 ? 'Atención: alta' : 'En rango aceptable'}
              </p>
            </div>
            <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
              <p className="text-xs text-[color:var(--text-muted)] mb-1">Pedidos Cancelados</p>
              <p className="text-3xl font-bold text-[color:var(--text-primary)]">
                {statsData.tasa_cancelacion?.total_cancelados || 0}
              </p>
            </div>
            <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
              <p className="text-xs text-[color:var(--text-muted)] mb-1">Total Pedidos (30d)</p>
              <p className="text-3xl font-bold text-[color:var(--text-primary)]">
                {statsData.tasa_cancelacion?.total_pedidos || 0}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Tasa de Cancelación" description="% de pedidos cancelados en los últimos 30 días" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: TAMAÑO PROMEDIO DEL CARRITO ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingBag className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Tamaño Promedio del Carrito</h3>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-primary">
              {Number(statsData.tamano_promedio_carrito || 0).toFixed(1)}
            </span>
            <span className="text-sm text-[color:var(--text-secondary)]">
              items por pedido en los últimos 30 días
            </span>
          </div>
          <p className="text-xs text-[color:var(--text-muted)] mt-3">
            {Number(statsData.tamano_promedio_carrito || 0) >= 3
              ? '✅ Los clientes suelen pedir varios productos. Considerá ofrecer combos.'
              : Number(statsData.tamano_promedio_carrito || 0) >= 2
                ? 'ℹ️ Pedidos regulares. Podrías intentar up-selling.'
                : '⚠️ Pedidos muy simples. Oportunidad para combos y sugerencias.'}
          </p>
        </section>
      ) : (
        <PremiumLockedFeature title="Tamaño Promedio del Carrito" description="Promedio de items por pedido" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: TIEMPO PROMEDIO DE PREPARACIÓN ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Clock3 className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Tiempo Promedio de Preparación</h3>
          </div>
          {Number(statsData.tiempo_promedio_preparacion?.pedidos_contados || 0) === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay pedidos entregados en los últimos 30 días para calcular.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Promedio</p>
                <p className="text-3xl font-bold text-primary">
                  {Number(statsData.tiempo_promedio_preparacion?.promedio_minutos || 0).toFixed(0)}
                </p>
                <p className="text-xs text-[color:var(--text-muted)] mt-1">minutos</p>
              </div>
              <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Más rápido</p>
                <p className="text-2xl font-bold text-[color:var(--success-text)]">
                  {Number(statsData.tiempo_promedio_preparacion?.minimo_minutos || 0).toFixed(0)} min
                </p>
              </div>
              <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Más lento</p>
                <p className="text-2xl font-bold text-[color:var(--danger-text)]">
                  {Number(statsData.tiempo_promedio_preparacion?.maximo_minutos || 0).toFixed(0)} min
                </p>
              </div>
              <div className="border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] text-center">
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Pedidos medidos</p>
                <p className="text-2xl font-bold text-[color:var(--text-primary)]">
                  {statsData.tiempo_promedio_preparacion?.pedidos_contados || 0}
                </p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Tiempo de Preparación" description="Promedio, mínimo y máximo de minutos por pedido entregado" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: DISTRIBUCIÓN DEL TICKET ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Distribución del Valor del Pedido (30 días)</h3>
          </div>
          {statsData.distribucion_ticket?.length === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">No hay pedidos entregados en los últimos 30 días.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Rango de ticket</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {(() => {
                    // Fallback defensivo: el backend puede no devolver este
                    // campo en planes nuevos. Mostramos tabla vacía en vez
                    // de romper la página entera.
                    const dist = Array.isArray(statsData.distribucion_ticket) ? statsData.distribucion_ticket : [];
                    if (dist.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)] italic">
                            Sin datos de distribución de tickets en el período seleccionado.
                          </td>
                        </tr>
                      );
                    }
                    const totalDist = dist.reduce((s, d) => s + Number(d.cantidad_pedidos || 0), 0);
                    return dist.map((d, idx) => {
                      const cant = Number(d.cantidad_pedidos || 0);
                      const pct = totalDist > 0 ? ((cant / totalDist) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={`${d.rango}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                          <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{d.rango}</td>
                          <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">
                            {cant} <span className="text-xs text-[color:var(--text-muted)]">({pct}%)</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                            ${Number(d.total_ventas || 0).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Distribución del Ticket" description="Histograma de rangos de valor del pedido" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: PRODUCTOS SIN VENTAS ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Package className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Productos Sin Ventas (30+ días)</h3>
            </div>
            {statsData.productos_sin_ventas?.length > 0 && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}
              >
                💤 {statsData.productos_sin_ventas.length} sin vender
              </span>
            )}
          </div>
          {(statsData.productos_sin_ventas?.length || 0) === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">Todos tus productos activos han vendido en los últimos 30 días. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3">Última venta</th>
                    <th className="px-4 py-3 text-right">Días sin venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {(statsData.productos_sin_ventas || []).map((p, idx) => {
                    const dias = Number(p.dias_sin_venta || 0);
                    const bgColor = dias > 90 ? 'var(--danger-bg)' : dias > 60 ? 'var(--warning-bg)' : 'var(--info-bg)';
                    const textColor = dias > 90 ? 'var(--danger-text)' : dias > 60 ? 'var(--warning-text)' : 'var(--info-text)';
                    const borderColor = dias > 90 ? 'var(--danger-border)' : dias > 60 ? 'var(--warning-border)' : 'var(--info-border)';
                    return (
                      <tr key={`psv-${p.id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                        <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{p.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm text-right text-[color:var(--text-secondary)]">
                          ${Number(p.precio || 0).toLocaleString('es-CO')}
                        </td>
                        <td className="px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                          {p.ultima_venta ? formatShortDate(new Date(p.ultima_venta)) : 'Nunca'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
                          >
                            {dias} días
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Productos Sin Ventas" description="Productos disponibles que no se vendieron en 30+ días" planActual={restaurant?.plan || 'basico'} />
      )}

      {/* ========== SOLO PREMIUM: COMBINACIONES FRECUENTES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Combinaciones Frecuentes (60 días)</h3>
          </div>
          {statsData.combinaciones_frecuentes?.length === 0 ? (
            <p className="text-[color:var(--text-muted)] text-center py-8">Aún no hay combinaciones de productos suficientemente frecuentes.</p>
          ) : (
            <>
              <p className="text-sm text-[color:var(--text-secondary)] mb-3">
                💡 Estos pares de productos se piden juntos. Considerá armar combos para aumentar el ticket.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Producto A</th>
                      <th className="px-4 py-3">Producto B</th>
                      <th className="px-4 py-3 text-right">Veces juntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {(statsData.combinaciones_frecuentes || []).map((c, idx) => (
                      <tr key={`comb-${c.producto_a_id}-${c.producto_b_id}-${idx}`} className="hover:bg-[color:var(--bg-subtle)]">
                        <td className="px-4 py-3 text-sm font-bold text-[color:var(--text-subtle)]">#{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{c.producto_a}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[color:var(--text-primary)]">{c.producto_b}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                          >
                            🔗 {c.veces_juntos} veces
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : (
        <PremiumLockedFeature title="Combinaciones Frecuentes" description="Pares de productos que los clientes suelen pedir juntos" planActual={restaurant?.plan || 'basico'} />
      )}
    </div>
  );
}

function PremiumLockedFeature({ title, description, planActual = 'profesional' }) {
  // El upgrade a Premium lo hace el admin de GigantYA tras pago.
  // Abrimos WhatsApp con un mensaje pre-armado: menos fricción que un formulario.
  const handleUpgrade = () => {
    const mensaje = `Hola, soy un local con plan ${planActual.toUpperCase()} y quiero actualizar mi plan a Premium en GigantYA. ¿Me pueden dar información?`;
    const url = `https://wa.me/573115320211?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      className="card-lg border-2 border-dashed relative overflow-hidden"
      style={{ borderColor: 'var(--warning-border)', background: 'linear-gradient(135deg, var(--bg-subtle) 0%, var(--warning-bg) 100%)' }}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
        <Lock size={12} className="text-amber-700 dark:text-amber-300" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Premium</span>
      </div>

      <div className="flex items-center gap-3 mb-2 opacity-70">
        <h3 className="text-lg font-bold text-[color:var(--text-muted)]">{title}</h3>
      </div>
      <p className="text-sm text-[color:var(--text-muted)] mb-5 max-w-md">{description}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleUpgrade}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          ⭐ Actualizar a Premium
        </button>
        <span className="text-xs text-[color:var(--text-muted)]">
          Desde $80.000/mes · menos de $3.000 al día
        </span>
      </div>
    </section>
  );
}
