import { useState } from 'react';
import { X, Lightbulb, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Banner amarillo (Capa 1 del manual contextual).
 *
 * Comportamiento (Fase 13 rediseñada — opt-out explícito):
 *   - Aparece CADA VEZ que el dueño entra a la pantalla.
 *   - Botón "✓ Entendido" → cierra este mount (no persiste nada).
 *   - Checkbox "No volver a mostrar este tip" → si lo marca, persiste
 *     `onboarding.tips_dismissed.<tipKey> = true` y NUNCA MÁS aparece.
 *   - Sin checkbox marcado, la próxima vez que se monte el componente
 *     (próxima navegación a la pantalla) el tip vuelve a aparecer.
 *
 * El modelo "opt-out explícito con persistencia real" es lo que usan
 * los SaaS profesionales (Notion, Linear, Stripe). La idea es que el
 * dueño vea la ayuda cada vez que entra, a menos que EXPLÍCITAMENTE
 * diga "ya lo sé, no me molestes más con este tip".
 *
 * Props:
 *   - tipKey  string  — clave única del tip, ej. "crear_producto"
 *   - title   string  — título corto
 *   - steps   string[] — 2-4 pasos cortos, accionables
 *   - action  { label, onClick }? — botón opcional al final (ej. "Abrir caja ahora")
 *
 * UX:
 *   - Aparece cada mount (no molesta porque el contenido es útil)
 *   - Mobile-first, padding cómodo, touch targets ≥ 40px
 *   - Respeta `prefers-reduced-motion` (sin animación de fade)
 *   - Si el PUT al server falla, igual cerramos localmente (el tip
 *     es de baja criticidad; la próxima visita lo re-sincroniza)
 */
export default function OnboardingTip({ tipKey, title, steps = [], action }) {
  const { user, refreshUser, setUserFromResponse } = useAuth();

  // `visible` representa el estado de ESTE mount. Si el dueño ya marcó
  // "No volver a mostrar" en otra sesión, leemos `user.otros_datos`
  // para arrancar cerrado y no mostrarle el tip.
  const initiallyDismissed = !!user?.otros_datos?.onboarding?.tips_dismissed?.[tipKey];
  const [visible, setVisible] = useState(!initiallyDismissed);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [persisting, setPersisting] = useState(false);

  if (!visible) return null;

  const handleDismiss = async (persistDismiss) => {
    setVisible(false);
    if (!persistDismiss) return;

    setPersisting(true);
    try {
      // El PUT devuelve `{ mensaje, usuario }` con el `otros_datos`
      // ya actualizado. Lo usamos para sincronizar el state local en
      // el mismo tick — así si React remonta este componente (cambio
      // de tab, parent re-render), el `initiallyDismissed` del próximo
      // mount lee el flag persistido y NO vuelve a mostrar el tip.
      //
      // Si por algún motivo el server no devolviera `usuario`, caemos
      // al `refreshUser()` viejo como fallback.
      const res = await userService.setOnboardingKey(`onboarding.tips_dismissed.${tipKey}`, true);
      if (res?.usuario && setUserFromResponse) {
        setUserFromResponse(res.usuario);
      } else if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      console.error('[OnboardingTip] no se pudo persistir dismissed:', err?.response?.data?.error || err.message);
      // Si falla, igual dejamos el tip cerrado (mejor UX que dejarlo
      // abierto y forzar al user a cerrarlo de nuevo).
    } finally {
      setPersisting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={`Tip: ${title}`}
      className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 sm:p-4 mb-4 shadow-sm animate-fadeIn motion-reduce:animate-none"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800 dark:text-amber-200" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-100 mb-1">
            💡 {title}
          </h3>
          <ol className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 space-y-0.5 list-decimal list-inside">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2 hover:text-amber-700"
            >
              {action.label} →
            </button>
          )}

          {/* Fila de control: opt-out + cierre */}
          <div className="mt-3 pt-2 border-t border-amber-300/60 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-100 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                aria-label="No volver a mostrar este tip"
              />
              <span>No volver a mostrar este tip</span>
            </label>
            <button
              type="button"
              onClick={() => handleDismiss(dontShowAgain)}
              disabled={persisting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50 min-h-[32px]"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              {persisting ? 'Guardando…' : 'Entendido'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleDismiss(false)}
          aria-label="Cerrar tip (volverá a aparecer la próxima vez)"
          title="Cerrar (volverá a aparecer la próxima vez)"
          className="flex-shrink-0 -mr-1 -mt-1 p-2 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-800/60 active:scale-95 transition-transform min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <X className="w-4 h-4 text-amber-800 dark:text-amber-200" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
