/**
 * Espejo cliente de `server/src/utils/planFeatures.js`.
 *
 * Mantener sincronizado con el backend. La fuente de verdad sigue siendo
 * el backend (lo trae `subscriptionService.getPlans()` para mostrarlos en
 * la UI de upgrade). Este archivo es solo para que el frontend pueda
 * preguntar el plan actual del user sin round-trip al backend en cada
 * render (ej: mostrar/ocultar `<PosLockedScreen />` según `user.plan`).
 *
 * Si agregas un plan nuevo al backend, agregalo también aquí.
 */

export const PLANES = ['free', 'basico', 'profesional', 'premium', 'golden_plus'];

export const PLAN_FEATURES = {
  free: {
    cupones: false,
    productos_destacados: false,
    banner_home: false,
    multiples_fotos: false,
    estadisticas: false,
    redes_sociales: false,
    page_builder: false,
    pos: false,
  },
  basico: {
    cupones: false,
    productos_destacados: false,
    banner_home: false,
    multiples_fotos: false,
    estadisticas: false,
    redes_sociales: false,
    page_builder: false,
    pos: false,
  },
  profesional: {
    cupones: true,
    productos_destacados: true,
    banner_home: false,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: false,
    page_builder: true,
    pos: false,
  },
  premium: {
    cupones: true,
    productos_destacados: true,
    banner_home: true,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: true,
    page_builder: true,
    pos: false,
  },
  golden_plus: {
    cupones: true,
    productos_destacados: true,
    banner_home: true,
    multiples_fotos: true,
    estadisticas: true,
    redes_sociales: true,
    page_builder: true,
    pos: true,
  },
};

export const PLAN_INFO = {
  free:        { nombre: 'Plan Free',         precio: 0,       color: 'slate',  emoji: '🆓' },
  basico:      { nombre: 'Plan Básico',       precio: 30000,   color: 'amber',  emoji: '🥉' },
  profesional: { nombre: 'Plan Profesional',  precio: 50000,   color: 'gray',   emoji: '🥈' },
  premium:     { nombre: 'Plan Premium',      precio: 80000,   color: 'yellow', emoji: '🥇' },
  golden_plus: { nombre: 'Plan Golden Plus',  precio: 150000,  color: 'amber',  emoji: '👑' },
};

/**
 * ¿El plan actual del restaurante tiene acceso a la feature?
 * Usado para gating de UI: `hasFeature(restaurant.plan, 'pos')`.
 */
export function canAccessPlan(plan, feature) {
  return Boolean(PLAN_FEATURES[plan]?.[feature]);
}

/**
 * Límite numérico del plan para una métrica concreta.
 * Devuelve `null` si no hay límite definido (ej: planes pagos sin tope
 * de productos).
 */
export function getPlanLimit(plan, limitKey) {
  const limits = PLAN_LIMITS?.[plan];
  if (!limits) return null;
  return limits[limitKey] ?? null;
}

/**
 * Límites numéricos por plan. Hoy solo Free tiene `max_productos: 10`;
 * los planes pagos no tienen tope de productos y devuelven `null`.
 */
export const PLAN_LIMITS = {
  free:        { max_productos: 10, fotos_por_producto: 1 },
  basico:      { fotos_por_producto: 1 },
  profesional: { fotos_por_producto: 5 },
  premium:     { fotos_por_producto: 5 },
  golden_plus: { fotos_por_producto: 5 },
};
