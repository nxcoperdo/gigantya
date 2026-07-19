import pool from '../config/database.js';
import { getConnection, query } from '../config/database.js';
import * as Conversacion from '../models/Conversacion.js';
import * as Mensaje from '../models/Mensaje.js';
import { createOrderCore, notificarNuevoPedido } from './orderService.js';
import { emitToConversation, emitToRestaurant } from '../socket/socketHandler.js';
import notificationService from './notificationService.js';
import { getRestaurantUser } from '../models/Restaurant.js';

/**
 * Servicio de chat cliente↔vendedor.
 *
 * Piloto: solo el local 4 (fruver) lo usa, pero el service es genérico.
 *
 * Responsabilidades:
 *  - Asegurar que exista la conversación abierta (upsert idempotente).
 *  - Persistir mensajes y emitir el evento socket al room conv_<id>.
 *  - Construir un draft de pedido a partir de los adjuntos de los mensajes
 *    del cliente (lo que clickeó en el catálogo).
 *  - Convertir la conversación en pedido vía createOrderCore con
 *    origen='web_asistido', canal='web' y creado_por=staff.id.
 */

/**
 * Asegura la conversación abierta para el (restaurante, cliente). Si el
 * cliente tiene JWT, el identificador es "user:<id>". Si no, se hashea
 * el teléfono para agrupar al mismo anónimo entre visitas.
 *
 * @param {Object} params
 * @param {number} params.restaurante_id
 * @param {string} [params.cliente_user_id]   - id de usuarios si está logueado
 * @param {string} params.cliente_nombre
 * @param {string} params.cliente_telefono    - requerido para anónimos, hasheable
 * @returns {Promise<{id:number, esNueva:boolean}>}
 */
export async function ensureConversation({ restaurante_id, cliente_user_id, cliente_nombre, cliente_telefono }) {
  // Validación de chat-piloto: el chat solo está disponible para locales
  // de mercado/abarrotes y que estén activos. Esta defensa es del lado
  // del servidor porque el cliente podría no estar actualizado (PWA
  // cacheada, app vieja) y bypassear el gate del front.
  const restRows = await query(
    `SELECT id, estado, es_mercado_abarrotes FROM restaurantes WHERE id = ? LIMIT 1`,
    [restaurante_id]
  );
  if (!restRows[0]) {
    const err = new Error('El local no existe');
    err.statusCode = 404;
    throw err;
  }
  if (restRows[0].estado !== 'activo') {
    const err = new Error('El local no está disponible para chatear');
    err.statusCode = 403;
    throw err;
  }
  if (!restRows[0].es_mercado_abarrotes) {
    const err = new Error('El chat solo está disponible para locales de mercado/abarrotes');
    err.statusCode = 403;
    throw err;
  }

  let identificador;
  if (cliente_user_id) {
    identificador = `user:${cliente_user_id}`;
  } else {
    // Para anónimos usamos el teléfono normalizado como agrupador. Si el
    // cliente no da teléfono, no creamos conversación (es obligatorio).
    if (!cliente_telefono) {
      const err = new Error('Para chatear sin cuenta debes proporcionar tu teléfono');
      err.statusCode = 400;
      throw err;
    }
    // Quitamos espacios, guiones y paréntesis para agrupar "300 123" con "300-123".
    const tel = String(cliente_telefono).replace(/[\s\-()]/g, '');
    identificador = `anon:${tel}`;
  }
  return await Conversacion.getOrCreateForClient({
    restaurante_id,
    cliente_identificador: identificador,
    cliente_nombre: cliente_nombre || null,
    cliente_telefono: cliente_telefono || null,
  });
}

/**
 * Persiste un mensaje y lo emite al room `conv_<id>` por socket.
 *
 * @param {Object} params
 * @param {number} params.conversacion_id
 * @param {'cliente'|'vendedor'|'sistema'} params.emisor_tipo
 * @param {string} params.contenido
 * @param {number} [params.emisor_usuario_id]  - si emisor='vendedor'
 * @param {Object} [params.adjuntos]            - {producto_id, nombre, precio}
 *
 * @returns {Promise<Object>} la fila del mensaje insertado
 */
