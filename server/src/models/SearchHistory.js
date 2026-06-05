import { query } from '../config/database.js';

export async function addSearch(usuario_id, queryText) {
  const sql = `INSERT INTO historial_busquedas (usuario_id, termino, creado_en) VALUES (?, ?, NOW())`;
  const res = await query(sql, [usuario_id, queryText]);
  return res.insertId;
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

export default { addSearch, getSearchHistory, clearSearchHistory };

