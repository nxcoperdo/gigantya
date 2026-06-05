import { query } from '../config/database.js';

/**
 * Modelo de notificaciones
 */
export async function createNotification({ usuario_id, tipo, titulo, mensaje, data = null, leido = 0 }) {
  const sql = `
    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leido, creado_en)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  const params = [usuario_id, tipo, titulo, mensaje, leido ? 1 : 0];
  const res = await query(sql, params);
  return res.insertId;
}

export async function getUserNotifications(usuario_id, limit = 50) {
  const sql = `
    SELECT
      id,
      usuario_id,
      tipo,
      titulo,
      mensaje,
      leido,
      creado_en
    FROM notificaciones
    WHERE usuario_id = ?
    ORDER BY creado_en DESC
    LIMIT ?
  `;
  return await query(sql, [usuario_id, parseInt(limit)]);
}

export async function markAsRead(id, usuario_id) {
  const sql = `UPDATE notificaciones SET leido = 1 WHERE id = ? AND usuario_id = ?`;
  await query(sql, [id, usuario_id]);
  return true;
}

export async function markAllAsRead(usuario_id) {
  const sql = `UPDATE notificaciones SET leido = 1 WHERE usuario_id = ?`;
  await query(sql, [usuario_id]);
  return true;
}

export default {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead
};

