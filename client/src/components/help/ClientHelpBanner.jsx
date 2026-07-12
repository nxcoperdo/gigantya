import { useState } from 'react';
import { X, Sparkles, Play, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Banner persistente de ayuda para clientes en la HomePage.
 * Es el equivalente del DashboardHelpBanner del dueño, pero:
 *   - Lee/escribe el flag `onboarding.client_help_banner_state`
 *   - Tiene copy orientado a "cómo pedir" (no a "cómo gestionar")
 *
 * 3 estados (persistidos en `onboarding.client_help_banner_state`):
 *   - 'new'        → bienvenida fuerte (1ª vez)
 *   - 'active'     → recordatorio discreto
 *   - 'dismissed'  → no se muestra, pero el FAB `?` queda disponible
 *
 * Props:
 *   - onStartTour  () => void  — callback que abre el ClientTour
 */
export default function ClientHelpBanner({ onStartTour }) {
  const { user, refreshUser, setUserFromResponse } = useAuth();
  const [persisting, setPersisting] = useState(false);

  const state = user?.otros_datos?.onboarding?.client_help_banner_state || 'new';
  if (state === 'dismissed') return null;

  const setState = async (newState) => {
    setPersisting(true);
    try {
      // Sincronizamos con el `usuario` que devuelve el PUT (trae el
      // `otros_datos` actualizado), no con un round-trip a /profile.
      // Esto evita que el banner reaparezca si React remonta el
      // componente antes de que el refresh llegue.
      const res = await userService.setOnboardingKey('onboarding.client_help_banner_state', newState);
      if (res?.usuario && setUserFromResponse) {
        setUserFromResponse(res.usuario);
      } else if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      console.error('[ClientHelpBanner] no se pudo persistir estado:', err?.response?.data?.error || err.message);
    } finally {
      setPersisting(false);
    }
  };

  const handleStartTour = () => {
    setState('active');
    if (onStartTour) onStartTour();
  };
  const handleDismissNew = () => setState('active');
  const handleDismissActive = () => setState('dismissed');

  if (state === 'new') {
    return (
      <div
        role="region"
        aria-label="Bienvenida y tour guiado"
        className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 mt-4 sm:mt-6 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700 p-4 sm:p-5 shadow-sm animate-fadeIn motion-reduce:animate-none"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-amber-900 dark:text-amber-100 leading-tight">
              👋 ¡Bienvenido!
            </h2>
            <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-100/90 mt-1 leading-relaxed">
              Te mostramos en <strong>7 pasos</strong> (2 minutos) cómo buscar un local y hacer tu primer pedido. Puedes saltarte el tour cuando quieras.
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

  return (
    <div
      role="region"
      aria-label="Ayuda disponible"
      className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 mt-4 sm:mt-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3 sm:p-4 flex items-start sm:items-center gap-3 animate-fadeIn motion-reduce:animate-none"
    >
      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[color:var(--text-muted)] flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 text-xs sm:text-sm text-[color:var(--text-secondary)]">
        ¿Necesitas ayuda? Toca el botón "?" abajo a la derecha para ver el tour guiado.
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
