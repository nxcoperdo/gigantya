import { query } from '../config/database.js';

export async function addSearch(usuario_id, queryText) {
  const sql = `INSERT INTO historial_busquedas (usuario_id, termino, creado_en) VALUES (?, ?, NOW())`;
  const res = await query(sql, [usuario_id, queryText]);
  return res.insertId;
}

/**
 * Inserta (o actualiza) un término en el historial del usuario, deduplicando
 * case-insensitive sobre `(usuario_id, LOWER(termino))`. Si la fila ya existe,
 * refresca `creado_en` a NOW() para que la fila "viaje al tope" del historial.
 *
 * Requiere la UNIQUE INDEX `uk_historial_busquedas_usuario_termino` creada
 * por la migración `20260915000001_add_unique_historial_busquedas`. Sin esa
 * UNIQUE KEY, el `ON DUPLICATE KEY UPDATE` no tiene target y se inserta
 * una fila duplicada en cada llamada (race condition entre dos requests
 * concurrentes con el mismo término).
 *
 * Atómico a nivel de fila en InnoDB: el segundo INSERT concurrente se
 * convierte en UPDATE del `creado_en` de la fila existente. Es la razón
 * por la que NO usamos `DELETE + INSERT` (ventana para duplicados).
 */
export async function upsertSearch(usuario_id, queryText) {
  const sql = `
    INSERT INTO historial_busquedas (usuario_id, termino, creado_en)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE creado_en = NOW()
  `;
  await query(sql, [usuario_id, queryText]);
  return true;
}

export async function getSearchHistory(usuario_id, limit = 20) {
  const sql = `SELECT termino, creado_en FROM historial_busquedas WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT ?`;
  return await query(sql, [usuario_id, parseInt(limit)]);
}

export async function clearSearchHistory(usuario_id) {
  const sql = `DELETE FROM historial_busquedas WHERE usuario_id = ?`;
  await query(sql, [usuario_id]);
  return true;
}

export default { addSearch, upsertSearch, getSearchHistory, clearSearchHistory };

