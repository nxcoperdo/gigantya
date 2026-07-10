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
  Menu as MenuIcon,
  X as CloseIcon,
  Crown,
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

const ROLE_LABELS = {
  restaurante: 'Dueño',
  mesero: 'Mesero',
  cajero: 'Cajero',
  cocina: 'Cocina',
  admin: 'Administrador',
};

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

  // Cerrar sidebar al cambiar de ruta en mobile.
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = () => setSidebarOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [sidebarOpen]);

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

  const roleLabel = ROLE_LABELS[user.tipo_usuario] || user.tipo_usuario;
  const planLabel = restaurante?.plan ? restaurante.plan.replace('_', ' ') : null;

  return (
    <div className="flex h-screen bg-[color:var(--bg)] text-[color:var(--text)] overflow-hidden">
      {/* Sidebar desktop + mobile */}
      <aside
        aria-label="Menú principal del POS"
        className={[
          'fixed md:static inset-y-0 left-0 z-40',
          'w-64 bg-[color:var(--bg-elevated)] border-r border-[color:var(--border)]',
          'flex flex-col transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b border-[color:var(--border)] flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
            aria-hidden="true"
          >
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">POS · GigantYA</p>
            <p className="text-xs text-[color:var(--text-muted)] truncate">{user.nombre}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-md hover:bg-[color:var(--bg)]"
            type="button"
            aria-label="Cerrar menú"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* User info card */}
        <div className="px-3 py-3 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[color:var(--bg)]/50">
            <span
              className={[
                'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0',
                isDueno
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-[color:var(--primary,#3b82f6)]/15 text-[color:var(--primary,#3b82f6)]',
              ].join(' ')}
              aria-hidden="true"
            >
              {isDueno ? <Crown className="w-3.5 h-3.5" /> : (user.nombre?.[0] || '?').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{roleLabel}</p>
              {planLabel && (
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)] truncate">
                  Plan {planLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="Secciones del POS">
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
                className={({ isActive }) => {
                  const base = 'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150';
                  if (bloqueado) {
                    return `${base} opacity-50 cursor-not-allowed text-[color:var(--text-muted)]`;
                  }
                  if (isActive) {
                    return [
                      base,
                      'bg-primary text-white shadow-sm',
                      // Indicador lateral de "estás acá"
                      'relative',
                    ].join(' ');
                  }
                  return `${base} text-[color:var(--text)] hover:bg-[color:var(--bg-hover)]`;
                }}
                aria-disabled={bloqueado || undefined}
              >
                {({ isActive }) => (
                  <>
                    {isActive && !bloqueado && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {bloqueado && <Lock className="w-3.5 h-3.5 text-amber-500" aria-label="Bloqueado" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[color:var(--border)]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left text-rose-500 hover:bg-rose-500/10 transition-colors"
            type="button"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b border-[color:var(--border)] bg-[color:var(--bg-elevated)] sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-[color:var(--border)] bg-[color:var(--bg)] active:scale-95 transition-transform"
            type="button"
            aria-label="Abrir menú"
          >
            <MenuIcon className="w-4 h-4" />
            Menú
          </button>
          <p className="text-sm font-semibold truncate">{user.nombre}</p>
          <div className="w-16" aria-hidden="true" />
        </header>
        <main
          id="pos-main"
          className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none"
          tabIndex={-1}
        >
          {posHabilitado ? (
            // Outlet context: pasamos el `restaurante` hidratado a las
            // páginas hijas (KDSPage, OrdersListPage, CashierPage, etc).
            // Esto resuelve el bug donde `user.restaurante_id` es null
            // para dueños (ellos están vinculados via
            // `restaurantes.usuario_id`, no `usuarios.restaurante_id`):
            // el POSLayout ya hizo el fetch via `/api/restaurants/me`,
            // y las páginas pueden leerlo de acá en vez de fallar.
            <Outlet context={{ restaurante, user }} />
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto animate-fadeIn">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[color:var(--text)]">Acceso al POS bloqueado</h1>
                  <p className="text-xs text-[color:var(--text-muted)]">Tu plan actual no incluye esta sección.</p>
                </div>
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
