import * as RestaurantModel from '../models/Restaurant.js';
import { canAccessPlan, isPlanExpired } from '../utils/planFeatures.js';

/**
 * Factory de middleware: `requirePlanFeature('cupones')`.
 *
 * Comportamiento:
 *   1. Verifica que el usuario autenticado sea un restaurante.
 *   2. Carga su restaurante (incluyendo plan y fecha_vencimiento_plan).
 *   3. Si el plan está vencido, lo degrada a `basico` en la misma request
 *      y devuelve 403 con `code: 'PLAN_EXPIRED'`.
 *   4. Si la feature no está en su plan, devuelve 403 con metadata para
 *      que el frontend pueda mostrar un CTA de upgrade.
 *
 * Uso:
 *   router.post('/cupones', verifyToken, requireRestaurant, requirePlanFeature('cupones'), controller);
 */
export function requirePlanFeature(feature) {
  return async (req, res, next) => {
    try {
      if (req.user?.tipo_usuario !== 'restaurante') {
        return res.status(403).json({ error: 'Solo restaurantes pueden usar este recurso' });
      }

      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (!restaurante) {
        return res.status(404).json({ error: 'Restaurante no encontrado' });
      }

      // Adjuntar al request para reutilizar en el controlador
      req.restaurante = restaurante;

      if (isPlanExpired(restaurante)) {
        // Degradar al toque para que no tenga que esperar al cron
        await RestaurantModel.updateRestaurant(restaurante.id, {
          plan: 'basico',
          fecha_vencimiento_plan: null,
        });
        return res.status(403).json({
          error: 'Tu plan ha vencido. Contacta al administrador para renovarlo.',
          code: 'PLAN_EXPIRED',
          currentPlan: 'basico',
        });
      }

      if (!canAccessPlan(restaurante.plan, feature)) {
        return res.status(403).json({
          error: `Tu plan actual (${restaurante.plan}) no incluye esta función`,
          code: 'FEATURE_NOT_IN_PLAN',
          currentPlan: restaurante.plan,
          requiredFeature: feature,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
