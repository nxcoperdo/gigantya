/**
 * Mapa de features por plan.
 *
 * Cualquier comprobación de feature en el backend debe pasar por `canAccessPlan`
 * o `getPlanLimit` — nunca hacer `plan === 'premium'` en controladores,
 * porque añade features nuevas al Profesional cambiaría múltiples archivos.
 */

export const PLANES = ['basico', 'profesional', 'premium'];

export const PLAN_FEATURES = {
  basico: {
    cupones: false,
    productos_destacados: false,
    multiples_fotos: false,
    banner_home: false,
    estadisticas: false,
    reportes: false,
    promociones: false,
    etiqueta_destacado: false,
  },
  profesional: {
    cupones: true,
    productos_destacados: true,
    multiples_fotos: true,
    banner_home: false,
    estadisticas: true,
    reportes: true,
    promociones: true,
    etiqueta_destacado: true,
  },
  premium: {
    cupones: true,
    productos_destacados: true,
    multiples_fotos: true,
    banner_home: true,
    estadisticas: true,
    reportes: true,
    promociones: true,
    etiqueta_destacado: true,
    redes_sociales: true,
  },
};

export const PLAN_LIMITS = {
  basico: { fotos_por_producto: 1 },
  profesional: { fotos_por_producto: 5 },
  premium: { fotos_por_producto: 5 },
};

export const PLAN_PRICES = {
  basico: 70000,
  profesional: 120000,
  premium: 200000,
};

export const PLAN_INFO = {
  basico: {
    nombre: 'Plan Básico',
    precio: 70000,
    color: 'amber',
    emoji: '🥉',
  },
  profesional: {
    nombre: 'Plan Profesional',
    precio: 120000,
    color: 'gray',
    emoji: '🥈',
  },
  premium: {
    nombre: 'Plan Premium',
    precio: 200000,
    color: 'yellow',
    emoji: '🥇',
  },
};

/**
 * ¿El plan `plan` puede usar la feature `feature`?
 */
export function canAccessPlan(plan, feature) {
  const features = PLAN_FEATURES[plan];
  if (!features) return false;
  return Boolean(features[feature]);
}

/**
 * Devuelve el límite numérico de un plan para una métrica concreta
 * (ej. `getPlanLimit('profesional', 'fotos_por_producto')` → 5).
 * Devuelve `null` si no hay límite definido.
 */
export function getPlanLimit(plan, limitKey) {
  const limits = PLAN_LIMITS[plan];
  if (!limits) return null;
  return limits[limitKey] ?? null;
}

/**
 * ¿La suscripción está vencida?
 * Un restaurante con `plan = basico` y sin fecha de vencimiento nunca vence.
 */
export function isPlanExpired(restaurante) {
  if (!restaurante?.fecha_vencimiento_plan) return false;
  if (restaurante.plan === 'basico') return false;
  return new Date(restaurante.fecha_vencimiento_plan) < new Date();
}
