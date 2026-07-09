/**
 * Modelo `Pago` (Fase 5).
 *
 * Cada fila es un cargo aplicado a un pedido. Un pedido puede tener
 * VARIAS filas (pago mixto: mitad efectivo, mitad transferencia).
 *
 * Métodos de pago aceptados (string):
 *   efectivo | transferencia | tarjeta | mixto | nequi | daviplata
 *
 * El método 'mixto' es legacy/reservado: si el cajero cobra con 2+
 * métodos, insertamos 2+ filas (cada una con su método), no una sola
 * con 'mixto'. Mantener 'mixto' en la lista por compatibilidad con
 * datos antiguos si los hay.
 *
 * Decisiones:
 *   - `items_pagados_json` se mantiene NULL en MVP. Fase 8 (split)
 *     lo va a popular.
 *   - `recibido_por` es el `usuarios.id` del cajero que cobró
 *     (auditoría). NO se borra en cascada — queda NULL si el staff
 *     se desvincula.
 */
import { query, queryOne, getConnection } from '../../config/database.js';

const VALID_METHODS = new Set(['efectivo', 'transferencia', 'tarjeta', 'mixto', 'nequi', 'daviplata']);

/** Crea un cargo. Devuelve el ID insertado. La FK al pedido y al
 *  restaurante son obligatorias. Lanza si los datos no son válidos. */
export async function createPago(data, { connection = null } = {}) {
  const {
    pedido_id, restaurante_id, metodo, monto,
    propina = 0, descuento = 0, referencia_externa = null,
    recibido_por = null, caja_sesion_id = null,
    items_pagados_json = null,
  } = data;

  if (!pedido_id) throw new Error('pedido_id es requerido');
  if (!restaurante_id) throw new Error('restaurante_id es requerido');
  if (!metodo || !VALID_METHODS.has(metodo)) {
    throw new Error(`metodo debe ser uno de: ${[...VALID_METHODS].join(', ')}`);
  }
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    throw new Error('monto debe ser un número positivo');
  }

  const exec = connection ? connection.query.bind(connection) : query;
  const [r] = await exec(
    `INSERT INTO pagos
       (pedido_id, restaurante_id, metodo, monto, propina, descuento,
        referencia_externa, recibido_por, caja_sesion_id, items_pagados_json, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      Number(pedido_id),
      Number(restaurante_id),
      metodo,
      montoNum.toFixed(2),
      Number(propina || 0).toFixed(2),
      Number(descuento || 0).toFixed(2),
      referencia_externa || null,
      recibido_por ? Number(recibido_por) : null,
      caja_sesion_id ? Number(caja_sesion_id) : null,
      items_pagados_json ? JSON.stringify(items_pagados_json) : null,
    ]
  );
  return r.insertId;
}

/** Lista los pagos de un pedido (los que cubren el total). */
export async function getPagosByPedido(pedidoId) {
  const rows = await query(
    `SELECT * FROM pagos WHERE pedido_id = ? ORDER BY creado_en ASC`,
    [Number(pedidoId)]
  );
  return rows;
}

/** Suma de pagos de un pedido (lo que se cobró hasta ahora). */
export async function getTotalPagado(pedidoId) {
  const row = await queryOne(
    `SELECT COALESCE(SUM(monto), 0) AS total
       FROM pagos WHERE pedido_id = ?`,
    [Number(pedidoId)]
  );
  return Number(row?.total || 0);
}

/** Pagos del restaurante en una ventana de tiempo (para el cierre de caja). */
export async function getPagosByRestaurante(restauranteId, { desde = null, hasta = null } = {}) {
  const filters = ['restaurante_id = ?'];
  const params = [Number(restauranteId)];
  if (desde) { filters.push('creado_en >= ?'); params.push(desde); }
  if (hasta) { filters.push('creado_en <= ?'); params.push(hasta); }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await query(
    `SELECT * FROM pagos ${where} ORDER BY creado_en ASC`,
    params
  );
  return rows;
}

export default {
  VALID_METHODS,
  createPago,
  getPagosByPedido,
  getTotalPagado,
  getPagosByRestaurante,
};
