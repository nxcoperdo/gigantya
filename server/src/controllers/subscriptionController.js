import * as SubscriptionModel from '../models/Subscription.js';
import * as RestaurantModel from '../models/Restaurant.js';
import { canAccessPlan, PLAN_FEATURES, PLAN_PRICES, PLAN_INFO } from '../utils/planFeatures.js';

/**
 * GET /api/subscriptions/me
 * Devuelve la suscripción activa del restaurante autenticado + su plan.
 */
export async function getMySubscription(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const suscripcion = await SubscriptionModel.getActiveSubscription(restaurante.id);

    res.json({
      restaurante: {
        id: restaurante.id,
        nombre: restaurante.nombre,
        plan: restaurante.plan,
        fecha_vencimiento_plan: restaurante.fecha_vencimiento_plan,
      },
      suscripcion,
      features: PLAN_FEATURES[restaurante.plan] || {},
      info: PLAN_INFO[restaurante.plan] || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo suscripción', detalles: error.message });
  }
}

/**
 * GET /api/subscriptions/me/history
 * Historial de cambios de plan del restaurante autenticado.
 */
export async function getMySubscriptionHistory(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const historial = await SubscriptionModel.getSubscriptionHistory(restaurante.id);
    res.json({ total: historial.length, historial });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo historial', detalles: error.message });
  }
}

/**
 * GET /api/subscriptions/plans
 * Catálogo público de planes y precios (lo consume la landing/página de upgrade).
 */
export async function getPlans(_req, res) {
  const planes = Object.entries(PLAN_INFO).map(([key, info]) => ({
    codigo: key,
    nombre: info.nombre,
    precio: info.precio,
    emoji: info.emoji,
    color: info.color,
    features: PLAN_FEATURES[key],
  }));
  res.json({ planes });
}

export default {
  getMySubscription,
  getMySubscriptionHistory,
  getPlans,
};
