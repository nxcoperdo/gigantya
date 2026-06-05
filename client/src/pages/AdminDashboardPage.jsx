import { useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/api';
import Loading from '../components/Loading';
import { ShieldCheck, Store, Users, ShoppingBag, Banknote, RefreshCcw, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [pendingRestaurants, setPendingRestaurants] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError('');
      setLoading(true);
      const [statsRes, restaurantsRes, pendingRes] = await Promise.all([
        adminService.getStats(),
        adminService.getRestaurants(),
        adminService.getPendingRestaurants(),
      ]);

      setStats(statsRes.data?.estadisticas || null);
      setRestaurants(restaurantsRes.data?.restaurantes || []);
      setPendingRestaurants(pendingRes.data?.restaurantes || []);
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
      console.error('Error aprobando restaurante:', err);
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
      console.error('Error rechazando restaurante:', err);
      setError(err.response?.data?.error || 'No se pudo rechazar el restaurante');
    } finally {
      setActionId(null);
      setActionType('');
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
        <section className="card-lg bg-gradient-to-br from-white to-amber-50/60">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm mb-4">
                <ShieldCheck size={16} />
                Panel administrativo
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-2">
                Control de restaurantes
              </h1>
              <p className="text-gray-600 max-w-3xl">
                Revisa estadísticas generales, administra restaurantes pendientes y mantén el catálogo bajo control.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              className="btn btn-primary inline-flex items-center gap-2 w-fit"
            >
              <RefreshCcw size={16} />
              {refreshing ? 'Actualizando...' : 'Refrescar panel'}
            </button>
          </div>
        </section>

        {error && (
          <div className="alert alert-error animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <AdminStatCard title="Usuarios activos" value={stats?.usuarios_totales ?? 0} icon={<Users size={20} />} />
          <AdminStatCard title="Restaurantes aprobados" value={stats?.restaurantes_aprobados ?? 0} icon={<Store size={20} />} />
          <AdminStatCard title="Pedidos totales" value={stats?.pedidos_totales ?? 0} icon={<ShoppingBag size={20} />} />
          <AdminStatCard title="Ingresos totales" value={`$${Number(stats?.ingresos_totales || 0).toLocaleString('es-CO')}`} icon={<Banknote size={20} />} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 card-lg">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-dark">Restaurantes pendientes</h2>
                <p className="text-sm text-gray-600">{pendingCount} restaurante(s) esperando aprobación.</p>
              </div>
              <AlertCircle className="text-primary" />
            </div>

            {pendingRestaurants.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                No hay restaurantes pendientes de aprobación.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRestaurants.map((restaurant) => (
                  <article key={restaurant.id} className="border border-gray-200 rounded-2xl p-4 md:p-5 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <h3 className="text-lg font-bold text-dark">{restaurant.nombre}</h3>
                        <p className="text-sm text-gray-600">{restaurant.descripcion || 'Sin descripción'}</p>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-semibold text-gray-800">Ciudad:</span> {restaurant.ciudad || 'No definida'}</p>
                          <p><span className="font-semibold text-gray-800">Dirección:</span> {restaurant.direccion || 'No definida'}</p>
                          <p><span className="font-semibold text-gray-800">Teléfono:</span> {restaurant.telefono || 'No disponible'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-start lg:items-end gap-3">
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                          Pendiente de aprobación
                        </span>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => handleApprove(restaurant.id)}
                            disabled={actionId === restaurant.id}
                            className="btn btn-primary btn-small inline-flex items-center gap-2"
                          >
                            <ThumbsUp size={16} />
                            {actionId === restaurant.id && actionType === 'approve' ? 'Aprobando...' : 'Aprobar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(restaurant.id)}
                            disabled={actionId === restaurant.id}
                            className="btn btn-outline btn-small inline-flex items-center gap-2 text-red-600 border-red-200 hover:border-red-300"
                          >
                            <ThumbsDown size={16} />
                            {actionId === restaurant.id && actionType === 'reject' ? 'Rechazando...' : 'Rechazar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <section className="card-lg">
              <h2 className="text-2xl font-bold text-dark mb-4">Resumen general</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <InfoRow label="Pendientes" value={pendingCount} />
                <InfoRow label="Restaurantes cargados" value={restaurants.length} />
                <InfoRow label="Aprobados" value={stats?.restaurantes_aprobados ?? 0} />
                <InfoRow label="Pedidos" value={stats?.pedidos_totales ?? 0} />
              </div>
            </section>

            <section className="card-lg">
              <h2 className="text-2xl font-bold text-dark mb-4">Restaurantes registrados</h2>
              {restaurants.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No hay restaurantes cargados.</div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {restaurants.slice(0, 10).map((restaurant) => (
                    <div key={restaurant.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-dark">{restaurant.nombre}</h3>
                          <p className="text-sm text-gray-500">{restaurant.ciudad || 'Sin ciudad'}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${restaurant.aprobado ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {restaurant.aprobado ? 'Aprobado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function AdminStatCard({ title, value, icon }) {
  return (
    <div className="card-lg bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-3xl font-heading font-bold text-dark mt-2">{value}</h3>
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

