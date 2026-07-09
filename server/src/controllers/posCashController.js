/**
 * Controller de caja POS (Fase 5).
 *
 * Endpoints:
 *   POST /api/pos/cash-sessions                 abre caja
 *   GET  /api/pos/cash-sessions/current         sesión abierta del cajero actual
 *   POST /api/pos/cash-sessions/:id/close       cierra con arqueo (Idempotency-Key)
 *   POST /api/pos/orders/:id/charge             cobra un pedido
 *   GET  /api/pos/cash-sessions/:id             detalle (arqueo, pagos, totales)
 *   GET  /api/pos/orders/:id/pagos              lista los pagos del pedido
 *
 * Idempotencia:
 *   - El cierre de caja ACEPTA el header `Idempotency-Key`. Si el
 *     cajero hace doble-click o la red se interrumpe, el retry con
 *     la misma key devuelve la respuesta original sin cerrar 2 veces.
 *   - El cobro de pedidos NO requiere idempotencia porque ya está
 *     protegido por `SELECT … FOR UPDATE` sobre el pedido: dos requests
 *     simultáneos detectan el cambio de estado y el segundo falla con 409.
 */
import * as cashService from '../services/cashService.js';
import * as CajaSesion from '../models/pos/CajaSesion.js';
import { getCachedResponse, setCachedResponse } from '../utils/idempotency.js';

/** Helper: extrae restaurante_id del token o de query/body para admin. */
function resolveRestauranteId(req) {
  if (req.user.tipo_usuario === 'admin') {
    return Number(req.query.restaurante_id || req.body.restaurante_id);
  }
  return req.user.restaurante_id;
}

/** POST /api/pos/cash-sessions */
export async function openCashSession(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { monto_apertura = 0 } = req.body || {};
    const sesion = await cashService.openSesion({
      restauranteId,
      usuarioId: req.user.id,
      montoApertura: monto_apertura,
    });
    res.status(201).json({ sesion });
  } catch (err) {
    console.error('[posCash] open error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error abriendo caja' });
  }
}

/** GET /api/pos/cash-sessions/current */
export async function getCurrentCashSession(req, res) {
  try {
    const sesion = await cashService.getCurrentSesion(req.user.id);
    res.json({ sesion });
  } catch (err) {
    console.error('[posCash] current error:', err);
    res.status(500).json({ error: err.message || 'Error consultando caja' });
  }
}

/** GET /api/pos/cash-sessions/:id */
export async function getCashSessionById(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    const sesion = await CajaSesion.getSesionById(Number(req.params.id));
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (Number(sesion.restaurante_id) !== Number(restauranteId)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    res.json({ sesion });
  } catch (err) {
    console.error('[posCash] get error:', err);
    res.status(500).json({ error: err.message || 'Error consultando sesión' });
  }
}

/** GET /api/pos/cash-sessions/:id/summary
 *  Devuelve la sesión + efectivo acumulado + esperado en vivo.
 *  Usado por la UI de caja para mostrar cuánto efectivo debería
 *  haber en la registradora en este momento. */
export async function getCashSessionSummary(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    const sesionId = Number(req.params.id);
    const sesion = await CajaSesion.getSesionById(sesionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (Number(sesion.restaurante_id) !== Number(restauranteId)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const summary = await cashService.getSesionLiveSummary(sesionId);
    res.json(summary);
  } catch (err) {
    console.error('[posCash] summary error:', err);
    res.status(500).json({ error: err.message || 'Error consultando resumen' });
  }
}

/** POST /api/pos/cash-sessions/:id/close
 *  Header: Idempotency-Key (recomendado) */
export async function closeCashSession(req, res) {
  const route = `/api/pos/cash-sessions/${req.params.id}/close`;
  const idempotencyKey = req.header('Idempotency-Key');

  // Si hay key y ya está cacheada, devolver sin re-procesar.
  if (idempotencyKey) {
    const cached = getCachedResponse(idempotencyKey, route);
    if (cached) {
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(cached.status).json(cached.body);
    }
  }

  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const sesionId = Number(req.params.id);
    const { monto_cierre_real, desglose_billetes, notas_cierre } = req.body || {};
    if (!(Number(monto_cierre_real) >= 0)) {
      return res.status(400).json({ error: 'monto_cierre_real (>= 0) es requerido' });
    }
    const sesion = await cashService.closeSesion({
      sesionId,
      montoCierreReal: monto_cierre_real,
      desgloseBilletes: desglose_billetes || null,
      notasCierre: notas_cierre || null,
      idempotencyKey,
    });
    const body = { sesion };
    if (idempotencyKey) {
      setCachedResponse(idempotencyKey, route, { status: 200, body });
    }
    res.status(200).json(body);
  } catch (err) {
    console.error('[posCash] close error:', err);
    const status = err.statusCode || 500;
    const body = { error: err.message || 'Error cerrando caja' };
    if (idempotencyKey && status < 500) {
      // Cachear también errores 4xx (para retries con la misma key no
      // volver a fallar diferente). NO cachear 5xx.
      setCachedResponse(idempotencyKey, route, { status, body });
    }
    res.status(status).json(body);
  }
}

/** POST /api/pos/orders/:id/charge */
export async function chargeOrder(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const pedidoId = Number(req.params.id);
    const { pagos, caja_sesion_id } = req.body || {};
    const result = await cashService.chargeOrder({
      pedidoId,
      restauranteId,
      usuarioId: req.user.id,
      pagos,
      cajaSesionId: caja_sesion_id,
    });
    res.status(201).json({
      mensaje: 'Pedido cobrado',
      ...result,
      // Devolvemos también la URL del recibo para que el frontend
      // dispare la impresión automáticamente.
      receipt_url: `/api/print/receipt/${pedidoId}`,
    });
  } catch (err) {
    console.error('[posCash] charge error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error cobrando pedido' });
  }
}

/** GET /api/pos/orders/:id/pagos */
export async function getOrderPayments(req, res) {
  try {
    const pedidoId = Number(req.params.id);
    const pagos = await cashService.getPedidoPagos(pedidoId);
    res.json({ pagos });
  } catch (err) {
    console.error('[posCash] list pagos error:', err);
    res.status(500).json({ error: err.message || 'Error listando pagos' });
  }
}

export default {
  openCashSession,
  getCurrentCashSession,
  getCashSessionById,
  getCashSessionSummary,
  closeCashSession,
  chargeOrder,
  getOrderPayments,
};
