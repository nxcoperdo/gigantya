/**
 * Controller de Reportes POS (Fase 7).
 *
 * Endpoints:
 *   GET /api/pos/reports/top-productos?desde&hasta&limite
 *   GET /api/pos/reports/revenue?desde&hasta&agrupadoPor
 *   GET /api/pos/reports/metodos-pago?desde&hasta
 *   GET /api/pos/reports/estadisticas?desde&hasta
 *   GET /api/pos/reports/sesion/:sesionId
 *
 * Autorización: cualquier staff del restaurante puede ver los
 * reportes (el dueño necesita verlos, y un cajero también para
 * auditar sus propias sesiones). Auth con `verifyToken + requireStaff`
 * en el router.
 */
import * as posReportsService from '../services/posReportsService.js';

/** Helper: extrae restaurante_id del token o del query/body para admin. */
function resolveRestauranteId(req) {
  if (req.user.tipo_usuario === 'admin') {
    return Number(req.query.restaurante_id || req.body.restaurante_id);
  }
  return req.user.restaurante_id;
}

function requireRest(req, res) {
  const rid = resolveRestauranteId(req);
  if (!rid) {
    res.status(400).json({ error: 'No se pudo determinar el restaurante. Si eres admin, pasa ?restaurante_id=X' });
    return null;
  }
  return rid;
}

/** GET /api/pos/reports/top-productos */
export async function getTopProductos(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const items = await posReportsService.getTopProductos(rid, req.query);
    res.json({ items });
  } catch (err) {
    console.error('[posReports] getTopProductos error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando top productos' });
  }
}

/** GET /api/pos/reports/revenue */
export async function getRevenue(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const items = await posReportsService.getRevenue(rid, req.query);
    res.json({ items });
  } catch (err) {
    console.error('[posReports] getRevenue error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando revenue' });
  }
}

/** GET /api/pos/reports/metodos-pago */
export async function getMetodosPago(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const items = await posReportsService.getMetodosPago(rid, req.query);
    res.json({ items });
  } catch (err) {
    console.error('[posReports] getMetodosPago error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando métodos de pago' });
  }
}

/** GET /api/pos/reports/estadisticas */
export async function getEstadisticas(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const kpis = await posReportsService.getEstadisticas(rid, req.query);
    res.json(kpis);
  } catch (err) {
    console.error('[posReports] getEstadisticas error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando estadísticas' });
  }
}

/** GET /api/pos/reports/sesion/:sesionId */
export async function getSesionDetalle(req, res) {
  try {
    const sesionId = Number(req.params.sesionId);
    if (!Number.isInteger(sesionId) || sesionId <= 0) {
      return res.status(400).json({ error: 'sesionId inválido' });
    }
    const detalle = await posReportsService.getSesionDetalle(sesionId);
    if (!detalle) return res.status(404).json({ error: 'Sesión no encontrada' });
    // Defensa de tenant: si el staff no es admin y la sesión es de
    // OTRO restaurante, no debería verla. (El staff ya pasó
    // requireStaff, pero igual validamos.)
    if (req.user.tipo_usuario !== 'admin'
        && Number(detalle.sesion.restaurante_id) !== Number(req.user.restaurante_id)) {
      return res.status(403).json({ error: 'La sesión no pertenece a este restaurante' });
    }
    res.json(detalle);
  } catch (err) {
    console.error('[posReports] getSesionDetalle error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando detalle de sesión' });
  }
}

export default {
  getTopProductos,
  getRevenue,
  getMetodosPago,
  getEstadisticas,
  getSesionDetalle,
};
