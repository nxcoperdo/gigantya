import { query, queryOne } from '../config/database.js';

/**
 * Estados posibles de un pedido
 */
export const ORDER_STATES = {
  PENDIENTE: 'Pendiente',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado'
};

/**
 * Crear nuevo pedido
 */
export async function createOrder(orderData) {
  const {
    usuario_id,
    restaurante_id,
    total,
    notas = '',
    direccion_entrega,
    telefono_contacto
  } = orderData;

  const sql = `
    INSERT INTO pedidos (
      usuario_id,
      restaurante_id,
      total,
      estado,
      notas,
      direccion_entrega,
      telefono_contacto,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      restaurante_id,
      total,
      ORDER_STATES.PENDIENTE,
      notas,
      direccion_entrega,
      telefono_contacto
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando pedido: ${error.message}`);
  }
}

/**
 * Agregar item al pedido
 */
export async function addOrderItem(pedido_id, producto_id, cantidad, precio_unitario) {
  const sql = `
    INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?)
  `;

  const subtotal = cantidad * precio_unitario;

  try {
    const result = await query(sql, [
      pedido_id,
      producto_id,
      cantidad,
      precio_unitario,
      subtotal
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error agregando item al pedido: ${error.message}`);
  }
}

/**
 * Obtener pedido con sus items
 */
export async function getOrderById(id) {
  const sql = `
    SELECT 
      p.*,
      r.nombre as restaurante_nombre,
      r.telefono as restaurante_telefono,
      u.nombre as cliente_nombre,
      u.email as cliente_email,
      u.telefono as cliente_telefono
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    WHERE p.id = ?
  `;

  const pedido = await queryOne(sql, [id]);

  if (!pedido) return null;

  // Obtener items del pedido
  const items = await query(`
    SELECT 
      ip.*,
      pr.nombre as producto_nombre,
      pr.descripcion as producto_descripcion,
      pr.imagen_url as producto_imagen
    FROM items_pedido ip
    LEFT JOIN productos pr ON ip.producto_id = pr.id
    WHERE ip.pedido_id = ?
  `, [id]);

  pedido.items = items;
  return pedido;
}

/**
 * Obtener pedidos del usuario
 */
export async function getOrdersByUser(usuario_id, limit) {
    // Aseguramos valores numéricos/definidos
    const safeId = usuario_id;
    const safeLimit = parseInt(limit, 10) || 20;

    if (safeId === undefined || safeId === null) {
        throw new Error("El ID del usuario es necesario para consultar pedidos.");
    }

    const sql = `
    SELECT 
      p.id, p.usuario_id, p.restaurante_id, p.total, p.estado, p.notas,
      p.direccion_entrega, p.telefono_contacto, p.creado_en, p.actualizado_en,
      r.nombre as restaurante_nombre,
      (SELECT COUNT(*) FROM items_pedido WHERE pedido_id = p.id) as items_count
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    WHERE p.usuario_id = ?
    ORDER BY p.creado_en DESC
    LIMIT ?
  `;

    // Forzamos que los parámetros sean estrictamente un array de dos elementos
    return await query(sql, [safeId, safeLimit]);
}
/**
 * Obtener pedidos del restaurante
 */
export async function getOrdersByRestaurant(restaurante_id, filtro = null) {
  let sql = `
    SELECT 
      p.*,
      u.nombre as cliente_nombre,
      u.telefono as cliente_telefono,
      COUNT(ip.id) as items_count
    FROM pedidos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
    WHERE p.restaurante_id = ?
  `;

  const params = [restaurante_id];

  if (filtro && filtro !== 'todos') {
    sql += ' AND p.estado = ?';
    params.push(filtro);
  }

  sql += ' GROUP BY p.id ORDER BY p.creado_en DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo pedidos del restaurante: ${error.message}`);
  }
}

/**
 * Actualizar estado del pedido
 */
export async function updateOrderStatus(id, nuevoEstado) {
  // Validar que sea un estado válido
  if (!Object.values(ORDER_STATES).includes(nuevoEstado)) {
    throw new Error(`Estado inválido: ${nuevoEstado}`);
  }

  const sql = 'UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?';

  try {
    await query(sql, [nuevoEstado, id]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando estado del pedido: ${error.message}`);
  }
}

/**
 * Cancelar pedido
 */
export async function cancelOrder(id) {
  return updateOrderStatus(id, ORDER_STATES.CANCELADO);
}

/**
 * Obtener estadísticas de pedidos
 */
export async function getOrderStats(restaurante_id, days = 30) {
  const sql = `
    SELECT 
      DATE(creado_en) as fecha,
      COUNT(*) as total_pedidos,
      SUM(total) as ingresos,
      AVG(total) as promedio_pedido
    FROM pedidos
    WHERE restaurante_id = ? AND creado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY DATE(creado_en)
    ORDER BY fecha DESC
  `;

  try {
    return await query(sql, [restaurante_id, parseInt(days)]);
  } catch (error) {
    throw new Error(`Error obteniendo estadísticas: ${error.message}`);
  }
}

export default {
  ORDER_STATES,
  createOrder,
  addOrderItem,
  getOrderById,
  getOrdersByUser,
  getOrdersByRestaurant,
  updateOrderStatus,
  cancelOrder,
  getOrderStats
};
