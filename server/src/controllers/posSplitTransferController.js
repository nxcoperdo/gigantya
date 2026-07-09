/**
 * Controller de Split / Transfer / Merge POS (Fase 8).
 *
 * Endpoints:
 *   POST /api/pos/orders/:id/charge-partial   addPaymentToOrder
 *   POST /api/pos/orders/:id/split            splitBillByItems
 *   POST /api/pos/orders/:id/transfer         transferOrder
 *   POST /api/pos/tables/merge                mergeTables
 *
 * Auth: `verifyToken + requireStaff` en el router. La validación
 * fina de tenant la hace el service (lock FOR UPDATE + chequeo de
 * restaurante_id).
 */
import * as posSplitTransferService from '../services/posSplitTransferService.js';

function resolveRestauranteId(req) {
  if (req.user.tipo_usuario === 'admin') {
    return Number(req.query.restaurante_id || req.body.restaurante_id || req.user.restaurante_id);
  }
  return req.user.restaurante_id;
}

/** POST /api/pos/orders/:id/charge-partial */
export async function chargePartial(req, res) {
  try {
    const pedidoId = Number(req.params.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ error: 'id de pedido inválido' });
    }
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { pagos, caja_sesion_id, items_pagados } = req.body || {};
    const out = await posSplitTransferService.addPaymentToOrder({
      pedidoId,
      restauranteId,
      usuarioId: req.user.id,
      pagos,
      cajaSesionId: caja_sesion_id,
      itemsPagados: items_pagados || null,
    });
    res.status(out.pedido_completado ? 201 : 200).json(out);
  } catch (e) {
    console.error('[posSplitTransfer] chargePartial error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error registrando pago parcial' });
  }
}

/** POST /api/pos/orders/:id/split */
export async function splitByItems(req, res) {
  try {
    const pedidoId = Number(req.params.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ error: 'id de pedido inválido' });
    }
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { items_por_cuenta } = req.body || {};
    const out = await posSplitTransferService.splitBillByItems({
      pedidoId,
      restauranteId,
      usuarioId: req.user.id,
      itemsPorCuenta: items_por_cuenta,
    });
    res.status(201).json(out);
  } catch (e) {
    console.error('[posSplitTransfer] splitByItems error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error dividiendo el pedido' });
  }
}

/** POST /api/pos/orders/:id/transfer */
export async function transferOrder(req, res) {
  try {
    const pedidoId = Number(req.params.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ error: 'id de pedido inválido' });
    }
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { mesa_destino_id } = req.body || {};
    if (!mesa_destino_id) {
      return res.status(400).json({ error: 'mesa_destino_id es requerido' });
    }
    const out = await posSplitTransferService.transferOrder({
      pedidoId,
      restauranteId,
      usuarioId: req.user.id,
      mesaDestinoId: mesa_destino_id,
    });
    res.json(out);
  } catch (e) {
    console.error('[posSplitTransfer] transferOrder error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error transfiriendo el pedido' });
  }
}

/** POST /api/pos/tables/merge */
export async function mergeTables(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { mesa_origen_id, mesa_destino_id } = req.body || {};
    if (!mesa_origen_id || !mesa_destino_id) {
      return res.status(400).json({ error: 'mesa_origen_id y mesa_destino_id son requeridos' });
    }
    const out = await posSplitTransferService.mergeTables({
      restauranteId,
      usuarioId: req.user.id,
      mesaOrigenId: mesa_origen_id,
      mesaDestinoId: mesa_destino_id,
    });
    res.json(out);
  } catch (e) {
    console.error('[posSplitTransfer] mergeTables error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error fusionando las mesas' });
  }
}

export default {
  chargePartial,
  splitByItems,
  transferOrder,
  mergeTables,
};
