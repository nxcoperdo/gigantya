import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/api';
import Loading from '../components/Loading';
import { ShieldCheck, Store, Users, ShoppingBag, ShoppingBasket, Banknote, RefreshCcw, AlertCircle, ThumbsUp, ThumbsDown, UserPlus, Trash2, Bell, BarChart3, Package, ClipboardList, X, Save, Tags, Percent, Truck, MapPin, Zap, Ticket, UtensilsCrossed, Croissant, Activity, FileText, History, Eye, Edit2, ImageIcon, Type } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';
import UserManagementModal from '../components/UserManagementModal';
import UserDetailModal from '../components/UserDetailModal';
import AdminPaymentProofsView from '../components/AdminPaymentProofsView';
import AuditLogView from '../components/AuditLogView';
import TaxShippingConfigModal from '../components/TaxShippingConfigModal';
import ZonasAdmin from '../components/ZonasAdmin';
import CouponsView from '../components/CouponsView';
import FeaturedBannersDownloadButton from '../components/FeaturedBannersDownloadButton';
import { formatDate } from '../utils/dateHelper';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Data States
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState({ topRestaurants: [], topProducts: [] });
  const [restaurants, setRestaurants] = useState([]);
  const [pendingRestaurants, setPendingRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  // Usuarios activos en los últimos 5 min. Se carga junto con el resto en
  // `loadData()` y se refresca cada 30s con `setInterval` para mantener
  // la vista "en vivo" sin que el admin tenga que recargar.
  const [onlineUsers, setOnlineUsers] = useState([]);
  // Filtro de rol para la sección "Usuarios Online". Solo cliente/filtrado
  // local, no vuelve a llamar al endpoint. "todos" muestra los 3 roles.
  const [onlineFilter, setOnlineFilter] = useState('todos');

  // UI States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  // ID del usuario cuyo detalle se está viendo (null = modal cerrado).
  const [userDetailId, setUserDetailId] = useState(null);
  // Conteo de comprobantes pendientes para el badge del tab "Comprobantes".
  // Se llena desde AdminPaymentProofsView.onCountChange.
  const [pendingComprobantesCount, setPendingComprobantesCount] = useState(0);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState('');
  // Modal para asignar plan Profesional/Premium con fecha de vencimiento
  const [planModal, setPlanModal] = useState({ isOpen: false, restaurantId: null, plan: null });
  // Modal para crear/editar categorías
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  // Modal para configurar impuestos y envíos
  const [isTaxShippingModalOpen, setIsTaxShippingModalOpen] = useState(false);
  const [restaurantToConfig, setRestaurantToConfig] = useState(null);
  // ID del restaurante cuyo toggle de modalidad se está actualizando (para spinner inline)
  const [updatingDomicilioId, setUpdatingDomicilioId] = useState(null);
  // ID del restaurante cuyo toggle de "Mercado y abarrotes" se está actualizando.
  const [updatingEsMercadoId, setUpdatingEsMercadoId] = useState(null);
  // ID del restaurante cuyo toggle de "Comida rápida" se está actualizando.
  const [updatingEsComidaRapidaId, setUpdatingEsComidaRapidaId] = useState(null);
  // ID del restaurante cuyo toggle de "Es restaurante" se está actualizando.
  const [updatingEsRestauranteId, setUpdatingEsRestauranteId] = useState(null);
  // ID del restaurante cuyo toggle de "Es panadería/pastelería" se está actualizando.
  const [updatingEsPanaderiaPasteleriaId, setUpdatingEsPanaderiaPasteleriaId] = useState(null);
  // ID del restaurante cuyo toggle de "Ofrece consumo en el local" se está actualizando.
  const [updatingConsumoEnLocalId, setUpdatingConsumoEnLocalId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError('');
      setLoading(true);
      const [statsRes, restaurantsRes, pendingRes, usersRes, ordersRes, analyticsRes, categoriesRes, onlineRes] = await Promise.all([
        adminService.getStats(),
        adminService.getRestaurants(),
        adminService.getPendingRestaurants(),
        adminService.getUsers(),
        adminService.getOrders(),
        adminService.getAnalytics(),
        adminService.getCategories(),
        // Online users: si falla, no bloqueamos la carga principal
        adminService.getOnlineUsers().catch(() => ({ data: { total: 0, usuarios: [] } })),
      ]);

      setStats(statsRes.data?.estadisticas || null);
      setRestaurants(restaurantsRes.data?.restaurantes || []);
      setPendingRestaurants(pendingRes.data?.restaurantes || []);
      setUsers(usersRes.data?.usuarios || []);
      setOrders(ordersRes.data?.pedidos || []);
      setAnalytics(analyticsRes.data?.analytics || { topRestaurants: [], topProducts: [] });
      setCategories(categoriesRes.data?.categorias || []);
      setOnlineUsers(onlineRes.data?.usuarios || []);
    } catch (err) {
      console.error('Error cargando panel admin:', err);
      setError(err.response?.data?.error || 'No se pudo cargar la información del panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Carga SOLO la lista de usuarios online. Pensado para llamarse desde el
   * setInterval de auto-refresh (cada 30s) y desde el botón Refrescar. Si
   * falla, dejamos la lista anterior en pantalla en vez de tirar un error
   * que oculte el resto del panel.
   */
  const loadOnlineUsers = async () => {
    try {
      const res = await adminService.getOnlineUsers();
      setOnlineUsers(res.data?.usuarios || []);
    } catch (err) {
      console.error('Error refrescando usuarios online:', err);
    }
  };

  // Auto-refresh de online cada 30s. Limpia el interval al desmontar o
  // cuando el admin sale del tab overview. Se monta siempre que el
  // componente está activo porque el panel puede estar visible en
  // cualquier tab; el costo es despreciable (1 query de ~5ms).
  useEffect(() => {
    const id = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(id);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadOnlineUsers()]);
  };

  const pendingCount = useMemo(() => pendingRestaurants.length, [pendingRestaurants]);

  const handleApprove = async (restaurantId) => {
    try {
      setError('');
      setActionId(restaurantId);
      setActionType('approve');
      await adminService.approveRestaurant(restaurantId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo aprobar el local');
    } finally {
      setActionId(null);
      setActionType('');
    }
  };

  const handleReject = async (restaurantId) => {
    try {
      setError('');
      setActionId(restaurantId);
      setActionType('reject');
      await adminService.rejectRestaurant(restaurantId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo rechazar el local');
    } finally {
      setActionId(null);
      setActionType('');
    }
  };

  const handleUpdatePlan = async (restaurantId, newPlan) => {
    // Free y Básico: enviar directo al backend sin fecha de vencimiento.
    // El modal de fecha solo se abre para planes de pago.
    if (newPlan === 'free' || newPlan === 'basico') {
      try {
        setError('');
        await adminService.updateRestaurantPlan(restaurantId, { plan: newPlan });
        await loadData();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al actualizar el plan');
      }
    } else {
      setPlanModal({ isOpen: true, restaurantId, plan: newPlan });
    }
  };

  // Cambia en línea si un restaurante ofrece domicilio o solo retiro en local.
  // Refleja el cambio optimista en el state local y, si la API falla, revierte.
  const handleToggleDomicilio = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    // Optimista: actualizamos la fila al instante para que la UI no parpadee.
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, ofrece_domicilio: nuevoValor ? 1 : 0 } : r));
    setUpdatingDomicilioId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantDomicilio(restaurantId, nuevoValor);
    } catch (err) {
      // Revertir si falló.
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar la modalidad');
    } finally {
      setUpdatingDomicilioId(null);
    }
  };

  // Cambia en línea si un restaurante es de tipo "Mercado y abarrotes".
  // Mismo patrón que `handleToggleDomicilio`: optimistic update + reversión
  // ante error. El flag es independiente de `ofrece_domicilio`.
  const handleToggleEsMercado = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, es_mercado_abarrotes: nuevoValor ? 1 : 0 } : r));
    setUpdatingEsMercadoId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantEsMercado(restaurantId, nuevoValor);
    } catch (err) {
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar el tipo de negocio');
    } finally {
      setUpdatingEsMercadoId(null);
    }
  };

  // Cambia en línea si un restaurante es de tipo "Comida rápida".
  // Mismo patrón que `handleToggleEsMercado`: optimistic update + reversión
  // ante error. El flag es independiente de los otros dos.
  const handleToggleEsComidaRapida = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, es_comida_rapida: nuevoValor ? 1 : 0 } : r));
    setUpdatingEsComidaRapidaId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantEsComidaRapida(restaurantId, nuevoValor);
    } catch (err) {
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar el tipo de negocio');
    } finally {
      setUpdatingEsComidaRapidaId(null);
    }
  };

  // Cambia en línea si un restaurante es de tipo "Es restaurante".
  // Mismo patrón que los otros toggles de nicho. Activar este toggle junto
  // al de Comida rápida hace que el local aparezca en ambos feeds
  // (Restaurantes + Comida rápida).
  const handleToggleEsRestaurante = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, es_restaurante: nuevoValor ? 1 : 0 } : r));
    setUpdatingEsRestauranteId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantEsRestaurante(restaurantId, nuevoValor);
    } catch (err) {
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar el tipo de negocio');
    } finally {
      setUpdatingEsRestauranteId(null);
    }
  };

  // Cambia en línea si un restaurante es de tipo "Panadería/pastelería".
  // Mismo patrón que los otros toggles de nicho. Es combinable con
  // `es_restaurante` y `es_comida_rapida`, y mutuamente excluyente con
  // `es_mercado_abarrotes` (esa exclusión se valida solo en la UI, no
  // a nivel DB).
  const handleToggleEsPanaderiaPasteleria = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, es_panaderia_pasteleria: nuevoValor ? 1 : 0 } : r));
    setUpdatingEsPanaderiaPasteleriaId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantEsPanaderiaPasteleria(restaurantId, nuevoValor);
    } catch (err) {
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar el tipo de negocio');
    } finally {
      setUpdatingEsPanaderiaPasteleriaId(null);
    }
  };

  // Cambia en línea si un restaurante ofrece "consumo en el local"
  // (modalidad "comer en la mesa"). Réplica de los otros toggles de
  // modalidad. Cuando se activa, el cliente puede elegir esa opción
  // en el checkout; cuando se desactiva, el botón aparece deshabilitado.
  const handleToggleConsumoEnLocal = async (restaurantId, currentValue) => {
    const nuevoValor = !currentValue;
    const snapshot = restaurants;
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, ofrece_consumo_en_local: nuevoValor ? 1 : 0 } : r));
    setUpdatingConsumoEnLocalId(restaurantId);
    try {
      setError('');
      await adminService.updateRestaurantConsumoEnLocal(restaurantId, nuevoValor);
    } catch (err) {
      setRestaurants(snapshot);
      setError(err.response?.data?.error || 'Error al cambiar la modalidad de consumo en el local');
    } finally {
      setUpdatingConsumoEnLocalId(null);
    }
  };

  const submitPlanModal = async (data) => {
    try {
      setError('');
      await adminService.updateRestaurantPlan(planModal.restaurantId, data);
      setPlanModal({ isOpen: false, restaurantId: null, plan: null });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el plan');
    }
  };

  const handleCreateCategory = async (data) => {
    try {
      setError('');
      await adminService.createCategory(data);
      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la categoría');
    }
  };

  const handleUpdateCategory = async (id, data) => {
    try {
      setError('');
      await adminService.updateCategory(id, data);
      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar la categoría');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      setError('');
      await adminService.deleteCategory(id);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la categoría');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción es irreversible.')) return;
    try {
      setError('');
      await adminService.deleteUser(userId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar usuario');
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      setError('');
      await adminService.updateUserStatus(userId, newStatus);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const handleEditUser = (user) => {
    setUserToEdit(user);
    setIsUserModalOpen(true);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setError('');
      await adminService.updateOrderStatus(orderId, newStatus);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar pedido');
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">

        {/* Header Section */}
        <section
          className="card-lg p-7 md:p-10 relative overflow-hidden"
          style={{
            backgroundImage: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-subtle) 60%, var(--warning-bg) 100%)',
          }}
        >
          {/* Decoración esquina superior derecha */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--color-primary), transparent 70%)' }}
          />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative">
            <div className="flex flex-col gap-3">
              <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs w-fit uppercase tracking-wide"
              style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}
            >
                <ShieldCheck size={14} />
                Super Administrador
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-extrabold text-[color:var(--text-primary)] tracking-tight">
                Centro de Control Gigantya
              </h1>
              <div className="w-16 h-1 bg-gradient-primary rounded-full"></div>
              <p className="text-[color:var(--text-secondary)] max-w-2xl text-base md:text-lg">
                Gestión total de la plataforma: usuarios, locales, pedidos y analíticas globales.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/home-media')}
                className="btn btn-outline inline-flex items-center gap-2 text-primary border-primary/30"
                title="Gestionar el banner que se muestra en la home pública"
              >
                <ImageIcon size={16} />
                Banner de Home
              </button>
              <FeaturedBannersDownloadButton />
              <button
                type="button"
                onClick={() => navigate('/admin/home-hero')}
                className="btn btn-outline inline-flex items-center gap-2 text-primary border-primary/30"
                title="Editar los textos y botones del hero de la home pública"
              >
                <Type size={16} />
                Textos del Hero
              </button>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <UserPlus size={16} />
                Nuevo Usuario
              </button>
              <button
                type="button"
                onClick={() => setIsNotifyModalOpen(true)}
                className="btn btn-outline inline-flex items-center gap-2 text-primary border-primary/30"
              >
                <Bell size={16} />
                Notificación Global
              </button>
              <button
                type="button"
                onClick={refresh}
                className="btn btn-outline inline-flex items-center gap-2"
              >
                <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Actualizando...' : 'Refrescar'}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-error animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <AdminStatCard title="Usuarios" value={stats?.usuarios_totales ?? 0} icon={<Users size={20} />} />
          <AdminStatCard title="Locales" value={stats?.restaurantes_aprobados ?? 0} icon={<Store size={20} />} />
          <AdminStatCard title="Pedidos" value={stats?.pedidos_totales ?? 0} icon={<ShoppingBag size={20} />} />
          <AdminStatCard title="Ingresos" value={`$${Number(stats?.ingresos_totales || 0).toLocaleString('es-CO')}`} icon={<Banknote size={20} />} />
        </section>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-1.5 p-1.5 bg-[color:var(--bg-muted)] rounded-2xl w-fit border border-[color:var(--border-subtle)]">
          {[
            { id: 'overview', label: 'Vista General', icon: <BarChart3 size={16} /> },
            { id: 'users', label: 'Usuarios', icon: <Users size={16} /> },
            { id: 'restaurants', label: 'Locales', icon: <Store size={16} /> },
            { id: 'orders', label: 'Pedidos', icon: <ClipboardList size={16} /> },
            { id: 'comprobantes', label: 'Comprobantes', icon: <FileText size={16} />, badge: pendingComprobantesCount },
            { id: 'auditoria', label: 'Auditoría', icon: <History size={16} /> },
            { id: 'categories', label: 'Categorías', icon: <Tags size={16} /> },
            { id: 'coupons', label: 'Cupones', icon: <Ticket size={16} /> },
            { id: 'zonas', label: 'Zonas', icon: <MapPin size={16} /> },
            { id: 'analytics', label: 'Analíticas', icon: <Package size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative ${
                activeTab === tab.id
                  ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-base)]/60'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                  style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}
                  aria-label={`${tab.badge} pendientes`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* CONTENT AREAS */}
        <div className="space-y-8 pb-12">

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">

              {/* Usuarios Online — sección grande full-width con filtro por rol.
                  Se carga al inicio y se auto-refresca cada 30s (loadOnlineUsers). */}
              <section className="card-lg overflow-hidden">
                <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Usuarios Online</h2>
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}
                      title="Activos en los últimos 5 minutos"
                    >
                      {onlineUsers.length} en línea
                    </span>
                  </div>
                  <Activity className="text-primary flex-shrink-0" size={24} />
                </div>

                {/* Chips de filtro por rol. Solo filtran en cliente, no
                    llaman al endpoint de nuevo. "todos" muestra los 3 roles. */}
                <div className="px-6 pt-4 flex flex-wrap gap-2">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'cliente', label: 'Clientes' },
                    { id: 'restaurante', label: 'Restaurantes' },
                    { id: 'admin', label: 'Admins' },
                  ].map((f) => {
                    const active = onlineFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setOnlineFilter(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          active
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-base)]'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-6">
                  {(() => {
                    // Filtrado local. Si no hay usuarios o el filtro deja la lista vacía,
                    // mensaje amable. La lista filtrada se memoiza con el array de
                    // usuarios y el filtro seleccionado.
                    const filtrados = onlineFilter === 'todos'
                      ? onlineUsers
                      : onlineUsers.filter((u) => u.tipo_usuario === onlineFilter);

                    if (onlineUsers.length === 0) {
                      return (
                        <div className="py-10 text-center text-[color:var(--text-muted)]">
                          Nadie conectado en los últimos 5 minutos.
                        </div>
                      );
                    }
                    if (filtrados.length === 0) {
                      return (
                        <div className="py-10 text-center text-[color:var(--text-muted)]">
                          No hay usuarios de este rol conectados ahora mismo.
                        </div>
                      );
                    }
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                            <tr>
                              <th className="px-4 py-3">Usuario</th>
                              <th className="px-4 py-3">Rol</th>
                              <th className="px-4 py-3 text-right">Hace</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[color:var(--border-subtle)]">
                            {filtrados.map((u) => {
                              const rol = u.tipo_usuario;
                              const hace = Number(u.hace_segundos) || 0;
                              const haceLabel =
                                hace < 60
                                  ? `${hace}s`
                                  : hace < 3600
                                  ? `${Math.floor(hace / 60)}m`
                                  : `${Math.floor(hace / 3600)}h`;
                              const rolStyle =
                                rol === 'admin'
                                  ? { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }
                                  : rol === 'restaurante'
                                  ? { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }
                                  : { backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' };
                              return (
                                <tr key={u.id} className="hover:bg-[color:var(--bg-muted)]/40 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                        {(u.nombre || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-sm text-[color:var(--text-primary)] truncate">{u.nombre}</p>
                                        <p className="text-xs text-[color:var(--text-muted)] truncate">{u.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                                      style={rolStyle}
                                    >
                                      {rol}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs text-[color:var(--text-muted)] whitespace-nowrap">
                                    hace {haceLabel}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* Pendientes de Aprobación — full-width, ya no comparte fila */}
              <section className="card-lg">
                <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Pendientes de Aprobación</h2>
                  <AlertCircle className="text-primary" size={24} />
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingRestaurants.length === 0 ? (
                    <div className="col-span-2 py-10 text-center text-[color:var(--text-muted)]">No hay solicitudes pendientes.</div>
                  ) : (
                    pendingRestaurants.map((res) => (
                      <div key={res.id} className="border border-[color:var(--border-default)] rounded-2xl p-4 bg-[color:var(--bg-elevated)] space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-[color:var(--text-primary)]">{res.nombre}</h3>
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}
                          >Pendiente</span>
                        </div>
                        <p className="text-xs text-[color:var(--text-secondary)]">{res.descripcion || 'Sin descripción'}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(res.id)} className="btn btn-primary btn-small flex-1 py-1 text-xs">Aprobar</button>
                          <button
                            onClick={() => handleReject(res.id)}
                            className="btn btn-outline btn-small flex-1 py-1 text-xs"
                            style={{ color: 'var(--danger-text)' }}
                          >Rechazar</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Resumen Rápido — antes estaba en el aside, ahora full-width abajo */}
              <section className="card-lg p-6">
                <h3 className="text-lg font-bold text-[color:var(--text-primary)] mb-4">Resumen Rápido</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <InfoRow label="Pendientes" value={pendingCount} />
                  <InfoRow label="Aprobados" value={stats?.restaurantes_aprobados ?? 0} />
                  <InfoRow label="Total Usuarios" value={stats?.usuarios_totales ?? 0} />
                </div>
              </section>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Gestión de Usuarios</h2>
                <Users className="text-primary" size={24} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3">Rol</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[color:var(--text-primary)]">{user.nombre}</p>
                          <p className="text-xs text-[color:var(--text-muted)]">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="text-xs font-bold px-2 py-1 rounded-full"
                            style={user.tipo_usuario === 'admin'
                              ? { backgroundColor: 'var(--accent-purple-bg)', color: 'var(--accent-purple-text)' }
                              : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }
                            }
                          >{user.tipo_usuario}</span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.estado}
                            onChange={(e) => handleStatusChange(user.id, e.target.value)}
                            className="text-xs p-1 border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded outline-none"
                          >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="suspendido">Suspendido</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setUserDetailId(user.id)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg mobile-tap-target"
                              aria-label={`Ver detalle de ${user.nombre}`}
                              title="Ver detalle"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditUser(user)}
                              className="p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] rounded-lg mobile-tap-target"
                              aria-label={`Editar ${user.nombre}`}
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 rounded-lg mobile-tap-target"
                            style={{ color: 'var(--danger-text)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            aria-label={`Eliminar ${user.nombre}`}
                            title="Eliminar"
                          ><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: RESTAURANTS */}
          {activeTab === 'restaurants' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 md:p-7 border-b border-[color:var(--border-subtle)] flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-[color:var(--text-primary)] tracking-tight">Gestión de Locales</h2>
                  <p className="text-sm text-[color:var(--text-muted)] mt-1">Aprueba, suspende o cambia la modalidad de cada local</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Store className="text-primary" size={22} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-6 py-3">Local</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Aprobación</th>
                      <th className="px-6 py-3">Modalidad</th>
                      <th className="px-6 py-3">Plan</th>
                      <th className="px-6 py-3">Vence</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {restaurants.length === 0 ? (
                      <tr><td colSpan="7" className="px-6 py-10 text-center text-[color:var(--text-muted)]">No hay locales registrados.</td></tr>
                    ) : (
                      restaurants.map(res => {
                        // Normalizar `ofrece_domicilio` que llega como 1/0/true/false.
                        const ofreceDomicilio = res.ofrece_domicilio === undefined
                          ? true
                          : Boolean(Number(res.ofrece_domicilio));
                        const isUpdatingDomicilio = updatingDomicilioId === res.id;
                        // Normalizar `es_mercado_abarrotes` que llega como 1/0/true/false/undefined.
                        // El default es FALSE (locales existentes no son mercados).
                        const esMercadoAbarrotes = res.es_mercado_abarrotes === undefined
                          ? false
                          : Boolean(Number(res.es_mercado_abarrotes));
                        const isUpdatingEsMercado = updatingEsMercadoId === res.id;
                        // Normalizar `es_comida_rapida` que llega como 1/0/true/false/undefined.
                        // El default es FALSE (locales existentes no son comida rápida).
                        const esComidaRapida = res.es_comida_rapida === undefined
                          ? false
                          : Boolean(Number(res.es_comida_rapida));
                        const isUpdatingEsComidaRapida = updatingEsComidaRapidaId === res.id;
                        // Normalizar `es_restaurante` que llega como 1/0/true/false/undefined.
                        // El default es TRUE: los locales existentes (anteriores a la
                        // migración 20260702000001_add_es_restaurante_to_restaurantes.js)
                        // arrancan como restaurantes, salvo los que fueron migrados a
                        // es_restaurante=0 por la data migration (los que ya tenían
                        // es_comida_rapida=1 pre-existente).
                        const esRestaurante = res.es_restaurante === undefined
                          ? true
                          : Boolean(Number(res.es_restaurante));
                        const isUpdatingEsRestaurante = updatingEsRestauranteId === res.id;
                        // Normalizar `es_panaderia_pasteleria` que llega como 1/0/true/false/undefined.
                        // El default es FALSE (locales existentes no son panaderías).
                        // Es combinable con `es_restaurante` y `es_comida_rapida`, y
                        // mutuamente excluyente con `es_mercado_abarrotes` (esa
                        // exclusión se valida solo en la UI, no a nivel DB).
                        const esPanaderiaPasteleria = res.es_panaderia_pasteleria === undefined
                          ? false
                          : Boolean(Number(res.es_panaderia_pasteleria));
                        const isUpdatingEsPanaderiaPasteleria = updatingEsPanaderiaPasteleriaId === res.id;
                        // Normalizar `ofrece_consumo_en_local` (comer en la mesa).
                        // Default FALSE: locales existentes no ofrecen esta modalidad
                        // hasta que el admin la active explícitamente.
                        const ofreceConsumoEnLocal = res.ofrece_consumo_en_local === undefined
                          ? false
                          : Boolean(Number(res.ofrece_consumo_en_local));
                        const isUpdatingConsumoEnLocal = updatingConsumoEnLocalId === res.id;
                        return (
                          <tr key={res.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-[color:var(--text-primary)]">{res.nombre}</p>
                              <p className="text-xs text-[color:var(--text-muted)]">{res.email || 'Sin email'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span
                              className="text-xs font-bold px-2 py-1 rounded-full"
                              style={res.estado === 'activo'
                                ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }
                                : { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }
                              }
                            >
                              {res.estado}
                            </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                              className="text-xs font-bold px-2 py-1 rounded-full"
                              style={res.aprobado === 1
                                ? { backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }
                                : { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }
                              }
                            >
                              {res.aprobado === 1 ? 'Aprobado' : 'Pendiente'}
                            </span>
                            </td>
                            <td className="px-6 py-4">
                              {/* Toggle inline: cambia la modalidad del restaurante sin recargar.
                                  ON = domicilios, OFF = solo retiro en local. */}
                              <div className="inline-flex items-center gap-2.5">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={ofreceDomicilio}
                                  disabled={isUpdatingDomicilio}
                                  onClick={() => handleToggleDomicilio(res.id, ofreceDomicilio)}
                                  title={ofreceDomicilio ? 'Ofrece servicio a domicilio' : 'Solo retiro en local'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ring-1 ring-inset ${
                                    ofreceDomicilio
                                      ? 'bg-primary ring-primary/30'
                                      : 'bg-[color:var(--border-default)] ring-[color:var(--border-strong)]'
                                  } ${isUpdatingDomicilio ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                      ofreceDomicilio ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {ofreceDomicilio ? (
                                    <span className="inline-flex items-center gap-1 text-primary">
                                      <Truck size={12} /> Domicilios
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <Store size={12} /> Solo local
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Bloque "Tipo de negocio": agrupa los cuatro switches
                                  de nicho (Es restaurante, Mercado, Comida rápida,
                                  Panadería/Pastelería). Cada flag es independiente:
                                  un local puede estar marcado en ninguno, uno, dos,
                                  tres, o los cuatro a la vez. En el feed del cliente,
                                  los combos se reflejan haciendo que el local
                                  aparezca en cada filtro de nicho que coincida con
                                  un flag activo. Por ejemplo, activar "Es
                                  restaurante" + "Comida rápida" hace que el local
                                  salga tanto en el feed "Restaurantes" como en
                                  "Comida rápida". "Mercado" sigue siendo
                                  mutuamente excluyente con el resto. */}
                              <div className="mt-3 pt-2 border-t border-dashed border-[color:var(--border-subtle)]">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-muted)] mb-1.5">
                                  Tipo de negocio
                                </p>

                              {/* Primer toggle del bloque: tipo de negocio "Es restaurante".
                                  Default TRUE para locales nuevos. Desactivarlo hace
                                  que el local deje de aparecer en el feed
                                  "Restaurantes" (típico: hamburguesería registrada
                                  como "solo comida rápida"). Combinable con el
                                  toggle de Comida rápida para el caso combo. */}
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={esRestaurante}
                                  disabled={isUpdatingEsRestaurante}
                                  onClick={() => handleToggleEsRestaurante(res.id, esRestaurante)}
                                  title={esRestaurante ? 'Es un local de tipo restaurante' : 'No es un restaurante'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                                    esRestaurante ? 'bg-primary' : 'bg-[color:var(--border-default)]'
                                  } ${isUpdatingEsRestaurante ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      esRestaurante ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {esRestaurante ? (
                                    <span className="inline-flex items-center gap-1 text-primary">
                                      <UtensilsCrossed size={12} /> Es restaurante
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <UtensilsCrossed size={12} /> No es restaurante
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Segundo toggle del bloque: tipo de negocio "Mercado y abarrotes".
                                  Independiente del toggle de modalidad de arriba.
                                  Mutuamente excluyente con los toggles de restaurante
                                  y comida rápida: un mercado no puede combinar. */}
                              <div className="inline-flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={esMercadoAbarrotes}
                                  disabled={isUpdatingEsMercado}
                                  onClick={() => handleToggleEsMercado(res.id, esMercadoAbarrotes)}
                                  title={esMercadoAbarrotes ? 'Es un mercado/abarrotes' : 'No es mercado/abarrotes'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                                    esMercadoAbarrotes ? 'bg-[color:var(--success-text)]' : 'bg-[color:var(--border-default)]'
                                  } ${isUpdatingEsMercado ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      esMercadoAbarrotes ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {esMercadoAbarrotes ? (
                                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--success-text)' }}>
                                      <ShoppingBasket size={12} /> Mercado
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <ShoppingBasket size={12} /> No es mercado
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Tercer toggle del bloque: tipo de negocio "Comida rápida".
                                  Mismo patrón que el toggle de mercado: switch inline
                                  que actualiza el flag `es_comida_rapida` en la BD.
                                  Color amber-500 para diferenciarlo visualmente de
                                  mercado (verde), restaurante (primary) y domicilio.
                                  Activar este toggle junto al de "Es restaurante"
                                  hace que el local sea "restaurante + comida rápida"
                                  (combo) y aparezca en ambos filtros de la home. */}
                              <div className="inline-flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={esComidaRapida}
                                  disabled={isUpdatingEsComidaRapida}
                                  onClick={() => handleToggleEsComidaRapida(res.id, esComidaRapida)}
                                  title={esComidaRapida ? 'Es un local de comida rápida' : 'No es comida rápida'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                                    esComidaRapida ? 'bg-amber-500' : 'bg-[color:var(--border-default)]'
                                  } ${isUpdatingEsComidaRapida ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      esComidaRapida ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {esComidaRapida ? (
                                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                      <Zap size={12} /> Comida rápida
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <Zap size={12} /> No es comida rápida
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Cuarto toggle del bloque: tipo de negocio
                                  "Panadería/pastelería". Mismo patrón que los
                                  toggles de mercado y comida rápida: switch
                                  inline que actualiza el flag
                                  `es_panaderia_pasteleria` en la BD. Color
                                  rose-500 para diferenciarlo visualmente de
                                  los otros (mercado verde, restaurante primary,
                                  comida rápida amber). Es combinable con
                                  restaurante y comida rápida; mutuamente
                                  excluyente con mercado (esa exclusión se
                                  valida solo en la UI). */}
                              <div className="inline-flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={esPanaderiaPasteleria}
                                  disabled={isUpdatingEsPanaderiaPasteleria}
                                  onClick={() => handleToggleEsPanaderiaPasteleria(res.id, esPanaderiaPasteleria)}
                                  title={esPanaderiaPasteleria ? 'Es panadería/pastelería' : 'No es panadería/pastelería'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                                    esPanaderiaPasteleria ? 'bg-rose-500' : 'bg-[color:var(--border-default)]'
                                  } ${isUpdatingEsPanaderiaPasteleria ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      esPanaderiaPasteleria ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {esPanaderiaPasteleria ? (
                                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                      <Croissant size={12} /> Panadería/Pastelería
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <Croissant size={12} /> No es panadería
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Cuarto toggle del bloque: modalidad "Ofrece consumo
                                  en el local" (comer en la mesa). Independiente de
                                  los flags de nicho y del toggle de modalidad de
                                  arriba. Cuando está activo, el cliente puede
                                  elegir "Consumo en el local" en el checkout y
                                  la mesera lleva el pedido a la mesa. No se cobra
                                  envío. Cuando está inactivo, el botón aparece
                                  deshabilitado con candado en el checkout. */}
                              <div className="inline-flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={ofreceConsumoEnLocal}
                                  disabled={isUpdatingConsumoEnLocal}
                                  onClick={() => handleToggleConsumoEnLocal(res.id, ofreceConsumoEnLocal)}
                                  title={ofreceConsumoEnLocal
                                    ? 'Acepta pedidos para consumir en el local'
                                    : 'No ofrece consumo en el local'}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                                    ofreceConsumoEnLocal ? 'bg-orange-500' : 'bg-[color:var(--border-default)]'
                                  } ${isUpdatingConsumoEnLocal ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      ofreceConsumoEnLocal ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] whitespace-nowrap">
                                  {ofreceConsumoEnLocal ? (
                                    <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                      <UtensilsCrossed size={12} /> Consumo en local
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
                                      <UtensilsCrossed size={12} /> No consume en local
                                    </span>
                                  )}
                                </span>
                              </div>

                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={res.plan || 'basico'}
                                onChange={(e) => handleUpdatePlan(res.id, e.target.value)}
                                className="text-xs p-1 border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded outline-none"
                              >
                                <option value="free">🆓 Free</option>
                                <option value="basico">🥉 Básico</option>
                                <option value="profesional">🥈 Profesional</option>
                                <option value="premium">🥇 Premium</option>
                                <option value="golden_plus">👑 Golden Plus</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-xs text-[color:var(--text-secondary)]">
                              {res.fecha_vencimiento_plan
                                ? formatDate(res.fecha_vencimiento_plan)
                                : <span className="text-[color:var(--text-subtle)]">—</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setRestaurantToConfig(res);
                                    setIsTaxShippingModalOpen(true);
                                  }}
                                  className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                                  title="Configurar impuestos y envíos"
                                >
                                  <Percent size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(res.usuario_id)}
                                  className="p-2 rounded-lg"
                                  style={{ color: 'var(--danger-text)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                ><Trash2 size={18} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Gestión Global de Pedidos</h2>
                <ClipboardList className="text-primary" size={24} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-6 py-3">Pedido ID</th>
                      <th className="px-6 py-3">Cliente</th>
                      <th className="px-6 py-3">Local</th>
                      <th className="px-6 py-3">Total</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {orders.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-10 text-center text-[color:var(--text-muted)]">No hay pedidos registrados.</td></tr>
                    ) : (
                      orders.map(order => (
                        <tr key={order.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-[color:var(--text-muted)]">#{order.id}</td>
                          <td className="px-6 py-4 font-semibold text-[color:var(--text-primary)]">{order.cliente}</td>
                          <td className="px-6 py-4 text-sm text-[color:var(--text-secondary)]">{order.restaurante}</td>
                          <td className="px-6 py-4 text-sm font-bold">${Number(order.total).toLocaleString('es-CO')}</td>
                          <td className="px-6 py-4">
                            <span
                              className="text-xs font-bold px-2 py-1 rounded-full"
                              style={
                                order.estado === 'Entregado'
                                  ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }
                                  : order.estado === 'Cancelado'
                                    ? { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }
                                    : { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }
                              }
                            >
                              {order.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <select
                              value={order.estado}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className="text-xs p-1 border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded outline-none"
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Preparando">Preparando</option>
                              <option value="Listo">Listo</option>
                              <option value="Entregado">Entregado</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: CATEGORIES */}
          {activeTab === 'categories' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Gestión de Categorías</h2>
                <Tags className="text-primary" size={24} />
              </div>

              {/* Button to add new category */}
              <div className="mb-6">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Save size={16} />
                  Nueva Categoría
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                    <tr>
                      <th className="px-6 py-3">Local</th>
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Tipo</th>
                      <th className="px-6 py-3">Descripción</th>
                      <th className="px-6 py-3">Orden</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {categories.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-10 text-center text-[color:var(--text-muted)]">No hay categorías registradas.</td></tr>
                    ) : (
                      categories.map(cat => {
                        const Icon = getCategoryIcon(cat.nombre);
                        const esMercado = cat.tipo_negocio === 'mercado';
                        return (
                          <tr key={cat.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-[color:var(--text-primary)]">
                                {esMercado ? '—' : (cat.restaurante_nombre || 'Local desconocido')}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Icon size={18} className="text-primary flex-shrink-0" />
                                <p className="font-semibold text-[color:var(--text-primary)]">{cat.nombre}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                                style={
                                  esMercado
                                    ? { backgroundColor: 'var(--success-bg, #dcfce7)', color: 'var(--success-text, #15803d)' }
                                    : { backgroundColor: 'var(--bg-muted, #f1f5f9)', color: 'var(--text-secondary, #475569)' }
                                }
                              >
                                {esMercado ? 'Mercado' : 'Local'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-[color:var(--text-secondary)]">{cat.descripcion || 'Sin descripción'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-[color:var(--text-secondary)]">{cat.orden}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setCategoryToEdit(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              >
                                <Save size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('¿Estás seguro de que deseas eliminar esta categoría? Esta acción eliminará la categoría y afectará a los productos asociados.')) {
                                    handleDeleteCategory(cat.id);
                                  }
                                }}
                                className="p-2 rounded-lg"
                                style={{ color: 'var(--danger-text)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: CUPONES */}
          {activeTab === 'coupons' && (
            <div className="animate-fadeIn">
              <CouponsView mode="admin" />
            </div>
          )}

          {/* TAB: ZONAS (sectores / barrios) */}
          {activeTab === 'zonas' && (
            <div className="animate-fadeIn">
              <ZonasAdmin />
            </div>
          )}

          {/* TAB: COMPROBANTES (vista global del admin) */}
          {activeTab === 'comprobantes' && (
            <div className="animate-fadeIn">
              <AdminPaymentProofsView
                restaurants={restaurants}
                onCountChange={setPendingComprobantesCount}
              />
            </div>
          )}

          {/* TAB: AUDITORÍA */}
          {activeTab === 'auditoria' && (
            <div className="animate-fadeIn">
              <AuditLogView />
            </div>
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
              <section className="card-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Store className="text-primary" size={24} />
                  <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Top Locales</h2>
                </div>
                <div className="space-y-4">
                  {analytics.topRestaurants.map((res, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-[color:var(--border-subtle)] rounded-xl bg-[color:var(--bg-elevated)] shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-bold w-5" style={{ color: 'var(--warning-text)' }}>#{i+1}</span>
                        <span className="font-semibold text-[color:var(--text-primary)]">{res.nombre}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[color:var(--text-primary)]">${Number(res.ingresos).toLocaleString('es-CO')}</p>
                        <p className="text-[10px] text-[color:var(--text-muted)]">{res.total_pedidos} pedidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="card-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="text-primary" size={24} />
                  <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Productos Estrella</h2>
                </div>
                <div className="space-y-4">
                  {analytics.topProducts.map((prod, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-[color:var(--border-subtle)] rounded-xl bg-[color:var(--bg-elevated)] shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-bold w-5" style={{ color: 'var(--warning-text)' }}>#{i+1}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[color:var(--text-primary)]">{prod.nombre}</span>
                          <span className="text-[10px] text-[color:var(--text-muted)]">{prod.restaurante}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[color:var(--text-primary)]">{prod.cantidad_vendida} vendid.</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* GLOBAL NOTIFICATION MODAL */}
        {isNotifyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn" onClick={(e) => e.target === e.currentTarget && setIsNotifyModalOpen(false)}>
            <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn overflow-hidden">
              <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={20} />
                  <h2 className="text-xl font-bold">Notificación Global</h2>
                </div>
                <button onClick={() => setIsNotifyModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-all"><X size={20} /></button>
              </div>
              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  try {
                    await adminService.sendGlobalNotification({
                      titulo: formData.get('titulo'),
                      mensaje: formData.get('mensaje')
                    });
                    setIsNotifyModalOpen(false);
                    loadData();
                  } catch (err) { alert(err.response?.data?.error || 'Error al enviar'); }
                }}
              >
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Título del anuncio</label>
                  <input name="titulo" required className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: ¡Nueva promoción de verano!" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Mensaje</label>
                  <textarea name="mensaje" required rows="4" className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Escribe aquí el mensaje para todos los usuarios..."></textarea>
                </div>
                <button type="submit" className="btn btn-primary w-full py-3 font-bold inline-flex items-center justify-center gap-2">
                  <Bell size={18} /> Enviar a todos los usuarios
                </button>
              </form>
            </div>
          </div>
        )}

        <UserManagementModal
          isOpen={isUserModalOpen}
          onClose={() => {
            setIsUserModalOpen(false);
            setUserToEdit(null);
          }}
          onSucceeded={loadData}
          userToEdit={userToEdit}
        />

        {/* MODAL DE DETALLE DE USUARIO (4 tabs: Perfil/Pedidos/Comprobantes/Actividad) */}
        <UserDetailModal
          userId={userDetailId}
          onClose={() => setUserDetailId(null)}
        />

        {/* TAX & SHIPPING CONFIG MODAL */}
        <TaxShippingConfigModal
          isOpen={isTaxShippingModalOpen}
          onClose={() => {
            setIsTaxShippingModalOpen(false);
            setRestaurantToConfig(null);
          }}
          onSucceeded={loadData}
          restaurant={restaurantToConfig}
        />

        {/* PLAN ASSIGNMENT MODAL */}
        {planModal.isOpen && (
          <PlanAssignmentModal
            plan={planModal.plan}
            onClose={() => setPlanModal({ isOpen: false, restaurantId: null, plan: null })}
            onSubmit={submitPlanModal}
          />
        )}

        {/* CATEGORY MODAL */}
        {isCategoryModalOpen && (
          <CategoryModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            onSubmit={handleCreateCategory}
            onUpdate={handleUpdateCategory}
            categoryToEdit={categoryToEdit}
            restaurants={restaurants}
          />
        )}
      </div>
    </div>
  );
}

function PlanAssignmentModal({ plan, onClose, onSubmit }) {
  // Default: 30 días desde hoy
  const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    onSubmit({
      plan,
      fecha_vencimiento: fd.get('fecha_vencimiento') + ' 23:59:59',
      monto_pagado: fd.get('monto_pagado') ? Number(fd.get('monto_pagado')) : null,
      metodo_pago: fd.get('metodo_pago') || null,
      notas: fd.get('notas') || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <h2 className="text-xl font-bold">Asignar Plan {plan === 'golden_plus' ? '👑 Golden Plus' : plan === 'premium' ? '🥇 Premium' : plan === 'profesional' ? '🥈 Profesional' : '🥉 Básico'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Fecha de vencimiento *</label>
            <input
              type="date"
              name="fecha_vencimiento"
              defaultValue={defaultDate}
              required
              min={new Date().toISOString().slice(0, 10)}
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Monto pagado (opcional)</label>
            <input
              type="number"
              name="monto_pagado"
              step="1000"
              min="0"
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="50000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Método de pago (opcional)</label>
            <select name="metodo_pago" className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">—</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="pse">PSE</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Notas (opcional)</label>
            <textarea name="notas" rows="2" className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Pago recibido, renovación, etc." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)]">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md inline-flex items-center justify-center gap-2">
              <Save size={18} /> Asignar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({ isOpen, onClose, onSubmit, onUpdate, categoryToEdit, restaurants }) {
  const [formData, setFormData] = useState({
    restaurante_id: '',
    nombre: '',
    descripcion: '',
    orden: '0',
    tipo_negocio: 'restaurante'
  });

  useEffect(() => {
    if (categoryToEdit) {
      setFormData({
        restaurante_id: categoryToEdit.restaurante_id || '',
        nombre: categoryToEdit.nombre || '',
        descripcion: categoryToEdit.descripcion || '',
        orden: categoryToEdit.orden?.toString() || '0',
        tipo_negocio: categoryToEdit.tipo_negocio || 'restaurante'
      });
    }
  }, [categoryToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Si la categoría es de un nicho transversal (mercado o comida rápida),
    // forzamos restaurante_id a null antes de enviar. El backend también
    // lo valida, pero mandarlo limpio evita ruido en los logs.
    const payload = { ...formData };
    if (payload.tipo_negocio === 'mercado' || payload.tipo_negocio === 'comida_rapida') {
      payload.restaurante_id = null;
    }
    onSubmit(payload);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  // Preview del ícono que se asignará a esta categoría en la UI del cliente.
  // Las claves del mapa en utils/categoryIcons.js son case-sensitive y deben
  // coincidir exactamente con `formData.nombre`.
  const IconPreview = getCategoryIcon(formData.nombre);
  // Cualquier categoría de un nicho transversal (mercado / comida rápida)
  // NO se asocia a un restaurante específico — el catálogo es compartido.
  const esTransversal = formData.tipo_negocio === 'mercado' || formData.tipo_negocio === 'comida_rapida';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags size={20} />
            <h2 className="text-xl font-bold">
              {categoryToEdit ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Tipo de negocio *</label>
            <select
              name="tipo_negocio"
              value={formData.tipo_negocio}
              onChange={handleChange}
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="restaurante">Local</option>
              <option value="comida_rapida">Comida rápida</option>
              <option value="mercado">Mercado y abarrotes</option>
            </select>
            <p className="text-xs text-[color:var(--text-muted)]">
              {formData.tipo_negocio === 'mercado'
                ? 'Las categorías de mercado aplican para todos los negocios de mercado y abarrotes.'
                : formData.tipo_negocio === 'comida_rapida'
                  ? 'Las categorías de comida rápida aplican para todos los locales de comida rápida (hamburgueserías, perros, pizzas, etc.).'
                  : 'Las categorías de local quedan asociadas a un local específico.'}
            </p>
          </div>

          {!esTransversal && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Local *</label>
              <select
                name="restaurante_id"
                value={formData.restaurante_id}
                onChange={handleChange}
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleccione un local</option>
                {restaurants.map(rest => (
                  <option key={rest.id} value={rest.id}>
                    {rest.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Nombre *</label>
            <input
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Ej: Bebidas, Entrantes, Postres"
            />
            {formData.nombre && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                <IconPreview size={16} className="text-primary flex-shrink-0" />
                <span className="text-xs text-[color:var(--text-secondary)]">
                  Se mostrará con el ícono <strong className="text-[color:var(--text-primary)]">{formData.nombre}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows="3"
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Descripción opcional de la categoría"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Orden</label>
            <input
              name="orden"
              value={formData.orden}
              onChange={handleChange}
              type="number"
              min="0"
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="0"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)]">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md inline-flex items-center justify-center gap-2">
              <Save size={18} />
              {categoryToEdit ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminStatCard({ title, value, icon }) {
  return (
    <div className="card-lg bg-[color:var(--bg-elevated)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-[color:var(--text-muted)] font-medium">{title}</p>
          <h3 className="text-3xl font-heading font-bold text-[color:var(--text-primary)]">{value}</h3>
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border-subtle)] pb-3 last:border-0 last:pb-0">
      <span className="font-semibold text-[color:var(--text-muted)]">{label}</span>
      <span className="text-right text-[color:var(--text-primary)]">{value}</span>
    </div>
  );
}
