import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Banner amarillo (Capa 1 del manual contextual).
 *
 * Aparece la primera vez que el dueño entra a una pantalla con flujo
 * crítico (crear producto, abrir caja, ver reportes, tomar pedido). Se
 * cierra con la X y queda dismissed para siempre en el backend (vía
 * `usuarios.otros_datos.onboarding.tips_dismissed.<tipKey>`).
 *
 * Props:
 *   - tipKey  string  — clave única del tip, ej. "crear_producto"
 *   - title   string  — título corto (≤ 60 chars ideal)
 *   - steps   string[] — 2-4 pasos cortos, claros, accionables
 *   - action  { label, onClick }? — botón opcional al final
 *
 * UX:
 *   - Aparece solo la primera vez (no molesta porque es único)
 *   - En mobile: ocupa el ancho del contenedor, padding cómodo
 *   - En desktop: más ancho, padding generoso
 *   - Respeta `prefers-reduced-motion` (sin animación de fade)
 *   - Si el backend no responde al dismiss, igual se oculta local
 *     (la app sigue funcionando y el próximo PUT lo sincronizará)
 */
export default function OnboardingTip({ tipKey, title, steps = [], action }) {
  const { user, refreshUser } = useAuth();

  // `visible` se evalúa 1 sola vez en el mount. Si el tip ya estaba
  // dismissed en el server, se renderiza cerrado y no se vuelve a abrir.
  // Si el user no está cargado todavía (loading inicial), asumimos que
  // se debe mostrar — cuando llegue el user y esté dismissed, un re-mount
  // del padre lo va a esconder.
  const [visible, setVisible] = useState(() => {
    if (!user) return true;
    return !user?.otros_datos?.onboarding?.tips_dismissed?.[tipKey];
  });

  if (!visible) return null;

  const dismiss = async () => {
    // Cerrar YA, sin esperar al server — si el PUT falla el usuario
    // ya vio el tip y no debería volver a aparecer. El next mount
    // lo sincroniza si hace falta (vía refreshUser en `onSuccess`
    // del PUT, ver abajo).
    setVisible(false);
    try {
      await userService.setOnboardingKey(`onboarding.tips_dismissed.${tipKey}`, true);
      // Refresca para que el state `user.otros_datos` quede alineado
      // con el server. Si falla (sin red, etc.) no es bloqueante.
      if (refreshUser) await refreshUser();
    } catch (err) {
      console.error('[OnboardingTip] no se pudo persistir dismissed:', err?.response?.data?.error || err.message);
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
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar tip"
          className="flex-shrink-0 -mr-1 -mt-1 p-2 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-800/60 active:scale-95 transition-transform min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <X className="w-4 h-4 text-amber-800 dark:text-amber-200" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
