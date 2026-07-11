import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';
import ClientTour from './ClientTour';

/**
 * Botón flotante "?" para CLIENTES (Capa 2 del manual contextual — versión
 * cliente). Es el equivalente del HelpButton del dueño, pero:
 *   - Solo se monta para `user.tipo_usuario === 'cliente'`
 *   - Solo en rutas de cliente (/, /restaurant/*, /cart, /checkout, /orders)
 *   - Lee/escribe los flags `onboarding.client_*` (no los del dueño)
 *
 * Cambia su ícono según el estado:
 *   - HelpCircle  → tour no completado (default)
 *   - RotateCcw   → tour ya completado
 */
export default function ClientHelpButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  // Solo clientes. Los demás roles (restaurante, staff, admin) tienen
  // su propio HelpButton (DashboardTour) en /dashboard y /pos/*.
  if (user.tipo_usuario !== 'cliente') return null;

  // Rutas donde aplica la ayuda al cliente. La home es la principal
  // (donde se monta el ClientHelpBanner + el auto-tour); en el resto
  // solo aparece el FAB.
  const isClientPath =
    location.pathname === '/' ||
    location.pathname.startsWith('/restaurant') ||
    location.pathname.startsWith('/cart') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/orders');
  if (!isClientPath) return null;

  const tourCompleted = !!user?.otros_datos?.onboarding?.client_tour_completed;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="home-fab-help"
        aria-label={tourCompleted ? 'Ver tour de ayuda de nuevo' : 'Ver tour de ayuda'}
        title={tourCompleted ? 'Ver tour de ayuda de nuevo' : 'Ver tour de ayuda'}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-primary/30"
      >
        {tourCompleted
          ? <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          : <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />}
      </button>

      {open && <ClientTour onClose={() => setOpen(false)} />}
    </>
  );
}
