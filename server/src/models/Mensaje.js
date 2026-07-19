import { query, queryOne } from '../config/database.js';

/**
 * Tipos de emisor de un mensaje.
 * - cliente:    lo escribió el cliente (logueado o anónimo).
 * - vendedor:   lo escribió el staff del local.
 * - sistema:    mensajes generados automáticamente (ej. "Pedido #N creado").
 */
export const EMISOR_TIPOS = {
  CLIENTE: 'cliente',
  VENDEDOR: 'vendedor',
  SISTEMA: 'sistema',
};

/**
 * Inserta un mensaje nuevo y devuelve la fila completa.
 *
 * NO toca `conversaciones.ultimo_mensaje_en` — eso lo hace chatService
 * después de validar que el INSERT fue exitoso. Mantener el modelo libre
 * de side-effects sobre otras tablas (regla del repo).
 *
 * @param {Object} data
 * @param {number} data.conversacion_id
 * @param {'cliente'|'vendedor'|'sistema'} data.emisor_tipo
 * @param {number|null} data.emisor_usuario_id  - id del vendedor (NULL si cliente o sistema)
 * @param {string} data.contenido
 * @param {Object|null} [data.adjuntos]        - {producto_id, nombre, precio} cuando viene del catálogo
 *
 * @returns {Promise<Object>} la fila insertada (id, created_at, etc.)
 */
export async function append({ conversacion_id, emisor_tipo, emisor_usuario_id = null, contenido, adjuntos = null }) {
  if (!conversacion_id) {
    throw new Error('append: conversacion_id es obligatorio');
  }
  if (!Object.values(EMISOR_TIPOS).includes(emisor_tipo)) {
    throw new Error(`append: emisor_tipo inválido "${emisor_tipo}"`);
  }
  if (typeof contenido !== 'string' || contenido.length === 0) {
    throw new Error('append: contenido es obligatorio');
  }

  // MySQL JSON: si no viene adjuntos, persistimos NULL (no '{}'). El driver
  // mysql2 acepta object directamente y lo serializa.
  const adjuntosJson = adjuntos ? JSON.stringify(adjuntos) : null;

  const result = await query(
    `INSERT INTO mensajes
       (conversacion_id, emisor_tipo, emisor_usuario_id, contenido, adjuntos_json)
     VALUES (?, ?, ?, ?, ?)`,
    [conversacion_id, emisor_tipo, emisor_usuario_id, contenido, adjuntosJson]
  );
  return await getById(result.insertId);
}

/**
 * Devuelve un mensaje por id. Devuelve `null` si no existe.
 */
export async function getById(id) {
  return await queryOne(
    `SELECT * FROM mensajes WHERE id = ? LIMIT 1`,
    [id]
  );
}

/**
 * Lista mensajes de una conversación, paginados.
 *
 * Default: los más recientes primero (DESC). El cliente al cargar el chat
 * pide la última página y se hace append inverso en la UI, o se pide la
 * primera con `direction='asc'`.
 *
 * @param {number} conversacion_id
 * @param {Object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.before_id]  - solo mensajes con id < before_id (paginación backward)
 * @param {'asc'|'desc'} [options.direction='asc']  - sentido de la lista
 */
export async function listByConversacion(conversacion_id, { limit = 50, before_id = null, direction = 'asc' } = {}) {
  const whereBefore = before_id ? `AND id ${direction === 'desc' ? '<' : '>'} ?` : '';
  const params = before_id
    ? [conversacion_id, before_id, parseInt(limit)]
    : [conversacion_id, parseInt(limit)];
  const order = direction === 'desc' ? 'DESC' : 'ASC';
  const sql = `
    SELECT * FROM mensajes
    WHERE conversacion_id = ? ${whereBefore}
    ORDER BY id ${order}
    LIMIT ?
  `;
  return await query(sql, params);
}

/**
 * Marca como leídos los mensajes del `emisor_tipo` opuesto en una conversación.
 * Típicamente llamado por el vendedor cuando abre la conversación (marca los
 * del cliente como leídos) o por el cliente cuando entra al panel (marca los
 * del vendedor como leídos).
 *
 * @param {number} conversacion_id
 * @param {'cliente'|'vendedor'} emisor_tipo_origen  - marca como leídos los del OTRO emisor
 */
export async function markReadByOther(conversacion_id, emisor_tipo_origen) {
  // Leemos el enum: lo que NO es del emisor_origen es lo que se está leyendo.
  // cliente → marca los del 'vendedor' y 'sistema' como leídos.
  // vendedor → marca los del 'cliente' como leídos.
  let where;
  if (emisor_tipo_origen === 'cliente') {
    where = `emisor_tipo IN ('vendedor','sistema')`;
  } else if (emisor_tipo_origen === 'vendedor') {
    where = `emisor_tipo = 'cliente'`;
  } else {
    throw new Error(`markReadByOther: emisor_tipo_origen inválido "${emisor_tipo_origen}"`);
  }
  await query(
    `UPDATE mensajes SET leido_en = NOW()
     WHERE conversacion_id = ? AND leido_en IS NULL AND ${where}`,
    [conversacion_id]
  );
}

/**
 * Cuenta mensajes no leídos por el emisor_tipo lector en una conversación.
 * Helper para badges en el UI.
 */
export async function countUnread(conversacion_id, emisor_tipo_lector) {
  let whereOtro;
  if (emisor_tipo_lector === 'cliente') {
    whereOtro = `emisor_tipo IN ('vendedor','sistema')`;
  } else if (emisor_tipo_lector === 'vendedor') {
    whereOtro = `emisor_tipo = 'cliente'`;
  } else {
    return 0;
  }
  const row = await queryOne(
    `SELECT COUNT(*) AS total FROM mensajes
     WHERE conversacion_id = ? AND leido_en IS NULL AND ${whereOtro}`,
    [conversacion_id]
  );
  return row?.total ?? 0;
}

export default {
  EMISOR_TIPOS,
  append,
  getById,
  listByConversacion,
  markReadByOther,
  countUnread,
};
