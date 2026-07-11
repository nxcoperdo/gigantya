/**
 * Mapa de features por plan.
 *
 * Cualquier comprobación de feature en el backend debe pasar por `canAccessPlan`
 * o `getPlanLimit` — nunca hacer `plan === 'premium'` en controladores,
 * porque añade features nuevas al Profesional cambiaría múltiples archivos.
 * Plan Golden Plus (Fase 9):
 *   Es el plan que desbloquea el POS completo (Fases 1-8). Premium sigue
 *   existiendo (locales que NO quieren POS); Golden Plus = Premium + POS.
 *   Precio $150.000/mes (por debajo de Premium — el POS es el diferenciador).
 * Plan Free:
 *   Entrada gratuita con limitaciones. No tiene cupones, banner, destacados,
 *   ni POS. Límite duro de 10 productos en el menú. fecha_vencimiento_plan
 *   queda NULL (no vence). Lo asigna el admin manualmente — no hay
 *   auto-registro en plan Free.
 */

export const PLANES = ['free', 'basico', 'profesional', 'premium', 'golden_plus'];

export const PLAN_FEATURES = {
  free: {
    cupones: false,
    productos_destacados: false,
    multiples_fotos: false,
    banner_home: false,
    estadisticas: false,
    reportes: false,
    promociones: false,
    etiqueta_destacado: false,
    redes_sociales: false,
    pos: false,
  },
  basico: {
    cupones: false,
    productos_destacados: false,
    multiples_fotos: false,
    banner_home: false,
    estadisticas: false,
    reportes: false,
    promociones: false,
    etiqueta_destacado: false,
    redes_sociales: false,
    pos: false,
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
    redes_sociales: false,
    pos: false,
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
    pos: false,
  },
  golden_plus: {
    cupones: true,
    productos_destacados: true,
    multiples_fotos: true,
    banner_home: true,
    estadisticas: true,
    reportes: true,
    promociones: true,
    etiqueta_destacado: true,
    redes_sociales: true,
    pos: true,
  },
};

export const PLAN_LIMITS = {
  free: { fotos_por_producto: 1, max_productos: 10 },
  basico: { fotos_por_producto: 1 },
  profesional: { fotos_por_producto: 5 },
  premium: { fotos_por_producto: 5 },
  golden_plus: { fotos_por_producto: 5 },
};

export const PLAN_PRICES = {
  free: 0,
  basico: 30000,
  profesional: 50000,
  premium: 80000,
  golden_plus: 150000,
};

export const PLAN_INFO = {
  free: {
    nombre: 'Plan Free',
    precio: 0,
    color: 'slate',
    emoji: '🆓',
  },
  basico: {
    nombre: 'Plan Básico',
    precio: 30000,
    color: 'amber',
    emoji: '🥉',
  },
  profesional: {
    nombre: 'Plan Profesional',
    precio: 50000,
    color: 'gray',
    emoji: '🥈',
  },
  premium: {
    nombre: 'Plan Premium',
    precio: 80000,
    color: 'yellow',
    emoji: '🥇',
  },
  golden_plus: {
    nombre: 'Plan Golden Plus',
    precio: 150000,
    color: 'amber',
    emoji: '👑',
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
 * Un restaurante con `plan = basico` o `plan = free` y sin fecha de
 * vencimiento nunca vence.
 */
export function isPlanExpired(restaurante) {
  if (!restaurante?.fecha_vencimiento_plan) return false;
  if (restaurante.plan === 'basico' || restaurante.plan === 'free') return false;
  return new Date(restaurante.fecha_vencimiento_plan) < new Date();
}
