import { useState } from 'react';
import { X, Sparkles, Play, EyeOff, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Banner persistente de ayuda en el dashboard del local (Fase 13).
 *
 * 3 estados visuales (persistidos en `onboarding.dashboard_help_banner_state`):
 *
 *   - 'new'        → primera vez, gradiente amarillo/naranja, CTAs fuertes
 *                     "Iniciar tour" + "No, gracias" (pasa a 'active')
 *   - 'active'     → el dueño ya conoce, banner discreto gris con
 *                     "Ver tour" + "Ocultar" (pasa a 'dismissed')
 *   - 'dismissed'  → el dueño optó por ocultar, NO se muestra el banner
 *                     (el FAB `?` sigue disponible para reabrir el tour)
 *
 * La transición es REVERSIBLE: el dueño puede reactivar la ayuda desde
 * el menú de usuario del header (`userService.setOnboardingKey(
 * 'onboarding.dashboard_help_banner_state', 'active')`).
 *
 * Props:
 *   - onStartTour  () => void  — callback que abre el tour (lo monta
 *                                  el padre; este componente solo lo dispara)
 */
export default function DashboardHelpBanner({ onStartTour }) {
  const { user, refreshUser } = useAuth();
  const [persisting, setPersisting] = useState(false);

  // Estado leído de otros_datos. Si no existe, default 'new' (primera vez).
  const state = user?.otros_datos?.onboarding?.dashboard_help_banner_state || 'new';

  // Si el dueño descartó, no se muestra NADA.
  if (state === 'dismissed') return null;

  const setState = async (newState) => {
    setPersisting(true);
    try {
      await userService.setOnboardingKey('onboarding.dashboard_help_banner_state', newState);
      if (refreshUser) await refreshUser();
    } catch (err) {
      console.error('[DashboardHelpBanner] no se pudo persistir estado:', err?.response?.data?.error || err.message);
    } finally {
      setPersisting(false);
    }
  };

  const handleStartTour = () => {
    // Marcamos como 'active' para que la próxima vez se vea el banner
    // discreto, no el de bienvenida. (El flag 'completed' del tour es
    // independiente y se setea en DashboardTour.jsx al finalizar.)
    setState('active');
    if (onStartTour) onStartTour();
  };

  const handleDismissNew = () => setState('active');
  const handleDismissActive = () => setState('dismissed');

  // ----- Variante "new": bienvenida fuerte -----
  if (state === 'new') {
    return (
      <div
        role="region"
        aria-label="Bienvenida y tour guiado"
        className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700 p-4 sm:p-5 mb-4 shadow-sm animate-fadeIn motion-reduce:animate-none"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-amber-900 dark:text-amber-100 leading-tight">
              👋 ¡Bienvenido a tu dashboard!
            </h2>
            <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-100/90 mt-1 leading-relaxed">
              Te mostramos en <strong>6 pasos</strong> (2 minutos) dónde está cada cosa. Te podés saltar el tour cuando quieras.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartTour}
                disabled={persisting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold active:scale-95 transition-transform shadow-sm disabled:opacity-50 min-h-[40px]"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                Iniciar tour
              </button>
              <button
                type="button"
                onClick={handleDismissNew}
                disabled={persisting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-amber-900 dark:text-amber-100 text-xs sm:text-sm font-semibold hover:bg-amber-200/60 dark:hover:bg-amber-800/40 active:scale-95 transition-transform disabled:opacity-50 min-h-[40px]"
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                No, gracias
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----- Variante "active": recordatorio discreto -----
  return (
    <div
      role="region"
      aria-label="Ayuda disponible"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3 sm:p-4 mb-4 flex items-start sm:items-center gap-3 animate-fadeIn motion-reduce:animate-none"
    >
      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[color:var(--text-muted)] flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 text-xs sm:text-sm text-[color:var(--text-secondary)]">
        ¿Necesitás ayuda? Hacé el tour guiado o mirá los tips en cada pantalla.
      </p>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onStartTour}
          disabled={persisting}
          className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-transform disabled:opacity-50 min-h-[36px]"
        >
          <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Ver tour</span>
          <span className="sm:hidden">Tour</span>
        </button>
        <button
          type="button"
          onClick={handleDismissActive}
          disabled={persisting}
          aria-label="Ocultar este mensaje"
          title="Ocultar este mensaje"
          className="p-1.5 sm:p-2 rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)] active:scale-95 transition-transform disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
