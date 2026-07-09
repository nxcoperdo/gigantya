/**
 * Modelo de Ingredientes-Movimientos (POS Fase 6 — kardex).
 *
 * Cada fila es un movimiento de stock. Solo se inserta desde el service
 * (posInventoryService) — el modelo no expone create directo al exterior.
 *
 * Tipos de movimiento:
 *   - consumo_pedido: descuento automático al crear un pedido POS.
 *   - compra: alta de stock por compra a proveedor. cantidad > 0.
 *   - merma: baja de stock por pérdida/desperdicio. cantidad < 0.
 *   - ajuste: corrección manual (puede ser + o -).
 *
 * El stock_anterior y stock_nuevo son SNAPSHOT del stock en el momento
 * del movimiento. No se recalculan; quedan como auditoría.
 */
import { query } from '../../config/database.js';

const VALID_TIPOS = new Set(['consumo_pedido', 'compra', 'merma', 'ajuste']);

/** Lista el kardex de un ingrediente (últimos N movimientos). */
export async function listByIngrediente(ingredienteId, restauranteId, limit = 100) {
  return query(
    `SELECT m.id, m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo,
            m.pedido_id, m.usuario_id, m.notas, m.creado_en,
            u.nombre AS usuario_nombre
       FROM ingredientes_movimientos m
       LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.ingrediente_id = ? AND m.restaurante_id = ?
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT ?`,
    [ingredienteId, restauranteId, Number(limit)]
  );
}

/** Lista el kardex del restaurante con filtros opcionales.
 *  Filtros: { ingrediente_id?, desde?, hasta?, tipo? }. */
export async function listKardex(restauranteId, filters = {}) {
  const where = ['m.restaurante_id = ?'];
  const params = [restauranteId];

  if (filters.ingrediente_id) {
    where.push('m.ingrediente_id = ?');
    params.push(Number(filters.ingrediente_id));
  }
  if (filters.tipo && VALID_TIPOS.has(filters.tipo)) {
    where.push('m.tipo = ?');
    params.push(filters.tipo);
  }
  if (filters.desde) {
    where.push('m.creado_en >= ?');
    params.push(filters.desde);
  }
  if (filters.hasta) {
    where.push('m.creado_en <= ?');
    params.push(filters.hasta);
  }

  return query(
    `SELECT m.id, m.ingrediente_id, m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo,
            m.pedido_id, m.usuario_id, m.notas, m.creado_en,
            i.nombre AS ingrediente_nombre, i.unidad AS ingrediente_unidad,
            u.nombre AS usuario_nombre
       FROM ingredientes_movimientos m
       JOIN ingredientes i ON i.id = m.ingrediente_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT 500`,
    params
  );
}

export default {
  listByIngrediente,
  listKardex,
};
