import { query } from '../config/database.js';

export async function addFavorite(usuario_id, tipo, target_id) {
  // tipo: 'restaurant' | 'product'
  const sql = `INSERT INTO favoritos (usuario_id, tipo, target_id, creado_en) VALUES (?, ?, ?, NOW())`;
  const res = await query(sql, [usuario_id, tipo, target_id]);
  return res.insertId;
}

export async function removeFavorite(usuario_id, tipo, target_id) {
  const sql = `DELETE FROM favoritos WHERE usuario_id = ? AND tipo = ? AND target_id = ?`;
  await query(sql, [usuario_id, tipo, target_id]);
  return true;
}

export async function getFavorites(usuario_id, tipo) {
  const sql = `SELECT * FROM favoritos WHERE usuario_id = ? AND tipo = ? ORDER BY creado_en DESC`;
  return await query(sql, [usuario_id, tipo]);
}

export default { addFavorite, removeFavorite, getFavorites };

