import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';
import DashboardTour from './DashboardTour';

/**
 * Botón flotante "?" (Capa 2 del manual contextual).
 *
 * Solo aparece en /dashboard y /pos/*, y solo para usuarios staff
 * (restaurante/cajero/mesero/cocina) o admin. Es el punto de entrada
 * al tour guiado paso a paso de DashboardTour.jsx.
 *
 * Cambia su ícono según el estado:
 *   - HelpCircle  → tour no completado (default al loguearse)
 *   - RotateCcw   → tour ya completado (el "?" se convierte en un
 *                   ícono de "rehacer" para que el dueño lo note)
 *
 * El aria-label también cambia para que el screen reader anuncie el
 * estado correcto ("Ver tour de ayuda" vs "Ver tour de ayuda de nuevo").
 */
export default function HelpButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // 1) Sin user → no renderizar (el usuario está en una ruta pública
  //    o todavía está cargando la sesión).
  if (!user) return null;

  // 2) Solo en rutas privadas del local (/dashboard, /pos/*). No en
  //    home pública, ni en /admin (los admins ya saben), ni en /profile.
  const isOnboardingPath =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/pos');
  if (!isOnboardingPath) return null;

  // 3) Solo personal del local o admin. Clientes no reciben tour.
  const allowedRoles = ['restaurante', 'cajero', 'mesero', 'cocina', 'admin'];
  if (!allowedRoles.includes(user.tipo_usuario)) return null;

  const tourCompleted = !!user?.otros_datos?.onboarding?.dashboard_tour_completed;

  return (
    <>
      {/* Botón flotante. Posición: bottom-right, encima de cualquier modal
          del layout (z-40) pero por debajo del tour (z-110) para que el
          spotlight del tour lo cubra limpiamente. El `data-tour` lo
          usa el último step del DashboardTour para que el spotlight
          pueda encontrarlo vía document.querySelector. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="dashboard-fab-help"
        aria-label={tourCompleted ? 'Ver tour de ayuda de nuevo' : 'Ver tour de ayuda'}
        title={tourCompleted ? 'Ver tour de ayuda de nuevo' : 'Ver tour de ayuda'}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-primary/30"
      >
        {tourCompleted
          ? <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          : <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />}
      </button>

      {/* Tour modal (lazy: solo se monta cuando se abre) */}
      {open && <DashboardTour onClose={() => setOpen(false)} />}
    </>
  );
}
