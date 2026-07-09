/**
 * Service de Reportes POS (Fase 7).
 *
 * Wrapper delgado sobre el modelo `Report.js`:
 *   - Valida y normaliza parámetros (`desde`/`hasta`, `agrupadoPor`,
 *     `limite`).
 *   - Centraliza el formateo de respuestas.
 *
 * No toca conexiones, no emite sockets, no escribe audit logs — eso
 * lo hace el controller. La idea es que el controller sea un thin
 * wrapper que solo orquesta HTTP.
 */
import * as Report from '../models/pos/Report.js';

/** Normaliza `desde`/`hasta` a ISO string. Si vienen vacíos, devuelve null.
 *  Acepta Date, string ISO ('YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss') o
 *  timestamp en milisegundos. */
function parseDateInput(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return new Date(v).toISOString();
  // string — aceptar tal cual (mysql2 lo convierte).
  return String(v);
}

/** Normaliza `agrupadoPor` a uno de {dia, semana, mes}. */
function parseAgrupadoPor(v) {
  const allowed = new Set(['dia', 'semana', 'mes']);
  const s = String(v || 'dia').toLowerCase();
  return allowed.has(s) ? s : 'dia';
}

/** Normaliza `limite` a entero positivo (default 20, max 100). */
function parseLimite(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.floor(n), 100);
}

/** Top productos. */
export async function getTopProductos(restauranteId, params = {}) {
  return Report.getTopProductos(Number(restauranteId), {
    desde: parseDateInput(params.desde),
    hasta: parseDateInput(params.hasta),
    limite: parseLimite(params.limite),
  });
}

/** Revenue por período. */
export async function getRevenue(restauranteId, params = {}) {
  return Report.getRevenuePorPeriodo(Number(restauranteId), {
    desde: parseDateInput(params.desde),
    hasta: parseDateInput(params.hasta),
    agrupadoPor: parseAgrupadoPor(params.agrupadoPor),
  });
}

/** Resumen de métodos de pago. */
export async function getMetodosPago(restauranteId, params = {}) {
  return Report.getMetodosPagoSummary(Number(restauranteId), {
    desde: parseDateInput(params.desde),
    hasta: parseDateInput(params.hasta),
  });
}

/** Detalle de cierre de caja (KPIs + breakdown por método). */
export async function getSesionDetalle(sesionId) {
  return Report.getSesionDetalle(Number(sesionId));
}

/** Estadísticas generales (KPIs de pedidos + items). */
export async function getEstadisticas(restauranteId, params = {}) {
  return Report.getEstadisticasGenerales(Number(restauranteId), {
    desde: parseDateInput(params.desde),
    hasta: parseDateInput(params.hasta),
  });
}

export default {
  getTopProductos,
  getRevenue,
  getMetodosPago,
  getSesionDetalle,
  getEstadisticas,
};
