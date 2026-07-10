import { Crown, Sparkles, ChevronRight } from 'lucide-react';
import { PLAN_INFO } from '../../utils/planFeatures';

/**
 * Pantalla de bloqueo para dueños de restaurantes que NO tienen el plan
 * Golden Plus y quieren entrar al POS. Consistente con el patrón
 * `PremiumLockedFeature` del RestaurantDashboard.
 *
 * Por qué se muestra solo a usuarios `restaurante` (dueño):
 *   - El POS está bloqueado a nivel de PLAN (no de ROL): si el plan del
 *     local es basico/profesional/premium, nadie del staff debería poder
 *     usar el POS.
 *   - Pero si el dueño ve esta pantalla, el CTA de upgrade tiene sentido
 *     (es a él a quien hay que convencer).
 *   - El staff (cajero/mesero/cocina) NO ve esta pantalla; cuando el
 *     dueño hace upgrade, ya pasan el gate del backend.
 */
const FEATURES = [
  'Roles staff (cajero, mesero, cocina)',
  'Plano de mesas arrastrable',
  'Pantalla de cocina (KDS) en tiempo real',
  'Caja registradora con cierre y arqueo',
  'Inventario con BOM y kardex',
  'Reportes de ventas y operación',
  'Split bill y transfer de mesa',
];

export default function PosLockedScreen({ restaurant }) {
  const planActual = restaurant?.plan || 'basico';
  const infoActual = PLAN_INFO[planActual] || { nombre: planActual, emoji: '📦' };

  const handleUpgrade = () => {
    const msg = `Hola, soy un local con plan ${planActual.toUpperCase()} y quiero actualizar al Plan Golden Plus de GigantYA para activar el POS. ¿Me pueden dar información?`;
    window.open(
      `https://wa.me/573115320211?text=${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      className="rounded-2xl border-2 border-dashed overflow-hidden shadow-lg"
      style={{ borderColor: '#f59e0b', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}
    >
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            aria-hidden="true"
          >
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-amber-900 leading-tight">
              POS no disponible en tu plan
            </h2>
            <p className="text-sm text-amber-800 mt-1 flex items-center gap-1.5 flex-wrap">
              Plan actual:
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 font-semibold text-amber-900">
                <span aria-hidden="true">{infoActual.emoji}</span>
                {infoActual.nombre}
              </span>
            </p>
          </div>
        </div>

        <p className="text-sm md:text-base text-amber-800 mb-5 max-w-2xl">
          El Punto de Venta (POS) está disponible exclusivamente en el{' '}
          <strong className="text-amber-900">Plan Golden Plus</strong> ($150.000/mes).
          Incluímos todo lo de Premium más el sistema POS completo.
        </p>

        {/* Feature list */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900/80 mb-2.5">
            Incluye
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 max-w-2xl">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-amber-900">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleUpgrade}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white shadow-lg shadow-amber-900/20 transition-all duration-150 hover:scale-[1.02] hover:shadow-xl active:scale-100 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2 focus:ring-offset-amber-100"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            type="button"
          >
            <Crown size={18} aria-hidden="true" />
            Actualizar a Golden Plus · $150.000/mes
            <ChevronRight size={16} className="opacity-80" aria-hidden="true" />
          </button>
          <span className="text-xs text-amber-800 font-medium">
            Menos de $5.000 al día · POS + todo Premium
          </span>
        </div>
      </div>
    </div>
  );
}
