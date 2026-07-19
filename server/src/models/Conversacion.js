import { query, queryOne } from '../config/database.js';

/**
 * Estados posibles de una conversación.
 * - abierta:    cliente y vendedor pueden seguir escribiendo.
 * - cerrada:    la dio por terminada alguno de los dos (no se borra, queda
 *               para auditoría).
 * - convertida: la conversación dio lugar a un pedido (el vendedor usó
 *               "Armar pedido"). Puede seguir recibiendo mensajes de
 *               seguimiento pero el estado ya no cambia.
 */
export const CONVERSATION_STATES = {
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
  CONVERTIDA: 'convertida',
};

/**
 * Devuelve una conversación por id. Devuelve `null` si no existe.
 */
export async function getById(id) {
  return await queryOne(
    `SELECT * FROM conversaciones WHERE id = ? LIMIT 1`,
    [id]
  );
}

/**
 * Upsert idempotente: si ya existe una conversación ABIERTA para el par
 * (restaurante_id, cliente_identificador), la devuelve; si no, la crea.
 *
 * Patrón inspirado en `SearchHistory.upsertSearch`: evitamos race conditions
 * entre dos requests concurrentes (ej. el cliente abre dos pestañas) usando
 * `INSERT ... ON DUPLICATE KEY UPDATE` contra un UNIQUE index.
 *
 * IMPORTANTE: la UNIQUE KEY (restaurante_id, cliente_identificador) la crea
 * la migración `20260719000001_chat_fruver` con `idx_conv_cliente`. Pero ese
 * índice NO es UNIQUE por sí solo (es KEY, no UNIQUE KEY). Por eso este
 * upsert funciona así:
 *   1. SELECT la fila por (restaurante_id, cliente_identificador, estado='abierta').
 *      Si existe, devolverla.
 *   2. Si no, INSERT. Si choca por PK race (otro request creó mientras), volver
 *      a la rama 1.
 *
 * Para una sola conversación "abierta por cliente y local" alcanza con este
 * bucle de 1 vuelta en el caso normal. La rama de retry es defensiva.
 */
export async function getOrCreateForClient({
  restaurante_id,
  cliente_identificador,
  cliente_nombre = null,
  cliente_telefono = null,
}) {
  // Rama 1: SELECT
  const existing = await queryOne(
    `SELECT * FROM conversaciones
     WHERE restaurante_id = ? AND cliente_identificador = ? AND estado = 'abierta'
     LIMIT 1`,
    [restaurante_id, cliente_identificador]
  );
  if (existing) {
    // Si el cliente actualizó nombre/teléfono, los persistimos (no rompe la fila).
    if ((cliente_nombre && cliente_nombre !== existing.cliente_nombre) ||
        (cliente_telefono && cliente_telefono !== existing.cliente_telefono)) {
      await query(
        `UPDATE conversaciones
         SET cliente_nombre = COALESCE(?, cliente_nombre),
             cliente_telefono = COALESCE(?, cliente_telefono)
         WHERE id = ?`,
        [cliente_nombre, cliente_telefono, existing.id]
      );
    }
    return { ...existing, esNueva: false };
  }

  // Rama 2: INSERT (puede fallar si hay race con otro request)
  try {
    const result = await query(
      `INSERT INTO conversaciones
         (restaurante_id, cliente_identificador, cliente_nombre, cliente_telefono, estado)
       VALUES (?, ?, ?, ?, 'abierta')`,
      [restaurante_id, cliente_identificador, cliente_nombre, cliente_telefono]
    );
    const created = await getById(result.insertId);
    return { ...created, esNueva: true };
  } catch (err) {
    // Race: re-leemos. Si todavía no hay abierta, rethrow.
    const retry = await queryOne(
      `SELECT * FROM conversaciones
       WHERE restaurante_id = ? AND cliente_identificador = ? AND estado = 'abierta'
       LIMIT 1`,
      [restaurante_id, cliente_identificador]
    );
    if (retry) return { ...retry, esNueva: false };
    throw err;
  }
}

/**
 * Lista conversaciones del local para el panel del vendedor.
 *
 * @param {number} restaurante_id
 * @param {Object} [options]
 * @param {string} [options.estado='abierta']  'abierta' | 'cerrada' | 'convertida' | 'todas'
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 *
 * Devuelve además `ultimo_mensaje` (preview) y `no_leidos` (count de mensajes
 * del cliente sin leer por el vendedor) para alimentar la columna izquierda
 * del ChatAdminPage.
 */
export async function listByRestaurante(restaurante_id, { estado = 'abierta', limit = 100, offset = 0 } = {}) {
  const whereEstado = estado === 'todas' ? '' : 'AND c.estado = ?';
  const params = estado === 'todas' ? [restaurante_id, limit, offset] : [restaurante_id, estado, limit, offset];
  const sql = `
    SELECT
      c.*,
      (SELECT contenido FROM mensajes m
        WHERE m.conversacion_id = c.id
        ORDER BY m.created_at DESC LIMIT 1) AS ultimo_mensaje_preview,
      (SELECT COUNT(*) FROM mensajes m
        WHERE m.conversacion_id = c.id
          AND m.emisor_tipo = 'cliente'
          AND m.leido_en IS NULL) AS no_leidos
    FROM conversaciones c
    WHERE c.restaurante_id = ? ${whereEstado}
    ORDER BY c.ultimo_mensaje_en DESC, c.id DESC
    LIMIT ? OFFSET ?
  `;
  return await query(sql, params);
}

/**
 * Actualiza `ultimo_mensaje_en` cuando se inserta un mensaje nuevo.
 * Helper usado por chatService para mantener el orden de la lista del admin
 * por actividad, no por fecha de creación.
 */
export async function touchUltimo(conversacion_id) {
  await query(
    `UPDATE conversaciones SET ultimo_mensaje_en = NOW() WHERE id = ?`,
    [conversacion_id]
  );
}

/**
 * Marca la conversación como `convertida` y le pega el `pedido_id`.
 * Llamado por chatService.convertToOrder después de un createOrderCore exitoso.
 */
export async function markConvertida(conversacion_id, pedido_id) {
  await query(
    `UPDATE conversaciones
     SET estado = 'convertida', pedido_id = ?
     WHERE id = ?`,
    [pedido_id, conversacion_id]
  );
}

/**
 * Marca la conversación como `cerrada` (uno de los dos decidió terminar).
 */
export async function markCerrada(conversacion_id) {
  await query(
    `UPDATE conversaciones SET estado = 'cerrada' WHERE id = ?`,
    [conversacion_id]
  );
}

/**
 * Cuenta mensajes no leídos por el vendedor (los del cliente) para
 * alimentar el badge del sidebar del admin.
 */
export async function countUnreadForVendedor(restaurante_id) {
  const row = await queryOne(
    `SELECT COUNT(*) AS total
     FROM mensajes m
     INNER JOIN conversaciones c ON c.id = m.conversacion_id
     WHERE c.restaurante_id = ?
       AND m.emisor_tipo = 'cliente'
       AND m.leido_en IS NULL`,
    [restaurante_id]
  );
  return row?.total ?? 0;
}

export default {
  CONVERSATION_STATES,
  getById,
  getOrCreateForClient,
  listByRestaurante,
  touchUltimo,
  markConvertida,
  markCerrada,
  countUnreadForVendedor,
};
