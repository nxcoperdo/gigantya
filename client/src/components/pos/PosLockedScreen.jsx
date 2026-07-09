import { Crown } from 'lucide-react';
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
      className="card-lg border-2 border-dashed overflow-hidden"
      style={{ borderColor: '#f59e0b', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          👑
        </div>
        <div>
          <h2 className="text-2xl font-bold text-amber-900">POS no disponible en tu plan</h2>
          <p className="text-sm text-amber-800">
            Plan actual: <strong>{infoActual.emoji} {infoActual.nombre}</strong>
          </p>
        </div>
      </div>

      <p className="text-sm text-amber-800 mb-4 max-w-2xl">
        El Punto de Venta (POS) está disponible exclusivamente en el{' '}
        <strong>Plan Golden Plus</strong> ($150.000/mes). Incluye roles staff
        (cajero/mesero/cocina), plano de mesas, KDS, caja registradora con
        cierre, inventario con BOM y kardex, reportes, split bill, transfer de
        mesa y config POS.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleUpgrade}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          <Crown size={18} />
          👑 Actualizar a Golden Plus · $150.000/mes
        </button>
        <span className="text-xs text-amber-800">
          Menos de $5.000 al día · POS + todo Premium
        </span>
      </div>
    </div>
  );
}
