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

/**
 * Marca como leídas todas las notificaciones no leídas de un usuario dentro de un rango
 * de fechas [from, to) (formato 'YYYY-MM-DD HH:mm:ss' en hora local de America/Bogota).
 *
 * Por qué recibe from/to del cliente y no los recalcula el backend:
 * - El VPS está en UTC (ver [[timezone-fix-pedidos]]). Si el backend recalcula "hoy"
 *   con `NOW()` puede caer en otro día que el cliente si hay drift.
 * - Confiar en el rango del cliente es consistente con el resto del sistema (el cliente
 *   ya genera timestamps con timeZone America/Bogota en dateHelper.js).
 * - El usuario solo puede marcar sus propias notificaciones (filtro por usuario_id del JWT).
 *
 * Solo marca no leídas (filtro `leido = 0` en WHERE) para no pisar el estado ya leído.
 */
export async function markGroupAsRead(usuario_id, from, to) {
  if (!usuario_id || !from || !to) {
    throw new Error('markGroupAsRead: usuario_id, from y to son requeridos');
  }
  const sql = `
    UPDATE notificaciones
       SET leido = 1
     WHERE usuario_id = ?
       AND leido = 0
       AND creado_en >= ?
       AND creado_en < ?
  `;
  const res = await query(sql, [usuario_id, from, to]);
  return { affectedRows: res.affectedRows ?? 0 };
}

export default {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  markGroupAsRead
};

