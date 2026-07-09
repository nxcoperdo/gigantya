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
        return res.status(403).json({ error: 'Solo locales pueden usar este recurso' });
      }

      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (!restaurante) {
        return res.status(404).json({ error: 'Local no encontrado' });
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

/**
 * Variante de `requirePlanFeature` que también acepta staff del restaurante
 * (cajero, mesero, cocina) y admins.
 *
 * Por qué existe (Fase 9 — Golden Plus):
 *   El POS completo (Fases 1-8) lo usan tanto el dueño como su staff.
 *   El factory `requirePlanFeature` rechaza cualquier `tipo_usuario` que no
 *   sea 'restaurante', lo cual es correcto para features que solo gestiona
 *   el dueño (ej. cupones), pero un bug para el POS: si un cajero entra a
 *   `/api/pos/*`, el middleware lo bloquea con 403.
 *
 *   Esta variante:
 *     1. Acepta 'restaurante', 'cajero', 'mesero', 'cocina', 'admin'.
 *     2. Para 'admin' (sin restaurante asociado) deja pasar sin chequear plan.
 *     3. Para 'restaurante' + staff del local, carga el restaurante y
 *        chequea el feature como el factory original (incluyendo downgrade
 *        automático si el plan venció).
 *     4. Si el user es staff pero NO tiene restaurante (caso degenerado
 *        de un cajero sin local asignado), devuelve 404.
 *
 * Uso:
 *   const posRouter = express.Router();
 *   posRouter.use(requirePlanFeatureForStaff('pos'));   // gatea todo /api/pos/*
 */
export function requirePlanFeatureForStaff(feature) {
  return async (req, res, next) => {
    try {
      const allowedRoles = ['restaurante', 'cajero', 'mesero', 'cocina', 'admin'];
      if (!allowedRoles.includes(req.user?.tipo_usuario)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      // Admin sin restaurante asociado: bypass del chequeo de plan.
      // El POS se prueba con admin global; no se le niega el acceso.
      if (req.user.tipo_usuario === 'admin') {
        return next();
      }

      // Restaurante o staff: cargar el local asociado al user
      // (en nuestro modelo, cajero/mesero/cocina tienen restaurante_id directo
      // en `usuarios`, igual que el dueño).
      const restaurante = await RestaurantModel.getRestaurantForUser(req.user.id, req.user.tipo_usuario);
      if (!restaurante) {
        return res.status(404).json({ error: 'Local no encontrado' });
      }
      req.restaurante = restaurante;

      if (isPlanExpired(restaurante)) {
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
