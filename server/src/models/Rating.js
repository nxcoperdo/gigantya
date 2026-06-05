import { query, queryOne } from '../config/database.js';

// server/src/models/Rating.js

let ratingColumnCache = null;

async function getRatingColumn() {
  if (ratingColumnCache) {
    return ratingColumnCache;
  }

  const hasCalificacion = await query("SHOW COLUMNS FROM calificaciones LIKE 'calificacion'");
  if (hasCalificacion.length > 0) {
    ratingColumnCache = 'calificacion';
    return ratingColumnCache;
  }

  const hasPuntuacion = await query("SHOW COLUMNS FROM calificaciones LIKE 'puntuacion'");
  if (hasPuntuacion.length > 0) {
    ratingColumnCache = 'puntuacion';
    return ratingColumnCache;
  }

  throw new Error('No existe columna de calificacion/puntuacion en la tabla calificaciones');
}

export async function createOrUpdateRating(usuario_id, restaurante_id, pedido_id, calificacion, comentario) {
    const sql = `
    INSERT INTO calificaciones (usuario_id, restaurante_id, pedido_id, calificacion, comentario)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      calificacion = VALUES(calificacion),
      comentario = VALUES(comentario),
      actualizado_en = NOW()
  `;
    const res = await query(sql, [usuario_id, restaurante_id, pedido_id, calificacion, comentario]);
    return res.affectedRows > 0;
}

export async function getUserRatings(usuario_id) {
  const sql = `
    SELECT c.*, r.nombre as restaurante_nombre
    FROM calificaciones c
    JOIN restaurantes r ON c.restaurante_id = r.id
    WHERE c.usuario_id = ?
    ORDER BY c.creado_en DESC
  `;
  return await query(sql, [usuario_id]);
}

export async function getRestaurantRatings(restaurante_id) {
  const sql = `SELECT * FROM calificaciones WHERE restaurante_id = ? ORDER BY creado_en DESC`;
  return await query(sql, [restaurante_id]);
}

export async function getAverageRating(restaurante_id) {
  const ratingColumn = await getRatingColumn();
  const sql = `SELECT AVG(${ratingColumn}) as promedio FROM calificaciones WHERE restaurante_id = ?`;
  const res = await queryOne(sql, [restaurante_id]);
  return res ? res.promedio : 0;
}

export default {
  createOrUpdateRating,
  getUserRatings,
  getRestaurantRatings,
  getAverageRating
};
