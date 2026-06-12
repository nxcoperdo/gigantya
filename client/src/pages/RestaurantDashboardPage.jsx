import { useEffect, useMemo, useRef, useState } from 'react';
import { authService, orderService, productService, couponService, restaurantService, paymentService } from '../services/api';
import Loading from '../components/Loading';
import ProductModal from '../components/ProductModal';
import RestaurantModal from '../components/RestaurantModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import CouponsView from '../components/CouponsView';
import PaymentTabs from '../components/PaymentTabs';
import PageBuilder from '../components/PageBuilder';
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
} from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';

const ORDER_STATE_STYLES = {
  Pendiente: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  Preparando: 'bg-blue-50 text-blue-800 border-blue-200',
  Listo: 'bg-purple-50 text-purple-800 border-purple-200',
  Entregado: 'bg-green-50 text-green-800 border-green-200',
  Cancelado: 'bg-red-50 text-red-800 border-red-200',
  'Comprobante Enviado': 'bg-orange-50 text-orange-800 border-orange-200',
  'Pago Confirmado': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Pago Rechazado': 'bg-red-50 text-red-800 border-red-200',
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

function OrderCard({ order, updatingOrderId, handleStatusChange, handleCancelOrder, onViewDetails, isMuted = false }) {
  const nextStatus = NEXT_STATUS_BY_STATE[order.estado];
  return (
    <article className={`border border-gray- la-200 rounded-2xl p-4 md:p-5 bg-white hover:shadow-md transition-shadow ${isMuted ? 'opacity-80 grayscale-[0.2]' : ''}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-dark">Pedido #{order.id}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ORDER_STATE_STYLES[order.estado] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              {order.estado}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
              <Banknote size={12} />
              {PAYMENT_METHOD_LABELS[order.metodo_pago] || order.metodo_pago || 'No definido'}
            </span>
          </div>
          <p className="text-gray-600 text-sm">Cliente: <span className="font-semibold text-gray-800">{order.cliente_nombre || 'Sin nombre'}</span></p>
          <p className="text-gray-600 text-sm">Teléfono: {order.cliente_telefono || 'No disponible'}</p>
          <p className="text-gray-600 text-sm">Fecha: {order.creado_en ? new Date(order.creado_en).toLocaleString('es-CO') : 'No disponible'}</p>
        </div>


        <div className="text-left lg:text-right space-y-2">
          <p className="text-2xl font-heading font-bold text-primary">${Number(order.total || 0).toLocaleString('es-CO')}</p>
          <p className="text-sm text-gray-500">{order.items_count || 0} producto(s)</p>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => onViewDetails(order)}
              className="btn btn-outline btn-small inline-flex items-center gap-2"
              title="Ver detalles del pedido"
            >
              <Eye size={16} />
              Detalles
            </button>
            {nextStatus && (
              <button
                type="button"
                disabled={updatingOrderId === order.id}
                onClick={() => handleStatusChange(order.id, nextStatus)}
                className="btn btn-primary btn-small inline-flex items-center gap-2"
              >
                {updatingOrderId === order.id ? 'Actualizando...' : `Pasar a ${nextStatus}`}
              </button>
            )}
            <button
              type="button"
              disabled={updatingOrderId === order.id}
              onClick={() => handleStatusChange(order.id, 'Entregado')}
              className="btn btn-outline btn-small inline-flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Marcar entregados
            </button>
            {order.estado !== 'Entregado' && (
              <button
                type="button"
                disabled={updatingOrderId === order.id}
                onClick={() => handleCancelOrder(order.id)}
                className="btn btn-outline btn-small inline-flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                title="Cancelar pedido"
              >
                <Trash2 size={16} />
                Cancelar
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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-scaleUp">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>

          {action === 'cancel' && (
            <div className="text-left mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Motivo de la cancelación *
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-primary outline-none transition-colors min-h-[100px] text-sm"
                placeholder="Ej: El cliente canceló por teléfono, falta de ingredientes, etc."
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
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
  const [profile, setProfile] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [pendingProofsCount, setPendingProofsCount] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, orderId: null, nextStatus: null, action: 'status' });
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const ordersPollingRef = useRef(null);
  const ordersRequestInFlightRef = useRef(false);

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
        setError(err.response?.data?.error || 'No se pudo cargar la información del restaurante');
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
    setIsOrderDetailsModalOpen(true);
  };

  if (profileLoading) {
    return <Loading />;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-light py-8 md:py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="card-lg text-center py-12">
            <AlertCircle size={72} className="mx-auto text-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-3">
              No tienes un restaurante asociado
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              Tu cuenta está registrada como restaurante, pero todavía no hay un perfil de restaurante configurado.
              Contacta al equipo administrativo para habilitar tu panel operativo.
            </p>
            <div className="text-sm text-gray-500">
              Usuario: <span className="font-semibold text-gray-700">{profile?.nombre}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
        <section className="card-lg bg-gradient-to-br from-white to-red-50/60">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4">
                <LayoutDashboard size={16} />
                Dashboard restaurante
                {restaurant.plan && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-white text-primary text-[10px] uppercase shadow-sm border border-primary/20">
                    Plan {restaurant.plan}
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-2">
                {restaurant.nombre}
              </h1>
              <p className="text-gray-600 max-w-3xl">
                Gestiona tu negocio de manera eficiente desde un solo lugar.
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-4">
              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'orders'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <ClipboardList size={16} />
                  Pedidos
                  {stats.pendingOrders > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('management')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'management'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <Settings size={16} />
                  Gestión
                </button>
                <button
                  onClick={() => {
                    setActiveTab('payments');
                    setPendingProofsCount(0); // Reset count when visiting the tab
                  }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'payments'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <FileText size={16} />
                  Pagos
                  {pendingProofsCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('coupons')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'coupons'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <Ticket size={16} />
                  Cupones
                </button>
                {restaurant?.plan && restaurant.plan !== 'basico' && (
                  <button
                    onClick={() => setActiveTab('builder')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === 'builder'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-dark'
                    }`}
                  >
                    <Palette size={16} />
                    Page Builder
                  </button>
                )}
                {restaurant?.plan && restaurant.plan !== 'basico' && (
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === 'stats'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-dark'
                    }`}
                  >
                    <BarChart3 size={16} />
                    Estadísticas
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={refreshData}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <RefreshCcw size={16} />
                Refrescar datos
              </button>
              {lastRefreshedAt && (
                <div className="text-xs text-gray-500 text-right space-y-0.5">
                  <span className="block">Última actualización: {lastRefreshedAt.toLocaleString('es-CO')}</span>
                  <span className="block font-medium text-primary/80">Actualización automática cada 7 segundos</span>
                </div>
              )}
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
              className={`rounded-2xl p-4 border-2 flex items-start gap-3 ${
                esVencido
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
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
                    ? 'Tu restaurante pasó a plan Básico. Contacta al administrador para renovar.'
                    : `Renueva antes del ${new Date(restaurant.fecha_vencimiento_plan).toLocaleDateString('es-CO')} para no perder funciones.`}
                </p>
              </div>
            </div>
          );
        })()}

        {activeTab === 'orders' ? (
          <OrdersView
            orders={orders}
            ordersLoading={ordersLoading}
            updatingOrderId={updatingOrderId}
            handleStatusChange={handleStatusChange}
            handleCancelOrder={handleCancelOrder}
            handleViewOrderDetails={handleViewOrderDetails}
            stats={stats}
          />
        ) : activeTab === 'payments' ? (
          <PaymentTabs refreshData={refreshData} />
        ) : activeTab === 'stats' ? (
          <StatsView statsData={statsData} restaurant={restaurant} />
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
        )}
      </div>

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
      />

      <RestaurantModal
        isOpen={isRestaurantModalOpen}
        onClose={() => setIsRestaurantModalOpen(false)}
        onSave={handleSaveRestaurant}
        restaurant={restaurant}
      />

      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrderForDetails}
      />
    </div>
  );
}

