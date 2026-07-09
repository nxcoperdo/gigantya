/**
 * Modelo de Producto-Ingrediente (POS Fase 6 — BOM / receta).
 *
 * Una fila representa "el producto X usa N unidades del ingrediente Y".
 * Se usa para descontar stock automáticamente al crear un pedido POS.
 *
 * El service (posInventoryService) maneja la transacción del `replaceBOM`
 * (DELETE + INSERT). Este modelo solo provee lecturas y la mutación
 * atómica con un solo INSERT por fila.
 */
import { query, queryOne } from '../../config/database.js';

/** Devuelve la receta de un producto. Trae el nombre del ingrediente para
 *  mostrar en la UI sin un JOIN extra. */
export async function getBOMByProducto(productoId, restauranteId) {
  // El JOIN con ingredientes filtra por restaurante (defensa contra bypass
  // si alguien intenta leer la receta de un producto de otro local).
  return query(
    `SELECT pi.id, pi.producto_id, pi.ingrediente_id, pi.cantidad, pi.notas,
            i.nombre AS ingrediente_nombre, i.unidad AS ingrediente_unidad
       FROM producto_ingredientes pi
       JOIN ingredientes i ON i.id = pi.ingrediente_id
      WHERE pi.producto_id = ? AND i.restaurante_id = ? AND i.activo = 1
      ORDER BY i.nombre`,
    [productoId, restauranteId]
  );
}

/** Devuelve el agregado de ingredientes que se consumen por UNIDAD del
 *  producto, listo para multiplicar por la cantidad del item en el pedido.
 *  Shape: [{ ingrediente_id, cantidad }]. */
export async function getConsumoByProducto(productoId) {
  return query(
    `SELECT ingrediente_id, cantidad
       FROM producto_ingredientes
      WHERE producto_id = ?`,
    [productoId]
  );
}

/** Devuelve la receta de varios productos en una sola query (para el
 *  descuento de stock de un pedido entero, sin N+1).
 *  Shape: { [productoId]: [{ ingrediente_id, cantidad }, ...] } */
export async function getConsumoByProductos(productoIds) {
  if (!productoIds || productoIds.length === 0) return {};
  const placeholders = productoIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT producto_id, ingrediente_id, cantidad
       FROM producto_ingredientes
      WHERE producto_id IN (${placeholders})`,
    productoIds
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.producto_id]) map[r.producto_id] = [];
    map[r.producto_id].push({ ingrediente_id: Number(r.ingrediente_id), cantidad: Number(r.cantidad) });
  }
  return map;
}

/** Inserta una fila nueva. La UNIQUE KEY (producto_id, ingrediente_id)
 *  hace que un INSERT duplicado falle con ER_DUP_ENTRY — eso es la red
 *  de seguridad si el caller no chequea antes. */
export async function create(productoId, ingredienteId, cantidad, notas = null) {
  if (!(Number(cantidad) > 0)) {
    throw Object.assign(new Error('cantidad debe ser > 0'), { statusCode: 400 });
  }
  const result = await query(
    `INSERT INTO producto_ingredientes (producto_id, ingrediente_id, cantidad, notas)
     VALUES (?, ?, ?, ?)`,
    [productoId, ingredienteId, Number(cantidad), notas]
  );
  return queryOne(
    `SELECT * FROM producto_ingredientes WHERE id = ?`,
    [result.insertId]
  );
}

/** Borra una fila del BOM. Devuelve `affectedRows` para que el service
 *  sepa si la fila existía. */
export async function deleteById(id) {
  const result = await query(
    `DELETE FROM producto_ingredientes WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/** Borra todas las filas del BOM de un producto. Usado por `replaceBOM`
 *  dentro de la transacción. */
export async function deleteByProducto(productoId) {
  await query(
    `DELETE FROM producto_ingredientes WHERE producto_id = ?`,
    [productoId]
  );
}

export default {
  getBOMByProducto,
  getConsumoByProducto,
  getConsumoByProductos,
  create,
  deleteById,
  deleteByProducto,
};
