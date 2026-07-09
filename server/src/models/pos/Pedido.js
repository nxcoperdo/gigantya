/**
 * Modelo `Pedido` (Fase 8).
 *
 * Wrapper de queries a `pedidos` para las operaciones de split bill,
 * transfer y merge. NO toca la creación del pedido (eso vive en
 * `orderService.createOrderCore`) ni el cobro total (eso vive en
 * `cashService.chargeOrder`). Esta capa solo agrega las primitivas
 * que esas features necesitan:
 *
 *   - `getById(pedidoId, restauranteId)` — fetch con defensa de
 *     tenant. Devuelve null si no existe o si pertenece a otro rest.
 *   - `getItemsByPedido(pedidoId)` — JOIN a `items_pedido` para
 *     presentar la cuenta (usado en el modal de split).
 *   - `updateMesa(pedidoId, mesaId, restauranteId)` — UPDATE simple
 *     de `pedidos.mesa_id`. Usado en transfer y merge.
 *   - `markTransferido(pedidoId, mesaOrigenId, mesaDestinoId, ...)` —
 *     graba la huella del transfer en `transferido_de_mesa_id`.
 *   - `getResumenCobro(pedidoId)` — devuelve { total, pagado,
 *     pendiente, estado_pago } en un solo roundtrip.
 *   - `setEstadoPago(pedidoId, estado)` — UPDATE directo.
 *   - `marcarComoCancelado(pedidoId, motivo)` — para el split por
 *     ítems (decisión: original se cancela con nota explicativa).
 */
import { query, queryOne } from '../../config/database.js';

/** Fetch del pedido con defensa de tenant. Null si no existe o es de
 *  otro restaurante. */
export async function getById(pedidoId, restauranteId) {
  const row = await queryOne(
    `SELECT * FROM pedidos
      WHERE id = ? AND restaurante_id = ?
      LIMIT 1`,
    [Number(pedidoId), Number(restauranteId)]
  );
  return row || null;
}

/** Items del pedido (sin adiciones — para splits simples alcanza). */
export async function getItemsByPedido(pedidoId) {
  const rows = await query(
    `SELECT id, pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas
       FROM items_pedido
      WHERE pedido_id = ?
      ORDER BY id ASC`,
    [Number(pedidoId)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    pedido_id: Number(r.pedido_id),
    producto_id: Number(r.producto_id),
    cantidad: Number(r.cantidad),
    precio_unitario: Number(r.precio_unitario),
    subtotal: Number(r.subtotal),
    notas: r.notas || null,
  }));
}

/** UPDATE simple de `pedidos.mesa_id`. Devuelve affectedRows (0/1). */
export async function updateMesa(pedidoId, mesaId, restauranteId) {
  const [r] = await query(
    `UPDATE pedidos
        SET mesa_id = ?
      WHERE id = ? AND restaurante_id = ?`,
    [mesaId ? Number(mesaId) : null, Number(pedidoId), Number(restauranteId)]
  );
  return r.affectedRows;
}

/** Marca el pedido como transferido (graba la mesa de origen). */
export async function markTransferido(pedidoId, mesaOrigenId, mesaDestinoId, restauranteId) {
  const [r] = await query(
    `UPDATE pedidos
        SET mesa_id = ?,
            transferido_de_mesa_id = ?
      WHERE id = ? AND restaurante_id = ?`,
    [Number(mesaDestinoId), Number(mesaOrigenId), Number(pedidoId), Number(restauranteId)]
  );
  return r.affectedRows;
}

/** Resumen de cobro del pedido: total facturado, total pagado,
 *  pendiente y estado de pago. Un solo roundtrip. */
export async function getResumenCobro(pedidoId) {
  const row = await queryOne(
    `SELECT p.id          AS pedido_id,
            p.total       AS total,
            p.estado      AS estado,
            p.estado_pago AS estado_pago,
            COALESCE((
              SELECT SUM(pg.monto)
                FROM pagos pg
               WHERE pg.pedido_id = p.id
            ), 0)          AS pagado
       FROM pedidos p
      WHERE p.id = ?
      LIMIT 1`,
    [Number(pedidoId)]
  );
  if (!row) return null;
  const total = Number(row.total || 0);
  const pagado = Number(row.pagado || 0);
  return {
    pedido_id: Number(row.pedido_id),
    estado: row.estado,
    estado_pago: row.estado_pago,
    total,
    pagado,
    pendiente: Math.max(0, total - pagado),
  };
}

/** UPDATE de `pedidos.estado_pago` ∈ {impago, parcial, pagado}. */
export async function setEstadoPago(pedidoId, estado, restauranteId) {
  const allowed = ['impago', 'parcial', 'pagado'];
  if (!allowed.includes(estado)) {
    throw new Error(`estado_pago inválido: ${estado}`);
  }
  const [r] = await query(
    `UPDATE pedidos SET estado_pago = ? WHERE id = ? AND restaurante_id = ?`,
    [estado, Number(pedidoId), Number(restauranteId)]
  );
  return r.affectedRows;
}

/** Marca el pedido como Cancelado con nota (usado en split por ítems
 *  para "cerrar" el pedido original después de crear N cuentas hijas).
 *  Devuelve affectedRows (0/1). */
export async function marcarComoCancelado(pedidoId, motivo, restauranteId) {
  const [r] = await query(
    `UPDATE pedidos
        SET estado = 'Cancelado',
            motivo_cancelacion = ?
      WHERE id = ? AND restaurante_id = ?`,
    [motivo, Number(pedidoId), Number(restauranteId)]
  );
  return r.affectedRows;
}

/** Devuelve la lista de pedidos activos (no cancelados, no entregados)
 *  de una mesa específica. Útil para el merge: si la mesa origen tiene
 *  un solo pedido, equivale a transfer; si tiene varios, los movemos. */
export async function getPedidosActivosByMesa(mesaId, restauranteId) {
  const rows = await query(
    `SELECT id, mesa_id, estado, estado_pago, total
       FROM pedidos
      WHERE mesa_id = ?
        AND restaurante_id = ?
        AND estado NOT IN ('Cancelado','Entregado')
      ORDER BY creado_en ASC`,
    [Number(mesaId), Number(restauranteId)]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    mesa_id: r.mesa_id !== null ? Number(r.mesa_id) : null,
    estado: r.estado,
    estado_pago: r.estado_pago,
    total: Number(r.total || 0),
  }));
}

export default {
  getById,
  getItemsByPedido,
  updateMesa,
  markTransferido,
  getResumenCobro,
  setEstadoPago,
  marcarComoCancelado,
  getPedidosActivosByMesa,
};
