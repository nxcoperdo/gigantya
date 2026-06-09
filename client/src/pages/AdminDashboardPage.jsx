import { useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/api';
import Loading from '../components/Loading';
import { ShieldCheck, Store, Users, ShoppingBag, Banknote, RefreshCcw, AlertCircle, ThumbsUp, ThumbsDown, UserPlus, Trash2, Bell, BarChart3, Package, ClipboardList, X, Save } from 'lucide-react';
import UserManagementModal from '../components/UserManagementModal';

export default function AdminDashboardPage() {
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

  // UI States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState('');
  // Modal para asignar plan Profesional/Premium con fecha de vencimiento
  const [planModal, setPlanModal] = useState({ isOpen: false, restaurantId: null, plan: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError('');
      setLoading(true);
      const [statsRes, restaurantsRes, pendingRes, usersRes, ordersRes, analyticsRes] = await Promise.all([
        adminService.getStats(),
        adminService.getRestaurants(),
        adminService.getPendingRestaurants(),
        adminService.getUsers(),
        adminService.getOrders(),
        adminService.getAnalytics(),
      ]);

      setStats(statsRes.data?.estadisticas || null);
      setRestaurants(restaurantsRes.data?.restaurantes || []);
      setPendingRestaurants(pendingRes.data?.restaurantes || []);
      setUsers(usersRes.data?.usuarios || []);
      setOrders(ordersRes.data?.pedidos || []);
      setAnalytics(analyticsRes.data?.analytics || { topRestaurants: [], topProducts: [] });
    } catch (err) {
      console.error('Error cargando panel admin:', err);
      setError(err.response?.data?.error || 'No se pudo cargar la información del panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
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
      setError(err.response?.data?.error || 'No se pudo aprobar el restaurante');
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
      setError(err.response?.data?.error || 'No se pudo rechazar el restaurante');
    } finally {
      setActionId(null);
      setActionType('');
    }
  };

  const handleUpdatePlan = async (restaurantId, newPlan) => {
    // Si es plan profesional/premium, abrir modal con fecha de vencimiento.
    // Si es básico, enviar sin fecha.
    if (newPlan === 'basico') {
      try {
        setError('');
        await adminService.updateRestaurantPlan(restaurantId, { plan: 'basico' });
        await loadData();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al actualizar el plan');
      }
    } else {
      setPlanModal({ isOpen: true, restaurantId, plan: newPlan });
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
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">

        {/* Header Section */}
        <section className="card-lg bg-gradient-to-br from-white to-amber-50/60 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs w-fit">
                <ShieldCheck size={14} />
                Super Administrador
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark">
                Centro de Control Gigantya
              </h1>
              <p className="text-gray-600 max-w-2xl">
                Gestión total de la plataforma: usuarios, restaurantes, pedidos y analíticas globales.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
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
                <RefreshCcw size={16} />
                {refreshing ? '...' : 'Refrescar'}
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
          <AdminStatCard title="Restaurantes" value={stats?.restaurantes_aprobados ?? 0} icon={<Store size={20} />} />
          <AdminStatCard title="Pedidos" value={stats?.pedidos_totales ?? 0} icon={<ShoppingBag size={20} />} />
          <AdminStatCard title="Ingresos" value={`$${Number(stats?.ingresos_totales || 0).toLocaleString('es-CO')}`} icon={<Banknote size={20} />} />
        </section>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 p-1 bg-gray-200/50 rounded-xl w-fit">
          {[
            { id: 'overview', label: 'Vista General', icon: <BarChart3 size={16} /> },
            { id: 'users', label: 'Usuarios', icon: <Users size={16} /> },
            { id: 'restaurants', label: 'Restaurantes', icon: <Store size={16} /> },
            { id: 'orders', label: 'Pedidos', icon: <ClipboardList size={16} /> },
            { id: 'analytics', label: 'Analíticas', icon: <Package size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* CONTENT AREAS */}
        <div className="space-y-8 pb-12">

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fadeIn">
              <div className="xl:col-span-2 space-y-8">
                <section className="card-lg">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-dark">Pendientes de Aprobación</h2>
                    <AlertCircle className="text-primary" size={24} />
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingRestaurants.length === 0 ? (
                      <div className="col-span-2 py-10 text-center text-gray-500">No hay solicitudes pendientes.</div>
                    ) : (
                      pendingRestaurants.map((res) => (
                        <div key={res.id} className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-dark">{res.nombre}</h3>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">Pendiente</span>
                          </div>
                          <p className="text-xs text-gray-600">{res.descripcion || 'Sin descripción'}</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(res.id)} className="btn btn-primary btn-small flex-1 py-1 text-xs">Aprobar</button>
                            <button onClick={() => handleReject(res.id)} className="btn btn-outline btn-small flex-1 py-1 text-xs text-red-600 border-red-200">Rechazar</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
              <aside className="space-y-6">
                <section className="card-lg p-6">
                  <h3 className="text-lg font-bold text-dark mb-4">Resumen Rápido</h3>
                  <div className="space-y-3 text-sm">
                    <InfoRow label="Pendientes" value={pendingCount} />
                    <InfoRow label="Aprobados" value={stats?.restaurantes_aprobados ?? 0} />
                    <InfoRow label="Total Usuarios" value={stats?.usuarios_totales ?? 0} />
                  </div>
                </section>
              </aside>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-dark">Gestión de Usuarios</h2>
                <Users className="text-primary" size={24} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3">Rol</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-dark">{user.nombre}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            user.tipo_usuario === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-700'
                          }`}>{user.tipo_usuario}</span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.estado}
                            onChange={(e) => handleStatusChange(user.id, e.target.value)}
                            className="text-xs p-1 border rounded outline-none"
                          >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="suspendido">Suspendido</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEditUser(user)} className="p-2 text-primary hover:bg-primary/10 rounded-lg"><Save size={18} /></button>
                            <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
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
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-dark">Gestión de Restaurantes</h2>
                <Store className="text-primary" size={24} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-3">Restaurante</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Aprobación</th>
                      <th className="px-6 py-3">Plan</th>
                      <th className="px-6 py-3">Vence</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {restaurants.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No hay restaurantes registrados.</td></tr>
                    ) : (
                      restaurants.map(res => (
                        <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-dark">{res.nombre}</p>
                            <p className="text-xs text-gray-500">{res.email || 'Sin email'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              res.estado === 'activo' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {res.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              res.aprobado === 1 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {res.aprobado === 1 ? 'Aprobado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={res.plan || 'basico'}
                              onChange={(e) => handleUpdatePlan(res.id, e.target.value)}
                              className="text-xs p-1 border rounded outline-none bg-white"
                            >
                              <option value="basico">🥉 Básico</option>
                              <option value="profesional">🥈 Profesional</option>
                              <option value="premium">🥇 Premium</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {res.fecha_vencimiento_plan
                              ? new Date(res.fecha_vencimiento_plan).toLocaleDateString('es-CO')
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteUser(res.usuario_id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <section className="card-lg overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-dark">Gestión Global de Pedidos</h2>
                <ClipboardList className="text-primary" size={24} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-3">Pedido ID</th>
                      <th className="px-6 py-3">Cliente</th>
                      <th className="px-6 py-3">Restaurante</th>
                      <th className="px-6 py-3">Total</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No hay pedidos registrados.</td></tr>
                    ) : (
                      orders.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-gray-500">#{order.id}</td>
                          <td className="px-6 py-4 font-semibold text-dark">{order.cliente}</td>
                          <td className="px-6 py-4 text-sm">{order.restaurante}</td>
                          <td className="px-6 py-4 text-sm font-bold">${Number(order.total).toLocaleString('es-CO')}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              order.estado === 'Entregado' ? 'bg-green-50 text-green-700' :
                              order.estado === 'Cancelado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {order.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <select
                              value={order.estado}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className="text-xs p-1 border rounded outline-none"
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

          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
              <section className="card-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Store className="text-primary" size={24} />
                  <h2 className="text-2xl font-bold text-dark">Top Restaurantes</h2>
                </div>
                <div className="space-y-4">
                  {analytics.topRestaurants.map((res, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-amber-600 w-5">#{i+1}</span>
                        <span className="font-semibold text-dark">{res.nombre}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-dark">${Number(res.ingresos).toLocaleString('es-CO')}</p>
                        <p className="text-[10px] text-gray-500">{res.total_pedidos} pedidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="card-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="text-primary" size={24} />
                  <h2 className="text-2xl font-bold text-dark">Productos Estrella</h2>
                </div>
                <div className="space-y-4">
                  {analytics.topProducts.map((prod, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-amber-600 w-5">#{i+1}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-dark">{prod.nombre}</span>
                          <span className="text-[10px] text-gray-500">{prod.restaurante}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-dark">{prod.cantidad_vendida} vendid.</span>
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
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn overflow-hidden">
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
                  <label className="text-xs font-semibold text-gray-500 uppercase">Título del anuncio</label>
                  <input name="titulo" required className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: ¡Nueva promoción de verano!" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Mensaje</label>
                  <textarea name="mensaje" required rows="4" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Escribe aquí el mensaje para todos los usuarios..."></textarea>
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

        {/* PLAN ASSIGNMENT MODAL */}
        {planModal.isOpen && (
          <PlanAssignmentModal
            plan={planModal.plan}
            onClose={() => setPlanModal({ isOpen: false, restaurantId: null, plan: null })}
            onSubmit={submitPlanModal}
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <h2 className="text-xl font-bold">Asignar Plan {plan === 'premium' ? '🥇 Premium' : '🥈 Profesional'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Fecha de vencimiento *</label>
            <input
              type="date"
              name="fecha_vencimiento"
              defaultValue={defaultDate}
              required
              min={new Date().toISOString().slice(0, 10)}
              className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Monto pagado (opcional)</label>
            <input
              type="number"
              name="monto_pagado"
              step="1000"
              min="0"
              className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="120000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Método de pago (opcional)</label>
            <select name="metodo_pago" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">—</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="pse">PSE</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Notas (opcional)</label>
            <textarea name="notas" rows="2" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Pago recibido, renovación, etc." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200">
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

function AdminStatCard({ title, value, icon }) {
  return (
    <div className="card-lg bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-3xl font-heading font-bold text-dark">{value}</h3>
        </div>
        <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
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
