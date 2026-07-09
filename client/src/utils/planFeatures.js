/**
 * Espejo cliente de `server/src/utils/planFeatures.js`.
 *
 * Mantener sincronizado con el backend. La fuente de verdad sigue siendo
 * el backend (lo trae `subscriptionService.getPlans()` para mostrarlos en
 * la UI de upgrade). Este archivo es solo para que el frontend pueda
 * preguntar el plan actual del user sin round-trip al backend en cada
 * render (ej: mostrar/ocultar `<PosLockedScreen />` según `user.plan`).
 *
 * Si agregás un plan nuevo al backend, agregalo también acá.
 */

export const PLANES = ['basico', 'profesional', 'premium', 'golden_plus'];

export const PLAN_FEATURES = {
  basico: {
    cupones: false,
    productos_destacados: false,
    banner_home: false,
    multiples_fotos: false,
    estadisticas: false,
    redes_sociales: false,
    pos: false,
  },
  profesional: {
    cupones: true,
    productos_destacados: true,
    banner_home: false,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: false,
    pos: false,
  },
  premium: {
    cupones: true,
    productos_destacados: true,
    banner_home: true,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: true,
    pos: false,
  },
  golden_plus: {
    cupones: true,
    productos_destacados: true,
    banner_home: true,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: true,
    pos: true,
  },
};

export const PLAN_INFO = {
  basico:      { nombre: 'Plan Básico',       precio: 70000,  color: 'amber',  emoji: '🥉' },
  profesional: { nombre: 'Plan Profesional',  precio: 120000, color: 'gray',   emoji: '🥈' },
  premium:     { nombre: 'Plan Premium',      precio: 200000, color: 'yellow', emoji: '🥇' },
  golden_plus: { nombre: 'Plan Golden Plus',  precio: 150000, color: 'amber',  emoji: '👑' },
};

/**
 * ¿El plan actual del restaurante tiene acceso a la feature?
 * Usado para gating de UI: `hasFeature(restaurant.plan, 'pos')`.
 */
export function canAccessPlan(plan, feature) {
  return Boolean(PLAN_FEATURES[plan]?.[feature]);
}