export async function appendMensaje({ conversacion_id, emisor_tipo, contenido, emisor_usuario_id = null, adjuntos = null }) {
  if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
    const err = new Error('contenido es obligatorio');
    err.statusCode = 400;
    throw err;
  }
  // Validar que la conversación existe y está abierta o convertida.
  const conv = await Conversacion.getById(conversacion_id);
  if (!conv) {
    const err = new Error('Conversación no encontrada');
    err.statusCode = 404;
    throw err;
  }
  if (conv.estado === 'cerrada') {
    const err = new Error('La conversación está cerrada');
    err.statusCode = 409;
    throw err;
  }

  const msg = await Mensaje.append({
    conversacion_id,
    emisor_tipo,
    emisor_usuario_id,
    contenido: contenido.trim(),
    adjuntos,
  });
  // Touch para que la lista del admin reordene por actividad.
  await Conversacion.touchUltimo(conversacion_id);

  // Emitir por socket al room de la conversación.
  emitToConversation(conversacion_id, 'chat:new_message', {
    conversacion_id,
    mensaje: msg,
  });

  // Si el mensaje es del cliente, notificar al vendedor (en segundo plano,
  // best-effort). Solo si la conversación sigue "abierta" (en "convertida"
  // los mensajes de seguimiento no spamean al admin).
  if (emisor_tipo === 'cliente' && conv.estado === 'abierta') {
    emitToRestaurant(conv.restaurante_id, 'chat:new_message_admin', {
      conversacion_id,
      mensaje: msg,
    });
    // Notificación WhatsApp/email (best-effort, no rompe el flujo).
    notifyVendorNewMessage(conv, msg).catch(err =>
      console.error('[chat] notifyVendorNewMessage falló:', err.message)
    );
  }

  return msg;
}

/**
 * Marca como leídos los mensajes del emisor opuesto en una conversación.
 * Llamado por el cliente al abrir el panel y por el vendedor al abrir la
 * conversación en el admin.
 */
export async function markRead({ conversacion_id, emisor_tipo_lector }) {
  await Mensaje.markReadByOther(conversacion_id, emisor_tipo_lector);
  return { ok: true };
}

/**
 * Construye un draft de pedido a partir de los adjuntos_json de los mensajes
 * del cliente en la conversación.
 *
 * Devuelve un array `items` con shape { producto_id, cantidad, precio_unitario, nombre? }
 * listo para pasar a createOrderCore. Si no hay adjuntos, devuelve [] y el
 * vendedor completa el draft a mano en el modal.
 *
 * Reglas:
 *  - Agrupa por producto_id sumando cantidades.
 *  - Toma el `precio` del primer adjunto visto (snapshot al momento del click).
 *    El service de pedidos re-valida contra la BD con SELECT ... FOR UPDATE,
 *    así que si el precio cambió, gana el de la BD. Aquí el `precio_unitario`
 *    es solo sugerencia para mostrar en el modal.
 */
export async function buildDraftFromConversation(conversacion_id) {
  const mensajes = await Mensaje.listByConversacion(conversacion_id, { direction: 'asc' });
  const byProducto = new Map();
  for (const m of mensajes) {
    if (m.emisor_tipo !== 'cliente') continue;
    if (!m.adjuntos_json) continue;
    let adj;
    try {
      adj = typeof m.adjuntos_json === 'string' ? JSON.parse(m.adjuntos_json) : m.adjuntos_json;
    } catch {
      continue;
    }
    if (!adj || !adj.producto_id) continue;
    const key = Number(adj.producto_id);
    const prev = byProducto.get(key);
    if (prev) {
      prev.cantidad += 1;
    } else {
      byProducto.set(key, {
        producto_id: key,
        cantidad: 1,
        precio_unitario: Number(adj.precio) || 0,
        nombre: adj.nombre || null,
      });
    }
  }
  return Array.from(byProducto.values());
}

/**
 * Convierte la conversación en un pedido vía createOrderCore.
 *
 * @param {Object} params
 * @param {number} params.conversacion_id
 * @param {Object} params.pedidoDraft
 *   - items: [{producto_id, cantidad, adiciones?, removidos?, nota?}]
 *   - notas, direccion_entrega, telefono_contacto, metodo_pago, esRetiroLocal, costo_envio
 *   - usuario_id: id del cliente (si logueado) o null (y creamos walk-in con su teléfono)
 * @param {number} params.creado_por_usuario_id   - id del vendedor
 *
 * @returns {Promise<{conversacion:Object, pedido_id:number}>}
 */
