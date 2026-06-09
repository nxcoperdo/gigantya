import { query, queryOne } from '../config/database.js';

/**
 * Crear una nueva suscripción (cuando el admin asigna un plan).
 * Cierra cualquier suscripción activa previa del mismo restaurante.
 */
export async function createSubscription(data) {
  const {
    restaurante_id,
    plan,
    fecha_inicio,
    fecha_vencimiento,
    monto_pagado = null,
    metodo_pago = null,
    notas = null,
    creado_por = null,
  } = data;

  // Cerrar suscripciones activas previas
  await query(
    `UPDATE suscripciones SET estado = 'cancelada', actualizado_en = NOW()
     WHERE restaurante_id = ? AND estado = 'activa'`,
    [restaurante_id]
  );

  const sql = `
    INSERT INTO suscripciones (
      restaurante_id, plan, fecha_inicio, fecha_vencimiento,
      monto_pagado, metodo_pago, notas, creado_por
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [
    restaurante_id,
    plan,
    fecha_inicio,
    fecha_vencimiento,
    monto_pagado,
    metodo_pago,
    notas,
    creado_por,
  ]);

  return result.insertId;
}

/**
 * Obtener la suscripción activa de un restaurante, o null si no tiene.
 */
export async function getActiveSubscription(restaurante_id) {
  const sql = `
    SELECT * FROM suscripciones
    WHERE restaurante_id = ? AND estado = 'activa'
    ORDER BY fecha_vencimiento DESC
    LIMIT 1
  `;
  return queryOne(sql, [restaurante_id]);
}

/**
 * Historial completo de suscripciones de un restaurante (más recientes primero).
 */
export async function getSubscriptionHistory(restaurante_id) {
  const sql = `
    SELECT s.*, u.nombre AS creado_por_nombre
    FROM suscripciones s
    LEFT JOIN usuarios u ON s.creado_por = u.id
    WHERE s.restaurante_id = ?
    ORDER BY s.fecha_inicio DESC
  `;
  return query(sql, [restaurante_id]);
}

/**
 * Marcar una suscripción como vencida y devolver cuántas se actualizaron.
 * Usado por el cron job.
 */
export async function markSubscriptionExpired(suscripcion_id) {
  const sql = `
    UPDATE suscripciones
    SET estado = 'vencida', actualizado_en = NOW()
    WHERE id = ? AND estado = 'activa'
  `;
  const result = await query(sql, [suscripcion_id]);
  return result.affectedRows || 0;
}

/**
 * Marcar recordatorio_enviado = true para no volver a notificar hoy.
 */
export async function markReminderSent(suscripcion_id) {
  const sql = `
    UPDATE suscripciones
    SET recordatorio_enviado = 1, actualizado_en = NOW()
    WHERE id = ?
  `;
  return query(sql, [suscripcion_id]);
}

/**
 * Suscripciones que vencen dentro de `dias` días y aún no recibieron recordatorio.
 * Usado por el cron job.
 */
export async function getSubscriptionsExpiringInDays(dias) {
  const sql = `
    SELECT s.*, r.nombre AS restaurante_nombre, r.usuario_id
    FROM suscripciones s
    JOIN restaurantes r ON s.restaurante_id = r.id
    WHERE s.estado = 'activa'
      AND s.recordatorio_enviado = 0
      AND s.fecha_vencimiento BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
  `;
  return query(sql, [dias]);
}

/**
 * Suscripciones que ya vencieron y siguen activas.
 * Usado por el cron job para degradar a basico.
 */
export async function getExpiredActiveSubscriptions() {
  const sql = `
    SELECT s.*, r.id AS restaurante_id_db
    FROM suscripciones s
    JOIN restaurantes r ON s.restaurante_id = r.id
    WHERE s.estado = 'activa' AND s.fecha_vencimiento < NOW()
  `;
  return query(sql);
}

export default {
  createSubscription,
  getActiveSubscription,
  getSubscriptionHistory,
  markSubscriptionExpired,
  markReminderSent,
  getSubscriptionsExpiringInDays,
  getExpiredActiveSubscriptions,
};
