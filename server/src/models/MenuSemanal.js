import { query, queryOne } from '../config/database.js';

// Días de la semana en formato ISO: 1=Lunes … 7=Domingo.
// Calculamos el día ACTUAL en America/Bogota (no en la TZ del server, que en
// el VPS es UTC) para que el "menú de hoy" cambie a la medianoche local.
const DIA_MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export function getDiaSemanaBogota(date = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).format(date);
  return DIA_MAP[wd] || 1;
}

/**
 * Plantilla semanal completa de un restaurante (todas las celdas), con los
 * datos del producto-combo asignado a cada una. Para el panel del dueño.
 */
export async function getWeeklyByRestaurant(restaurante_id) {
  const sql = `
    SELECT
      ms.id, ms.tipo_comida, ms.dia_semana, ms.producto_id, ms.activo,
      p.nombre, p.descripcion, p.precio, p.imagen_url, p.disponible
    FROM menu_semanal ms
    JOIN productos p ON p.id = ms.producto_id AND p.estado = 'activo'
    WHERE ms.restaurante_id = ?
    ORDER BY ms.dia_semana ASC, ms.tipo_comida ASC
  `;
  return query(sql, [restaurante_id]);
}

/**
 * Combos del día de hoy (desayuno + almuerzo) de un restaurante. Solo celdas
 * activas cuyo producto esté disponible. Para la vista del cliente.
 */
export async function getTodayByRestaurant(restaurante_id, diaSemana = getDiaSemanaBogota()) {
  const sql = `
    SELECT
      ms.tipo_comida, ms.dia_semana,
      p.id AS producto_id, p.nombre, p.descripcion, p.precio, p.imagen_url,
      (
        EXISTS(SELECT 1 FROM producto_adiciones WHERE producto_id = p.id AND activo = 1)
        OR EXISTS(SELECT 1 FROM producto_ingredientes_removibles WHERE producto_id = p.id AND activo = 1)
      ) AS tiene_modificadores
    FROM menu_semanal ms
    JOIN productos p ON p.id = ms.producto_id AND p.estado = 'activo' AND p.disponible = 1
    WHERE ms.restaurante_id = ? AND ms.dia_semana = ? AND ms.activo = 1
    ORDER BY ms.tipo_comida ASC
  `;
  return query(sql, [restaurante_id, diaSemana]);
}

/**
 * Crea o actualiza la celda (restaurante, tipo_comida, día) → producto.
 */
export async function upsertCell({ restaurante_id, tipo_comida, dia_semana, producto_id, activo = true }) {
  const sql = `
    INSERT INTO menu_semanal (restaurante_id, tipo_comida, dia_semana, producto_id, activo)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      producto_id = VALUES(producto_id),
      activo = VALUES(activo),
      actualizado_en = NOW()
  `;
  await query(sql, [restaurante_id, tipo_comida, dia_semana, producto_id, activo ? 1 : 0]);
  return true;
}

/**
 * Elimina la celda (deja ese día/comida sin combo).
 */
export async function deleteCell({ restaurante_id, tipo_comida, dia_semana }) {
  await query(
    'DELETE FROM menu_semanal WHERE restaurante_id = ? AND tipo_comida = ? AND dia_semana = ?',
    [restaurante_id, tipo_comida, dia_semana]
  );
  return true;
}

/**
 * Productos-combo del restaurante (es_menu_dia = 1), para que el dueño elija
 * al armar la plantilla.
 */
export async function listCombosByRestaurant(restaurante_id) {
  return query(
    `SELECT id, nombre, descripcion, precio, imagen_url, disponible
       FROM productos
      WHERE restaurante_id = ? AND es_menu_dia = 1 AND estado = 'activo'
      ORDER BY nombre ASC`,
    [restaurante_id]
  );
}

/**
 * ¿El restaurante tiene al menos una celda cargada? Sirve para que el cliente
 * decida si mostrar (o no) la sección "Menú de hoy".
 */
export async function restaurantHasMenuSemanal(restaurante_id) {
  const row = await queryOne(
    'SELECT 1 AS x FROM menu_semanal WHERE restaurante_id = ? LIMIT 1',
    [restaurante_id]
  );
  return !!row;
}