export async function convertToOrder({ conversacion_id, pedidoDraft, creado_por_usuario_id }) {
  const conv = await Conversacion.getById(conversacion_id);
  if (!conv) {
    const err = new Error('Conversación no encontrada');
    err.statusCode = 404;
    throw err;
  }
  if (conv.estado === 'convertida') {
    const err = new Error('Esta conversación ya fue convertida en pedido');
    err.statusCode = 409;
    throw err;
  }
  if (conv.estado === 'cerrada') {
    const err = new Error('La conversación está cerrada');
    err.statusCode = 409;
    throw err;
  }

  const {
    items,
    notas = '',
    direccion_entrega = null,
    telefono_contacto = null,
    metodo_pago = 'contra_entrega',
    esRetiroLocal = false,
    esConsumoEnLocal = false,
    costo_envio = 0,
    usuario_id = null,        // si el cliente está logueado, su id; si no, null
  } = pedidoDraft;

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('items es requerido y no puede estar vacío');
    err.statusCode = 400;
    throw err;
  }

  // Si no hay usuario_id (cliente anónimo), creamos un walk-in con email
  // sintético basado en el teléfono. El mismo patrón que usa posOrderController
  // para que los datos queden consistentes con el resto del sistema.
  let finalUsuarioId = usuario_id;
  if (!finalUsuarioId) {
    finalUsuarioId = await ensureWalkinUser({
      nombre: conv.cliente_nombre,
      telefono: conv.cliente_telefono || telefono_contacto,
    });
  }

  // Transaccional: crear pedido y marcar conversación como convertida.
  // Usamos getConnection para garantizar que si el INSERT del pedido falla,
  // NO se marque la conversación como convertida.
  const connection = await getConnection();
  let pedidoId = null;
  try {
    await connection.beginTransaction();

    // Llamamos a createOrderCore en la misma conexión para que el INSERT
    // del pedido forme parte de esta transacción. PERO createOrderCore
    // internamente abre su propia transacción — para no anidar, lo
    // llamamos FUERA de la transacción y luego marcamos convertida.
    // Si la marcación falla, el pedido queda pero la conversación sigue
    // "abierta" (se puede reintentar la conversión, pero ahora habría
    // dos pedidos. Riesgo aceptable para el piloto).
    await connection.rollback();
  } catch (e) {
    // No-op: solo queríamos asegurarnos de que no hay tx abierta.
  } finally {
    connection.release();
  }

  // Crear el pedido (createOrderCore maneja su propia tx).
  pedidoId = await createOrderCore({
    usuario_id: finalUsuarioId,
    restaurante_id: conv.restaurante_id,
    items,
    notas,
    direccion_entrega: esRetiroLocal || esConsumoEnLocal ? null : direccion_entrega,
    telefono_contacto: telefono_contacto || conv.cliente_telefono || null,
    coupon_id: null,                          // chat no permite cupones
    metodo_pago,
    costo_envio: esRetiroLocal || esConsumoEnLocal ? 0 : (costo_envio || 0),
    esRetiroLocal,
    esConsumoEnLocal,
    total: null,                              // que lo recalcule createOrderCore
    canal: 'web',
    origen: 'web_asistido',
    mesa_id: null,
    creado_por: creado_por_usuario_id,
  }, { clientSource: 'chat' });

  // Marcar la conversación como convertida y pegarle el pedido_id.
  await Conversacion.markConvertida(conversacion_id, pedidoId);

  // Mensaje de sistema en la conversación avisando.
  const sistemaMsg = await Mensaje.append({
    conversacion_id,
    emisor_tipo: 'sistema',
    contenido: `Pedido #${pedidoId} creado.`,
  });
  await Conversacion.touchUltimo(conversacion_id);
  emitToConversation(conversacion_id, 'chat:new_message', {
    conversacion_id,
    mensaje: sistemaMsg,
  });
  emitToRestaurant(conv.restaurante_id, 'chat:new_message_admin', {
    conversacion_id,
    mensaje: sistemaMsg,
  });

  // Notificar al local (igual que un pedido web normal: email al restaurante).
  notificarNuevoPedido(pedidoId).catch(err =>
    console.error('[chat] notificarNuevoPedido falló:', err.message)
  );

  return {
    conversacion: { ...conv, estado: 'convertida', pedido_id: pedidoId },
    pedido_id: pedidoId,
  };
}