function OrdersView({ orders, ordersLoading, updatingOrderId, handleStatusChange, handleCancelOrder, handleViewOrderDetails, stats }) {
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  const { activeOrders, completedOrders } = useMemo(() => {
    return {
      activeOrders: orders.filter(o => o.estado === 'Pendiente' || o.estado === 'Preparando' || o.estado === 'Listo'),
      completedOrders: orders.filter(o => o.estado === 'Entregado'),
    };
  }, [orders]);

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-dark">Recepción de Pedidos</h2>
            <p className="text-gray-600 text-sm">Gestiona la operatividad de tu restaurante en tiempo real.</p>
          </div>
        </div>

        {ordersLoading ? (
          <div className="py-10 text-center text-gray-500">Cargando pedidos...</div>
        ) : (
          <div className="space-y-10">
            {/* --- ACTIVE ORDERS --- */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-6 bg-primary rounded-full"></div>
                <h3 className="text-lg font-bold text-dark">Pedidos Activos</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {activeOrders.length}
                </span>
              </div>

              {activeOrders.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500">
                  <Package size={40} className="mx-auto mb-2 opacity-30" />
                  No hay pedidos activos en este momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      updatingOrderId={updatingOrderId}
                      handleStatusChange={handleStatusChange}
                      handleCancelOrder={handleCancelOrder}
                      onViewDetails={handleViewOrderDetails}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* --- COMPLETED ORDERS --- */}
            <section className="pt-6 border-t border-gray-100">
              <button
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex items-center justify-between w-full p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-gray-400 rounded-full"></div>
                  <h3 className="text-md font-bold text-gray-600 group-hover:text-dark transition-colors">Pedidos Completados / Recientes</h3>
                  <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
                    {completedOrders.length}
                  </span>
                </div>
                <RefreshCcw
                  size={18}
                  className={`text-gray-400 transition-transform duration-300 ${isCompletedExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {isCompletedExpanded && (
                <div className="mt-4 space-y-4">
                  {completedOrders.length === 0 ? (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500">
                      No hay pedidos completados recientemente.
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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 card-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-dark">Gestión de Productos</h2>
            <p className="text-sm text-gray-600">{stats.activeProducts} activos de {products.length} totales</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openProductModal()}
              className="btn btn-primary btn-small inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Nuevo
            </button>
            <Package className="text-primary" />
          </div>
        </div>
        {productsLoading ? (
          <div className="py-8 text-center text-gray-500">Cargando productos...</div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <UtensilsCrossed size={48} className="mx-auto mb-3 opacity-30" />
            No tienes productos cargados todavía.
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {products.map((product) => {
              const available = product.disponible === 1 || product.disponible === true;
              return (
                <div key={product.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-4">
                      {product.imagen_url && (
                        <img src={getImageUrl(product.imagen_url)} alt={product.nombre} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                      )}
                      <div>
                        <h3 className="font-semibold text-dark truncate">{product.nombre}</h3>
                        <p className="text-sm text-gray-500 line-clamp-1">{product.descripcion || 'Sin descripción'}</p>
                        <p className="mt-1 text-sm font-bold text-primary">${Number(product.precio || 0).toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleProduct(product.id)}
                        disabled={togglingProductId === product.id}
                        className="text-primary hover:text-primaryDark transition-colors"
                        title={available ? 'Desactivar disponibilidad' : 'Activar disponibilidad'}
                      >
                        {available ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openProductModal(product)} className="p-2 text-gray-500 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button type="button" onClick={() => handleDeleteProduct(product.id)} disabled={deletingProductId === product.id} className="p-2 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={18} className={deletingProductId === product.id ? 'animate-spin' : ''} /></button>
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${available ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {available ? 'Disponible' : 'No disponible'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <aside className="space-y-6">
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-dark">Datos del Restaurante</h2>
            <button
              type="button"
              onClick={() => setIsRestaurantModalOpen(true)}
              className="btn btn-outline btn-small inline-flex items-center gap-2"
            >
              <Pencil size={16} />
              Editar
            </button>
          </div>
          <div className="mb-4">
            {restaurant.imagen_url ? (
              <img
                src={getImageUrl(restaurant.imagen_url)}
                alt={restaurant.nombre || 'Imagen del restaurante'}
                className="w-full h-40 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-full h-40 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-500">
                <ImageIcon size={28} className="mb-2" />
                <p className="text-sm font-medium">Sin imagen del restaurante</p>
                <p className="text-xs">Usa el boton Editar para agregar una foto</p>
              </div>
            )}
          </div>
          <div className="space-y-3 text-sm text-gray-600">
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
    <div className="card-lg bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-3xl font-heading font-bold text-dark mt-2">{value}</h3>
          <p className="text-xs text-gray-500 mt-2">{description}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="font-semibold text-gray-500">{label}</span>
      <span className="text-right text-gray-800">{value}</span>
    </div>
  );
}

function StatsView({ statsData, restaurant }) {
  const isPremium = restaurant?.plan === 'premium';
  const isProfessional = restaurant?.plan === 'profesional';

  if (!statsData) {
    return (
      <div className="card-lg p-12 text-center text-gray-500">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
        <p>Cargando estadísticas avanzadas...</p>
      </div>
    );
  }

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
            <h2 className="text-xl font-bold text-dark mb-1">
              Estadísticas del Restaurante
            </h2>
            <p className="text-sm text-gray-600">
              Plan actual: <span className="font-bold text-primary capitalize">{restaurant?.plan || 'básico'}</span>
              {isPremium && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
                  ⭐ Premium
                </span>
              )}
            </p>
          </div>
          {!isPremium && (
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-2">Funciones Premium bloqueadas</p>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                🔒 Disponible en Plan Premium
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: VENTAS TOTALES ========== */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h3 className="text-lg font-bold text-dark">Ventas Totales</h3>
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
          <h3 className="text-lg font-bold text-dark">Pedidos</h3>
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
          <h3 className="text-lg font-bold text-dark">Ticket Promedio</h3>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-primary">
            ${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')}
          </span>
          <span className="text-sm text-gray-500">Valor promedio por pedido entregado</span>
        </div>
      </section>

      {/* ========== PLAN PROFESIONAL Y PREMIUM: PRODUCTOS MÁS VENDIDOS ========== */}
      <section className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <UtensilsCrossed className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-dark">Productos Más Vendidos (Top 10)</h3>
        </div>
        {!statsData.productos_mas_vendidos || statsData.productos_mas_vendidos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay productos vendidos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad Vendida</th>
                  <th className="px-4 py-3 text-right">Ingresos Generados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statsData.productos_mas_vendidos
                  .filter(p => p.nombre != null)
                  .slice(0, 10)
                  .map((prod, idx) => (
                    <tr key={`prod-${prod.id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-400">#{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-dark">{prod.nombre || 'Sin nombre'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{prod.cantidad_vendida || 0}</td>
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
          <h3 className="text-lg font-bold text-dark">Ventas por Día (Últimos 30 días)</h3>
        </div>
        {statsData.ventas_diarias?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay datos de ventas registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total Ventas</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statsData.ventas_diarias?.map((day, idx) => {
                  const fecha = day.fecha ? new Date(day.fecha) : null;
                  return (
                    <tr key={`day-${day.fecha}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark">
                        {fecha && !isNaN(fecha.getTime()) ? fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        ${Number(day.total_ventas || 0).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
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
          <h3 className="text-lg font-bold text-dark">Métodos de Pago</h3>
        </div>
        {statsData.metodos_pago?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay registros de métodos de pago.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metodosPagoConPorcentaje.map((metodo, idx) => (
              <div key={`${metodo.metodo_pago}-${idx}`} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700 capitalize">
                    {PAYMENT_METHOD_LABELS[metodo.metodo_pago] || metodo.metodo_pago}
                  </span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {metodo.porcentaje}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-dark">{metodo.cantidad}</p>
                <p className="text-xs text-gray-500">pedidos</p>
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
          <h3 className="text-lg font-bold text-dark">Categorías Más Vendidas</h3>
        </div>
        {!statsData.categorias_mas_vendidas || statsData.categorias_mas_vendidas.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay datos de categorías registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                <tr>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Cantidad Vendida</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statsData.categorias_mas_vendidas
                  .filter(c => c.categoria != null)
                  .map((cat, idx) => (
                    <tr key={`cat-${cat.categoria}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark">{cat.categoria || 'Sin categoría'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{cat.cantidad_vendida || 0}</td>
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
      <section className="card-lg bg-gradient-to-br from-primary/5 to-white">
        <div className="flex items-center gap-3 mb-4">
          <LayoutDashboard className="text-primary" size={24} />
          <h3 className="text-lg font-bold text-dark">Resumen General</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <p className="text-xs text-gray-500 mb-1">Ingresos Totales</p>
            <p className="text-2xl font-bold text-primary">
              ${Number(statsData.resumen?.ingresos_totales || 0).toLocaleString('es-CO')}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <p className="text-xs text-gray-500 mb-1">Total Pedidos</p>
            <p className="text-2xl font-bold text-dark">{statsData.pedidos?.total || 0}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <p className="text-xs text-gray-500 mb-1">Ticket Promedio</p>
            <p className="text-xl font-bold text-dark">
              ${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <p className="text-xs text-gray-500 mb-1">Producto Estrella</p>
            <p className="text-sm font-bold text-dark truncate">
              {statsData.resumen?.producto_estrella?.nombre || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
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
              <h3 className="text-lg font-bold text-dark">Horarios con Más Ventas</h3>
            </div>
            {statsData.hora_pico?.hora != null && (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                ⏰ Hora pico: {String(statsData.hora_pico.hora).padStart(2, '0')}:00 - {String(statsData.hora_pico.hora + 1).padStart(2, '0')}:00
              </span>
            )}
          </div>
          {statsData.ventas_por_hora?.length === 0 || !statsData.ventas_por_hora ? (
            <p className="text-gray-500 text-center py-8">No hay datos de horarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.ventas_por_hora?.filter(h => h.hora != null).map((hora, idx) => (
                    <tr key={`${hora.hora}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark">
                        {String(hora.hora).padStart(2, '0')}:00 - {String(hora.hora + 1).padStart(2, '0')}:00
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{hora.cantidad_pedidos}</td>
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
        <PremiumLockedFeature title="Horarios con Más Ventas" description="Gráfico por horas, hora pico y horas de menor actividad" />
      )}

      {/* ========== SOLO PREMIUM: DÍAS MÁS RENTABLES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-dark">Días Más Rentables</h3>
            </div>
            {statsData.dia_mas_rentable && (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                📈 Día con más ingresos: {statsData.dia_mas_rentable?.dia || 'N/A'}
              </span>
            )}
          </div>
          {statsData.dias_rentables?.length === 0 || !statsData.dias_rentables ? (
            <p className="text-gray-500 text-center py-8">No hay datos de días rentables registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Día</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.dias_rentables?.map((dia, idx) => (
                    <tr key={`${dia.numero_dia}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark capitalize">{dia.dia || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{dia.cantidad_pedidos || 0}</td>
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
        <PremiumLockedFeature title="Días Más Rentables" description="Comparativa semanal y día con más ingresos" />
      )}

      {/* ========== SOLO PREMIUM: CLIENTES RECURRENTES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Clientes Recurrentes (Top 10)</h3>
          </div>
          {statsData.clientes_recurrentes?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay clientes recurrentes registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Teléfono</th>
                    <th className="px-4 py-3 text-right">Total Pedidos</th>
                    <th className="px-4 py-3 text-right">Gasto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.clientes_recurrentes?.map((cliente, idx) => (
                    <tr key={`${cliente.id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark">{cliente.nombre}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{cliente.telefono || 'N/A'}</td>
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
        <PremiumLockedFeature title="Clientes Recurrentes" description="Top clientes, número de pedidos y gasto total" />
      )}

      {/* ========== SOLO PREMIUM: CLIENTES NUEVOS VS RECURRENTES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Clientes Nuevos vs Recurrentes</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statsData.clientes_nuevos_vs_recurrentes?.map((tipo, idx) => (
              <div key={`${tipo.tipo_cliente}-${idx}`} className="border border-gray-200 rounded-xl p-6 bg-white text-center">
                <p className="text-sm font-bold text-gray-600 mb-2 capitalize">{tipo.tipo_cliente}</p>
                <p className="text-4xl font-bold text-primary">{tipo.cantidad}</p>
                <p className="text-xs text-gray-500 mt-1">clientes</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Clientes Nuevos vs Recurrentes" description="Gráfico comparativo de clientes" />
      )}

      {/* ========== SOLO PREMIUM: EVOLUCIÓN DE VENTAS ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <ArrowUpRight className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Evolución de Ventas</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Comparación mensual */}
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h4 className="font-bold text-dark mb-4">Este Mes vs Mes Anterior</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Este mes</span>
                  <span className="font-bold text-primary">
                    ${Number(statsData.evolucion_ventas?.este_mes?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mes anterior</span>
                  <span className="font-bold text-gray-700">
                    ${Number(statsData.evolucion_ventas?.mes_anterior?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Variación</span>
                    <span className={`font-bold ${Number(statsData.crecimiento_mensual) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(statsData.crecimiento_mensual) >= 0 ? '+' : ''}{statsData.crecimiento_mensual}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Comparación semanal */}
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h4 className="font-bold text-dark mb-4">Esta Semana vs Semana Anterior</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Esta semana</span>
                  <span className="font-bold text-primary">
                    ${Number(statsData.evolucion_ventas?.esta_semana?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Semana anterior</span>
                  <span className="font-bold text-gray-700">
                    ${Number(statsData.evolucion_ventas?.semana_anterior?.total || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Variación</span>
                    <span className={`font-bold ${Number(statsData.evolucion_ventas?.esta_semana?.total) >= Number(statsData.evolucion_ventas?.semana_anterior?.total) ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(statsData.evolucion_ventas?.esta_semana?.total) >= Number(statsData.evolucion_ventas?.semana_anterior?.total) ? '+' : '-'}${Math.abs(Number(statsData.evolucion_ventas?.esta_semana?.total) - Number(statsData.evolucion_ventas?.semana_anterior?.total)).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Evolución de Ventas" description="Comparación mes a mes y semana a semana" />
      )}

      {/* ========== SOLO PREMIUM: TASA DE CRECIMIENTO ========== */}
      {isPremium ? (
        <section className="card-lg bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-green-600" size={24} />
            <h3 className="text-lg font-bold text-dark">Tasa de Crecimiento Mensual</h3>
          </div>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${Number(statsData.crecimiento_mensual) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(statsData.crecimiento_mensual) >= 0 ? '+' : ''}{statsData.crecimiento_mensual}%
            </span>
            <span className="text-sm text-gray-600">
              {Number(statsData.crecimiento_mensual) >= 0 ? 'de crecimiento' : 'de decrecimiento'} respecto al mes anterior
            </span>
          </div>
        </section>
      ) : (
        <PremiumLockedFeature title="Tasa de Crecimiento" description="Porcentaje de crecimiento de ventas mensual" />
      )}

      {/* ========== SOLO PREMIUM: RENDIMIENTO DE PROMOCIONES ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <Ticket className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Rendimiento de Promociones</h3>
          </div>
          {statsData.cupones_mas_utilizados?.length === 0 || !statsData.cupones_mas_utilizados ? (
            <p className="text-gray-500 text-center py-8">No hay cupones utilizados registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Cupón</th>
                    <th className="px-4 py-3 text-center">Descuento</th>
                    <th className="px-4 py-3 text-right">Veces Usado</th>
                    <th className="px-4 py-3 text-right">Descuento Otorgado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.cupones_mas_utilizados.map((cupon, idx) => (
                    <tr key={`${cupon.codigo}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-dark">
                        <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold">
                          {cupon.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {cupon.tipo_descuento === 'porcentaje' ? `${cupon.descuento || 0}%` : `$${Number(cupon.descuento || 0).toLocaleString('es-CO')}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
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
        <PremiumLockedFeature title="Rendimiento de Promociones" description="Cupones más utilizados y promociones más rentables" />
      )}

      {/* ========== SOLO PREMIUM: PRODUCTOS CON MAYOR RENTABILIDAD ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Productos con Mayor Rentabilidad</h3>
          </div>
          {!statsData.productos_mayor_rentabilidad || statsData.productos_mayor_rentabilidad.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos de rentabilidad registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.productos_mayor_rentabilidad
                    .filter(p => p.nombre != null)
                    .map((prod, idx) => (
                      <tr key={`rent-${prod.id}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-dark">{prod.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{Number(prod.cantidad_vendida) || 0}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                          ${Number(prod.ingresos_generados || 0).toLocaleString('es-CO')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">
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
        <PremiumLockedFeature title="Productos con Mayor Rentabilidad" description="Producto, cantidad vendida e ingreso generado" />
      )}

      {/* ========== SOLO PREMIUM: TENDENCIAS DE CONSUMO ========== */}
      {isPremium ? (
        <section className="card-lg">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-primary" size={24} />
            <h3 className="text-lg font-bold text-dark">Tendencias de Consumo</h3>
          </div>
          {!statsData.tendencias_productos || statsData.tendencias_productos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos de tendencias registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Últimos 15 días</th>
                    <th className="px-4 py-3 text-right">15-30 días</th>
                    <th className="px-4 py-3 text-right">Tendencia</th>
                    <th className="px-4 py-3 text-right">Variación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statsData.tendencias_productos
                    .filter(p => p.nombre != null)
                    .map((prod, idx) => (
                      <tr key={`trend-${prod.id}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-dark">{prod.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{Number(prod.cantidad_ultimos_15_dias) || 0}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{Number(prod.cantidad_15_a_30_dias) || 0}</td>
                        <td className="px-4 py-3 text-right">
                          {prod.tendencia === 'crecimiento' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                              📈 crecimiento
                            </span>
                          )}
                          {prod.tendencia === 'descenso' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              📉 descenso
                            </span>
                          )}
                          {prod.tendencia === 'nuevo' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              ✨ nuevo
                            </span>
                          )}
                          {prod.tendencia === 'estable' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                              ➖ estable
                            </span>
                          )}
                          {!prod.tendencia && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold">
                          {prod.variacion === 'N/A' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                              N/A
                            </span>
                          )}
                          {prod.variacion && prod.variacion !== 'N/A' && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${String(prod.variacion).startsWith('-') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
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
        <PremiumLockedFeature title="Tendencias de Consumo" description="Productos en crecimiento y descenso" />
      )}
    </div>
  );
}

function PremiumLockedFeature({ title, description }) {
  return (
    <section className="card-lg border-2 border-dashed border-gray-300 bg-gray-50/50">
      <div className="flex items-center gap-3 mb-3 opacity-50">
        <Lock className="text-gray-400" size={24} />
        <h3 className="text-lg font-bold text-gray-500">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-200">
        <span className="text-yellow-700 text-sm font-bold">⭐ Disponible solo en Plan Premium</span>
      </div>
    </section>
  );
}
