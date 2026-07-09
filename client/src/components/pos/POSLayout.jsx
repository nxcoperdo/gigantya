import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutGrid,
  ClipboardList,
  ChefHat,
  Banknote,
  Users,
  LogOut,
  Store,
  Boxes,
  BarChart3,
  Settings,
  Lock,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Loading';
import InventoryAlertsBanner from './InventoryAlertsBanner';
import PosLockedScreen from './PosLockedScreen';

/**
 * Helper: trae el restaurante asociado al user (dueño o staff).
 * El `login` del backend solo devuelve `restaurante_id`, no el `plan`.
 * Hacemos un fetch liviano a `/api/restaurants/mine` para conocer el plan
 * y poder mostrar `<PosLockedScreen />` si el local no tiene Golden Plus.
 *
 * Por qué no metimos el `restaurante` en el payload del login: ese endpoint
 * se llama MUCHAS veces (cada vez que el user se loguea desde cualquier
 * dispositivo). Mantenerlo chico evita filtrar info innecesaria y deja
 * el endpoint rápido. Si en el futuro el POS necesita el plan en cada
 * request, lo agregamos al JWT (más prolijo que un fetch extra por mount).
 */
async function fetchMyRestaurant() {
  try {
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const r = await api.get('/restaurants/me');
    return r.data?.restaurante || r.data || null;
  } catch {
    return null;
  }
}

/**
 * Layout del POS: sidebar con items filtrados por rol + outlet para las
 * sub-rutas (/pos/mesas, /pos/pedidos, /pos/cocina, /pos/caja, /pos/personal).
 *
 * Decisión: NO usamos un `Route` con sub-routes por simplicidad (react-router
 * v6 sí lo soporta pero agrega boilerplate). En cambio, cada sub-página es
 * una página lazy aparte montada en App.jsx. POSLayout provee la chrome
 * común y un `<Outlet />` que renderiza la sub-ruta activa.
 */
const NAV_ITEMS = [
  { to: '/pos/mesas',      label: 'Mesas',         Icon: LayoutGrid,    roles: ['mesero','restaurante','admin'] },
  { to: '/pos/pedidos',    label: 'Pedidos',       Icon: ClipboardList, roles: ['mesero','cajero','restaurante','admin'] },
  { to: '/pos/cocina',     label: 'Cocina (KDS)',  Icon: ChefHat,       roles: ['cocina','restaurante','admin'] },
  { to: '/pos/caja',       label: 'Caja',          Icon: Banknote,      roles: ['cajero','restaurante','admin'] },
  { to: '/pos/reportes',   label: 'Reportes',      Icon: BarChart3,     roles: ['restaurante','admin'] },
  { to: '/pos/inventario', label: 'Inventario',    Icon: Boxes,         roles: ['restaurante','admin'] },
  { to: '/pos/personal',   label: 'Personal',      Icon: Users,         roles: ['restaurante','admin'] },
  { to: '/pos/configuracion', label: 'Configuración', Icon: Settings,   roles: ['restaurante','admin'] },
];

export default function POSLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurante, setRestaurante] = useState(null);
  const [restauranteLoading, setRestauranteLoading] = useState(true);

  // Hidratar el restaurante solo para dueños (admin/staff no necesitan
  // el plan acá: el backend ya los deja pasar). Para admin, `restaurante`
  // queda en null y la lógica de gate abajo los deja pasar.
  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;
    if (user.tipo_usuario !== 'restaurante') {
      setRestauranteLoading(false);
      return;
    }
    (async () => {
      const r = await fetchMyRestaurant();
      if (!cancelled) {
        setRestaurante(r);
        setRestauranteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || restauranteLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  // Cualquiera que NO sea cliente pasa el filtro del ProtectedRoute padre,
  // pero por seguridad validamos acá también.
  if (user.tipo_usuario === 'cliente') return <Navigate to="/" replace />;

  // Gate de plan Golden Plus (solo para dueños):
  //   - admin: pasa siempre (superusuario)
  //   - staff: pasa siempre (cajero/mesero/cocina → backend ya gatea)
  //   - dueño: requiere plan 'golden_plus'
  const isDueno = user.tipo_usuario === 'restaurante';
  const hasGoldenPlus = restaurante?.plan === 'golden_plus';
  const posHabilitado = !isDueno || hasGoldenPlus;

  const itemsVisibles = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.tipo_usuario)
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      {/* Sidebar desktop */}
      <aside
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-[color:var(--bg-elevated)] border-r border-[color:var(--border)]
          flex flex-col transition-transform duration-200
        `}
      >
        <div className="p-4 border-b border-[color:var(--border)] flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">POS</p>
            <p className="text-xs text-[color:var(--text-muted)] truncate">
              {user.nombre}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {itemsVisibles.map(({ to, label, Icon }) => {
            // Cuando el dueño está bloqueado, los items del POS se ven
            // deshabilitados (opacidad + cursor not-allowed). El click NO
            // navega: el `<main>` ya muestra PosLockedScreen igual, pero
            // bloquear la nav evita que el usuario "toque todo" esperando
            // que algo funcione.
            const bloqueado = !posHabilitado;
            return (
              <NavLink
                key={to}
                to={bloqueado ? '#' : to}
                onClick={(e) => {
                  if (bloqueado) e.preventDefault();
                  else setSidebarOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    bloqueado
                      ? 'opacity-50 cursor-not-allowed text-[color:var(--text-muted)]'
                      : isActive
                        ? 'bg-primary text-white'
                        : 'hover:bg-[color:var(--bg-hover)] text-[color:var(--text)]'
                  }`
                }
                aria-disabled={bloqueado || undefined}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{label}</span>
                {bloqueado && <Lock className="w-3 h-3 text-amber-600" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[color:var(--border)]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left hover:bg-[color:var(--bg-hover)] text-red-500"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b border-[color:var(--border)] bg-[color:var(--bg-elevated)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn btn-outline btn-small"
          >
            ☰ Menú
          </button>
          <p className="text-sm font-semibold">{user.nombre}</p>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {posHabilitado ? (
            <Outlet />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <Lock className="w-5 h-5" />
                <h1 className="text-xl font-bold">Acceso al POS bloqueado</h1>
              </div>
              <PosLockedScreen restaurant={restaurante} />
            </div>
          )}
        </main>
      </div>

      {/* Banner de alertas de inventario (toast emergente). Solo visible
          para dueño/admin; el componente filtra por rol internamente. */}
      <InventoryAlertsBanner />
    </div>
  );
}