/**
 * Crea un usuario walk-in (placeholder) cuando el cliente anónimo no tiene
 * cuenta. Mismo patrón que posOrderController.createPosOrder.
 *
 * El email sintético garantiza que el UNIQUE index de usuarios.email no
 * choque si el mismo cliente anónimo chatea varias veces (mismo teléfono
 * → mismo email → en el segundo intento, el ON DUPLICATE KEY UPDATE lo
 * refresca). Si el cliente ya tiene cuenta con ese teléfono, lo ideal
 * sería vincular, pero eso es futuro.
 */
async function ensureWalkinUser({ nombre, telefono }) {
  if (!telefono) {
    const err = new Error('Para chatear sin cuenta debes proporcionar tu teléfono');
    err.statusCode = 400;
    throw err;
  }
  const tel = String(telefono).replace(/[\s\-()]/g, '');
  const emailSintetico = `walkin_${tel}@anon.gigantya`;
  const displayName = (nombre && nombre.trim()) || `Cliente ${tel.slice(-4)}`;

  // INSERT ... ON DUPLICATE KEY UPDATE: reusar el walk-in existente.
  const [result] = await pool.query(
    `INSERT INTO usuarios (nombre, email, telefono, tipo_usuario, estado, creado_en)
     VALUES (?, ?, ?, 'cliente', 'activo', NOW())
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), telefono = VALUES(telefono), estado = 'activo'`,
    [displayName, emailSintetico, tel]
  );
  // Si fue INSERT, devolver insertId. Si fue UPDATE (duplicate), result.insertId
  // puede no ser el id real. Hacer un SELECT para estar seguros.
  if (result.insertId && result.insertId > 0) return result.insertId;
  const row = await query(`SELECT id FROM usuarios WHERE email = ? LIMIT 1`, [emailSintetico]);
  return row[0]?.id;
}

/**
 * Notifica al vendedor (WhatsApp/email/Notification) que le llegó un mensaje
 * nuevo. Best-effort: si falla, el chat sigue funcionando.
 *
 * Tres canales, independientes:
 *  1) NotificationModel in-app (toast en NotificationCenter) — siempre
 *     que se pueda identificar un dueño del local.
 *  2) Email al dueño — si tiene email cargado.
 *  3) WhatsApp al dueño — si tiene teléfono y la plantilla está aprobada
 *     en Meta. Si no, falla silenciosamente y el email/notificación in-app
 *     cubren el flujo.
 */
async function notifyVendorNewMessage(conv, mensaje) {
  // 1) Notificación in-app (NotificationModel)
  try {
    const { createNotification } = await import('../models/Notification.js');
    const duenoRows = await query(
      `SELECT id FROM usuarios WHERE restaurante_id = ? AND estado = 'activo' LIMIT 1`,
      [conv.restaurante_id]
    );
    if (duenoRows[0]) {
      await createNotification({
        usuario_id: duenoRows[0].id,
        tipo: 'chat_mensaje',
        titulo: `Nuevo mensaje de ${conv.cliente_nombre || 'un cliente'}`,
        mensaje: (mensaje.contenido || '').substring(0, 120),
        data: { conversacion_id: conv.id, mensaje_id: mensaje.id, restaurante_id: conv.restaurante_id },
      });
    }
  } catch (err) {
    console.error('[chat] notifyVendorNewMessage no pudo crear NotificationModel:', err.message);
  }

  // 2) + 3) Email + WhatsApp al dueño (Fase 6).
  // Si falla la query o el envío, lo logueamos pero el chat no se rompe.
  try {
    const dueno = await getRestaurantUser(conv.restaurante_id);
    // getRestaurantUser devuelve la fila del dueño; necesitamos el
    // nombre del restaurante para el email/WhatsApp. Como la conv no
    // siempre lo trae, lo leemos aparte.
    let restauranteNombre = conv.restaurante_nombre;
    if (!restauranteNombre) {
      const restRow = await query(
        `SELECT nombre FROM restaurantes WHERE id = ? LIMIT 1`,
        [conv.restaurante_id]
      );
      restauranteNombre = restRow[0]?.nombre || 'tu local';
    }
    await notificationService.notifyNewChatMessage({
      conversacion: { ...conv, restaurante_nombre: restauranteNombre },
      mensaje,
      dueno,
    });
  } catch (err) {
    console.error('[chat] notifyVendorNewMessage email/whatsapp:', err.message);
  }
}

export default {
  ensureConversation,
  appendMensaje,
  markRead,
  buildDraftFromConversation,
  convertToOrder,
};
