import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Item de menú "Activar ayuda de nuevo".
 *
 * Solo se muestra si el dueño descartó el banner de ayuda
 * (`dashboard_help_banner_state === 'dismissed'`). Al click, vuelve
 * el banner a 'active' (discreto) para que el dueño pueda acceder
 * al tour y los tips de nuevo.
 *
 * UX:
 *   - El item vive en algún menú del header (lo posiciona el padre).
 *   - Es un <button> standalone — el padre lo puede envolver en un
 *     dropdown si quiere, o pasarlo como <li> directo.
 *   - Tras el click, hace refreshUser y el banner vuelve solo.
 */
export default function ReactivateHelpMenuItem({ className = '', onActivated }) {
  const { user, refreshUser } = useAuth();
  const [persisting, setPersisting] = useState(false);

  const state = user?.otros_datos?.onboarding?.dashboard_help_banner_state;
  if (state !== 'dismissed') return null;

  const handleReactivate = async () => {
    setPersisting(true);
    try {
      await userService.setOnboardingKey('onboarding.dashboard_help_banner_state', 'active');
      if (refreshUser) await refreshUser();
      if (onActivated) onActivated();
    } catch (err) {
      console.error('[ReactivateHelpMenuItem] falló:', err?.response?.data?.error || err.message);
    } finally {
      setPersisting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReactivate}
      disabled={persisting}
      className={[
        'inline-flex items-center gap-1.5 text-xs font-semibold rounded-md',
        'text-[color:var(--text-secondary)] hover:text-primary hover:bg-[color:var(--bg-muted)]',
        'active:scale-95 transition-transform disabled:opacity-50',
        'px-2.5 py-1.5 min-h-[36px]',
        className,
      ].join(' ')}
    >
      <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{persisting ? 'Activando…' : 'Activar ayuda de nuevo'}</span>
    </button>
  );
}
