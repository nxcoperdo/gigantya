/**
 * Modelo de Mesas (POS Fase 2).
 *
 * Una mesa pertenece a un restaurante y tiene coordenadas/tamaño en un
 * canvas virtual. El `estado` lo cambia el sistema al crear/cerrar
 * pedidos (Fase 3 y 5) o el dueño manualmente (mantenimiento).
 */
import { query, queryOne } from '../../config/database.js';

const VALID_ESTADOS = new Set(['libre', 'ocupada', 'reservada', 'mantenimiento']);
const VALID_FORMAS  = new Set(['rectangle', 'circle', 'round']);

/** Lista todas las mesas activas (estado != 'mantenimiento') del restaurante. */
export async function listByRestaurante(restauranteId) {
  return query(
    `SELECT id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma, estado,
            creado_en, actualizado_en
       FROM mesas
      WHERE restaurante_id = ?
        AND estado <> 'mantenimiento'
      ORDER BY nombre`,
    [restauranteId]
  );
}

/** Crea una mesa nueva en el restaurante. */
export async function create(restauranteId, data) {
  const { nombre, capacidad = 4, pos_x = 100, pos_y = 100, ancho = 120, alto = 120, forma = 'rectangle' } = data;
  if (!nombre) throw Object.assign(new Error('nombre es requerido'), { statusCode: 400 });
  if (forma && !VALID_FORMAS.has(forma)) {
    throw Object.assign(new Error(`forma inválida. Permitidas: ${[...VALID_FORMAS].join(', ')}`), { statusCode: 400 });
  }
  const result = await query(
    `INSERT INTO mesas (restaurante_id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'libre')`,
    [restauranteId, nombre, capacidad, pos_x, pos_y, ancho, alto, forma]
  );
  return getById(result.insertId, restauranteId);
}

/** Busca una mesa por id validando que pertenezca al restaurante (defensa contra bypass). */
export async function getById(id, restauranteId) {
  return queryOne(
    `SELECT id, restaurante_id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma, estado
       FROM mesas
      WHERE id = ? AND restaurante_id = ?`,
    [id, restauranteId]
  );
}

/**
 * Actualiza nombre/capacidad/posición/tamaño/forma. NO toca `estado` —
 * para eso usar `setStatus`.
 */
export async function update(id, restauranteId, data) {
  const allowed = ['nombre', 'capacidad', 'pos_x', 'pos_y', 'ancho', 'alto', 'forma'];
  const fields = Object.keys(data).filter((k) => allowed.includes(k));
  if (fields.length === 0) {
    throw Object.assign(new Error('No hay campos válidos para actualizar'), { statusCode: 400 });
  }
  if (data.forma && !VALID_FORMAS.has(data.forma)) {
    throw Object.assign(new Error(`forma inválida. Permitidas: ${[...VALID_FORMAS].join(', ')}`), { statusCode: 400 });
  }
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  await query(
    `UPDATE mesas SET ${setClause} WHERE id = ? AND restaurante_id = ?`,
    [...values, id, restauranteId]
  );
  return getById(id, restauranteId);
}

/** Cambia el estado. Usado por el dueño (libre/reservada/mantenimiento) o por el POS (ocupada/libre). */
export async function setStatus(id, restauranteId, estado) {
  if (!VALID_ESTADOS.has(estado)) {
    throw Object.assign(new Error(`estado inválido. Permitidos: ${[...VALID_ESTADOS].join(', ')}`), { statusCode: 400 });
  }
  const result = await query(
    `UPDATE mesas SET estado = ? WHERE id = ? AND restaurante_id = ?`,
    [estado, id, restauranteId]
  );
  return result.affectedRows > 0;
}

/** Soft-delete: marca la mesa como 'mantenimiento' y le cambia el nombre para que no aparezca en la grilla. */
export async function softDelete(id, restauranteId) {
  const result = await query(
    `UPDATE mesas
        SET estado = 'mantenimiento', nombre = CONCAT('(eliminada) ', nombre)
      WHERE id = ? AND restaurante_id = ?`,
    [id, restauranteId]
  );
  return result.affectedRows > 0;
}

export default {
  listByRestaurante,
  getById,
  create,
  update,
  setStatus,
  softDelete,
};
