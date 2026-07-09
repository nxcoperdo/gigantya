/**
 * Modelo de Ingredientes (POS Fase 6).
 *
 * Un ingrediente es materia prima de un restaurante (carne, pan, queso...).
 * Tiene stock actual, stock mínimo (umbral de alerta) y unidad de medida.
 *
 * Decisiones:
 *   - `unidad` se valida contra un set cerrado (string corto, no ENUM,
 *     para evitar ALTER TABLE si se agrega una unidad). Coincide con las
 *     unidades que soporta el frontend.
 *   - `softDelete` usa `activo=0` en vez de borrar: preserva el FK de
 *     `producto_ingredientes` y del kardex (auditoría histórica).
 */
import { query, queryOne } from '../../config/database.js';

const VALID_UNIDADES = new Set(['kg', 'g', 'lt', 'ml', 'unidad']);

/** Lista los ingredientes activos del restaurante. */
export async function listByRestaurante(restauranteId) {
  return query(
    `SELECT id, restaurante_id, nombre, unidad, stock_actual, stock_minimo, activo,
            creado_en, actualizado_en
       FROM ingredientes
      WHERE restaurante_id = ? AND activo = 1
      ORDER BY nombre`,
    [restauranteId]
  );
}

/** Lista los ingredientes con stock por debajo del mínimo (alertas). */
export async function listAlerts(restauranteId) {
  return query(
    `SELECT id, nombre, unidad, stock_actual, stock_minimo
       FROM ingredientes
      WHERE restaurante_id = ? AND activo = 1 AND stock_actual < stock_minimo
      ORDER BY (stock_actual / NULLIF(stock_minimo, 0)) ASC`,
    [restauranteId]
  );
}

/** Busca por id validando pertenencia al restaurante. */
export async function getById(id, restauranteId) {
  return queryOne(
    `SELECT id, restaurante_id, nombre, unidad, stock_actual, stock_minimo, activo,
            creado_en, actualizado_en
       FROM ingredientes
      WHERE id = ? AND restaurante_id = ?`,
    [id, restauranteId]
  );
}

/** Crea un ingrediente nuevo. */
export async function create(restauranteId, data) {
  const { nombre, unidad = 'unidad', stock_actual = 0, stock_minimo = 0 } = data;
  if (!nombre) {
    throw Object.assign(new Error('nombre es requerido'), { statusCode: 400 });
  }
  if (!VALID_UNIDADES.has(unidad)) {
    throw Object.assign(
      new Error(`unidad inválida. Permitidas: ${[...VALID_UNIDADES].join(', ')}`),
      { statusCode: 400 }
    );
  }
  if (Number(stock_actual) < 0 || Number(stock_minimo) < 0) {
    throw Object.assign(
      new Error('stock_actual y stock_minimo no pueden ser negativos'),
      { statusCode: 400 }
    );
  }
  const result = await query(
    `INSERT INTO ingredientes
       (restaurante_id, nombre, unidad, stock_actual, stock_minimo, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [restauranteId, nombre, unidad, Number(stock_actual), Number(stock_minimo)]
  );
  return getById(result.insertId, restauranteId);
}

/** Actualiza nombre, unidad, stock_minimo. NO toca stock_actual
 *  (el stock solo cambia vía movimientos en el kardex). */
export async function update(id, restauranteId, data) {
  const allowed = ['nombre', 'unidad', 'stock_minimo'];
  const fields = Object.keys(data).filter((k) => allowed.includes(k));
  if (fields.length === 0) {
    throw Object.assign(
      new Error('No hay campos válidos para actualizar'),
      { statusCode: 400 }
    );
  }
  if (data.unidad && !VALID_UNIDADES.has(data.unidad)) {
    throw Object.assign(
      new Error(`unidad inválida. Permitidas: ${[...VALID_UNIDADES].join(', ')}`),
      { statusCode: 400 }
    );
  }
  if (data.stock_minimo !== undefined && Number(data.stock_minimo) < 0) {
    throw Object.assign(
      new Error('stock_minimo no puede ser negativo'),
      { statusCode: 400 }
    );
  }
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  await query(
    `UPDATE ingredientes SET ${setClause} WHERE id = ? AND restaurante_id = ?`,
    [...values, id, restauranteId]
  );
  return getById(id, restauranteId);
}

/** Soft-delete: marca activo=0. Preserva FKs y kardex. */
export async function softDelete(id, restauranteId) {
  const result = await query(
    `UPDATE ingredientes SET activo = 0 WHERE id = ? AND restaurante_id = ? AND activo = 1`,
    [id, restauranteId]
  );
  return result.affectedRows > 0;
}

export default {
  listByRestaurante,
  listAlerts,
  getById,
  create,
  update,
  softDelete,
};
