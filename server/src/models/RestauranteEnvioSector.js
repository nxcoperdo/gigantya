import { query, queryOne } from '../config/database.js';

/**
 * Devuelve los costos configurados para un restaurante como array
 * [{sector_id, costo, actualizado_por_usuario_id, actualizado_por_nombre, actualizado_en}],
 * uno por cada sector (costo 0 si no configurado).
 *
 * Si includeMissing=false, solo devuelve los sectores con costo configurado.
 * Por defecto los devuelve TODOS los sectores activos, rellenando con costo 0.
 */
export async function getByRestaurante(restaurante_id, { includeMissing = true } = {}) {
  if (includeMissing) {
    return query(`
      SELECT s.id AS sector_id, s.nombre AS sector_nombre,
             COALESCE(res.costo, 0) AS costo,
             res.actualizado_por_usuario_id,
             u.nombre AS actualizado_por_nombre,
             u.tipo_usuario AS actualizado_por_tipo,
             res.actualizado_en
      FROM sectores s
      LEFT JOIN restaurante_envios_sector res
        ON res.sector_id = s.id AND res.restaurante_id = ?
      LEFT JOIN usuarios u
        ON u.id = res.actualizado_por_usuario_id
      WHERE s.activo = 1
      ORDER BY s.orden ASC, s.nombre ASC
    `, [restaurante_id]);
  }
  return query(`
    SELECT res.sector_id, s.nombre AS sector_nombre, res.costo,
           res.actualizado_por_usuario_id,
           u.nombre AS actualizado_por_nombre,
           u.tipo_usuario AS actualizado_por_tipo,
           res.actualizado_en
    FROM restaurante_envios_sector res
    JOIN sectores s ON res.sector_id = s.id
    LEFT JOIN usuarios u ON u.id = res.actualizado_por_usuario_id
    WHERE res.restaurante_id = ?
    ORDER BY s.orden ASC, s.nombre ASC
  `, [restaurante_id]);
}

/**
 * Devuelve solo el costo de envío para (restaurante, sector).
 * Devuelve null si no está configurado (quien llama decide el fallback).
 */
export async function getCosto(restaurante_id, sector_id) {
  if (!restaurante_id || !sector_id) return null;
  const row = await queryOne(`
    SELECT costo FROM restaurante_envios_sector
    WHERE restaurante_id = ? AND sector_id = ?
  `, [restaurante_id, sector_id]);
  return row ? Number(row.costo) : null;
}

/**
 * UPSERT de un costo individual.
 */
export async function setCosto(restaurante_id, sector_id, costo, actualizadoPorUsuarioId = null) {
  const c = Number(costo);
  if (Number.isNaN(c) || c < 0) {
    throw new Error('El costo debe ser un número >= 0');
  }
  await query(`
    INSERT INTO restaurante_envios_sector
      (restaurante_id, sector_id, costo, actualizado_por_usuario_id, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      costo = VALUES(costo),
      actualizado_por_usuario_id = VALUES(actualizado_por_usuario_id),
      actualizado_en = NOW()
  `, [restaurante_id, sector_id, c, actualizadoPorUsuarioId]);
  return true;
}

/**
 * Reemplaza TODOS los costos configurados de un restaurante en una sola operación.
 * `items` = [{sector_id, costo}, ...]
 * `actualizadoPorUsuarioId` se persiste en cada fila para auditoría (admin vs dueño).
 *
 * Estrategia: dentro de una transacción, borra todos los registros del restaurante
 * y reinserta los nuevos. Más simple y rápido que diff en JS.
 */
export async function replaceAll(restaurante_id, items = [], actualizadoPorUsuarioId = null) {
  if (!Array.isArray(items)) {
    throw new Error('items debe ser un array');
  }
  // Validar cada item
  const cleaned = items
    .filter(i => i && i.sector_id !== undefined && i.sector_id !== null)
    .map(i => ({
      sector_id: Number(i.sector_id),
      costo: Number.isNaN(Number(i.costo)) ? 0 : Math.max(0, Number(i.costo)),
    }));

  const connection = await (await import('../config/database.js')).default.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM restaurante_envios_sector WHERE restaurante_id = ?', [restaurante_id]);
    for (const item of cleaned) {
      await connection.query(
        `INSERT INTO restaurante_envios_sector
           (restaurante_id, sector_id, costo, actualizado_por_usuario_id, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [restaurante_id, item.sector_id, item.costo, actualizadoPorUsuarioId]
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  return true;
}

export default { getByRestaurante, getCosto, setCosto, replaceAll };
