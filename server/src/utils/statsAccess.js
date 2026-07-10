/**
 * Helpers para control de acceso a estadísticas según el plan del restaurante.
 *
 * Reglas:
 *  - plan = 'basico'                       → 403 (no tiene acceso a stats)
 *  - plan = 'profesional'                  → getBasicStats (11 métricas)
 *  - plan = 'premium'                      → getPremiumStats (22 métricas)
 *  - plan = 'golden_plus'                  → getPremiumStats (22 métricas) — mismo nivel que Premium
 *  - plan = 'premium' | 'golden_plus' VENCIDO → getBasicStats (degrada automáticamente)
 *
 * Single source of truth: cualquier endpoint que devuelva métricas
 * (REST, export PDF/Excel) DEBE usar `resolveStatsForRestaurant()`.
 *
 * NOTA: Golden Plus hereda todas las features de Premium y suma `pos: true`.
 * Ver `canAccessPlan(plan, feature)` para chequeos de features individuales.
 */

import * as StatsModel from '../models/Stats.js';
import { canAccessPlan, isPlanExpired } from './planFeatures.js';

export class StatsAccessError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Devuelve { estadisticas, plan, es_premium, plan_vigente } para un restaurante.
 * Lanza StatsAccessError si el plan no permite stats.
 *
 * @param {object} restaurante - fila cruda de la tabla `restaurantes` con al menos
 *   { id, plan, fecha_vencimiento_plan }.
 */
export async function resolveStatsForRestaurant(restaurante) {
  if (!restaurante) {
    throw new StatsAccessError('Local no encontrado', 404);
  }

  // Plan básico nunca tiene stats.
  if (!canAccessPlan(restaurante.plan, 'estadisticas')) {
    throw new StatsAccessError(
      'Esta funcionalidad solo está disponible para los planes Profesional y Premium',
      403
    );
  }

  // Premium/Golden Plus vencido se degrada a Profesional (mientras el admin no lo baje manualmente).
  const planVigente = isPlanExpired(restaurante) ? 'profesional' : restaurante.plan;
  // Golden Plus hereda las métricas de Premium (mismas 22 métricas). Usar
  // `redes_sociales` como sentinela de "plan top" — si mañana aparece un plan
  // 'diamond' con `redes_sociales: true`, este código ya lo cubre.
  const esPremium = canAccessPlan(planVigente, 'redes_sociales');

  const estadisticas = esPremium
    ? await StatsModel.getPremiumStats(restaurante.id)
    : await StatsModel.getBasicStats(restaurante.id);

  return {
    estadisticas,
    plan: planVigente,
    es_premium: esPremium,
    plan_vigente: planVigente,
  };
}
