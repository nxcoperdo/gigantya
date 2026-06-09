import { useEffect, useMemo, useRef, useState } from 'react';
import { authService, orderService, productService, couponService, restaurantService, paymentService } from '../services/api';
import Loading from '../components/Loading';
import ProductModal from '../components/ProductModal';
import RestaurantModal from '../components/RestaurantModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import CouponsView from '../components/CouponsView';
import PaymentTabs from '../components/PaymentTabs';
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

function OrderCard({ order, updatingOrderId, handleStatusChange, onViewDetails, isMuted = false }) {
  const nextStatus = NEXT_STATUS_BY_STATE[order.estado];
  return (
    <article className={`border border-gray-200 rounded-2xl p-4 md:p-5 bg-white hover:shadow-md transition-shadow ${isMuted ? 'opacity-80 grayscale-[0.2]' : ''}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-dark">Pedido #{order.id}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ORDER_STATE_STYLES[order.estado] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              {order.estado}
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
          </div>
        </div>
      </div>
    </article>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-scaleUp">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">{title}</h3>
          <p className="text-gray-600 mb-8">{message}</p>

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
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, orderId: null, nextStatus: null });
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
    });
  };

  const confirmStatusChange = async () => {
    const { orderId, nextStatus } = confirmAction;
    if (!orderId || !nextStatus) return;

    try {
      setError('');
      setUpdatingOrderId(orderId);
      await orderService.updateStatus(orderId, nextStatus);
      await refreshData();
      setConfirmAction({ isOpen: false, orderId: null, nextStatus: null });
    } catch (err) {
      console.error('Error actualizando estado del pedido:', err);
      setError(err.response?.data?.error || 'No se pudo actualizar el estado del pedido');
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'orders'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <ClipboardList size={16} />
                  Pedidos
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
                  onClick={() => setActiveTab('payments')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'payments'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  <FileText size={16} />
                  Pagos
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
        onClose={() => setConfirmAction({ isOpen: false, orderId: null, nextStatus: null })}
        onConfirm={confirmStatusChange}
        title="Confirmar Cambio de Estado"
        message={`¿Estás seguro de que deseas cambiar el estado del pedido #${confirmAction.orderId} a ${confirmAction.nextStatus}?`}
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

function OrdersView({ orders, ordersLoading, updatingOrderId, handleStatusChange, handleViewOrderDetails, stats }) {
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
  if (!statsData) {
    return (
      <div className="card-lg p-12 text-center text-gray-500">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
        <p>Cargando estadísticas avanzadas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          title="Ingresos Totales"
          value={`$${Number(statsData.ingresos_totales || 0).toLocaleString('es-CO')}`}
          icon={<Banknote size={20} />}
          description="Suma de todos los pedidos entregados"
        />
        <StatCard
          title="Total Pedidos"
          value={statsData.pedidos_totales || 0}
          icon={<ShoppingBag size={20} />}
          description="Cantidad de pedidos procesados"
        />
        <StatCard
          title="Plan Actual"
          value={restaurant?.plan?.toUpperCase() || 'BÁSICO'}
          icon={<ShieldCheck size={20} />}
          description="Suscripción activa"
        />
      </section>

      <section className="card-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="text-primary" size={24} />
          <h2 className="text-2xl font-bold text-dark">Ventas Diarias (Últimos 30 días)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3 text-right">Total Ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statsData.ventas_diarias?.length === 0 ? (
                <tr><td colSpan="2" className="px-6 py-10 text-center text-gray-500">No hay datos de ventas registrados.</td></tr>
              ) : (
                statsData.ventas_diarias?.map((day, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-dark">
                      {new Date(day.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-primary">
                      ${Number(day.total || 0).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
