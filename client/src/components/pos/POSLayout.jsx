import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Loading';
import InventoryAlertsBanner from './InventoryAlertsBanner';

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

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  // Cualquiera que NO sea cliente pasa el filtro del ProtectedRoute padre,
  // pero por seguridad validamos acá también.
  if (user.tipo_usuario === 'cliente') return <Navigate to="/" replace />;

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
          {itemsVisibles.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'hover:bg-[color:var(--bg-hover)] text-[color:var(--text)]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
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
          <Outlet />
        </main>
      </div>

      {/* Banner de alertas de inventario (toast emergente). Solo visible
          para dueño/admin; el componente filtra por rol internamente. */}
      <InventoryAlertsBanner />
    </div>
  );
}
