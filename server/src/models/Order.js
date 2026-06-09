import pool, { query, queryOne } from '../config/database.js';

/**
 * Estados posibles de un pedido
 */
export const ORDER_STATES = {
  PENDIENTE: 'Pendiente',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  COMPROBANTE_ENVIADO: 'Comprobante Enviado',
  PAGO_CONFIRMADO: 'Pago Confirmado',
  PAGO_RECHAZADO: 'Pago Rechazado'
};

/**
 * Métodos de pago disponibles
 */
export const PAYMENT_METHODS = {
  CONTRA_ENTREGA: 'contra_entrega',
  NEQUI: 'nequi',
  DAVIPLATA: 'daviplata',
  BRE_B: 'bre_b'
};

const ORDER_TAX_RATE = Number(process.env.ORDER_TAX_RATE ?? 0.08);

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('items debe ser un array no vacio');
  }

  const grouped = new Map();

  for (const item of items) {
    const producto_id = Number(item?.producto_id);
    const cantidad = Number(item?.cantidad);

    if (!Number.isInteger(producto_id) || producto_id <= 0) {
      throw createValidationError('Cada item debe tener un producto_id valido');
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw createValidationError('Cada item debe tener una cantidad entera positiva');
    }

    grouped.set(producto_id, (grouped.get(producto_id) || 0) + cantidad);
  }

  return Array.from(grouped, ([producto_id, cantidad]) => ({ producto_id, cantidad }));
}

export function calculateOrderTotal(items, coupon = null, taxRate = ORDER_TAX_RATE) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.precio_unitario) * Number(item.cantidad),
    0
  );

  let discountAmount = 0;
  if (coupon) {
    if (coupon.tipo_descuento === 'porcentaje') {
      discountAmount = subtotal * (Number(coupon.descuento) / 100);
    } else {
      discountAmount = Number(coupon.descuento);
    }
    // El descuento no puede superar el subtotal
    discountAmount = Math.min(discountAmount, subtotal);
  }

  const total = (subtotal - discountAmount) * (1 + taxRate);

  return Number(total.toFixed(2));
}

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
 * Crear pedido completo de forma atomica recalculando precios desde la BD.
 */
export async function createOrderWithItems(orderData) {
  const {
    usuario_id,
    restaurante_id,
    items,
    notas = '',
    direccion_entrega,
    telefono_contacto,
    coupon_id = null,
    metodo_pago = 'contra_entrega'
  } = orderData;

  const normalizedItems = normalizeOrderItems(items);
  const productIds = normalizedItems.map(item => item.producto_id);
  const placeholders = productIds.map(() => '?').join(', ');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [products] = await connection.query(
      `
        SELECT id, restaurante_id, precio, disponible, estado
        FROM productos
        WHERE id IN (${placeholders})
        FOR UPDATE
      `,
      productIds
    );

    if (products.length !== normalizedItems.length) {
      throw createValidationError('Uno o mas productos no existen');
    }

    const productsById = new Map(products.map(product => [Number(product.id), product]));
    const pricedItems = normalizedItems.map(item => {
      const product = productsById.get(item.producto_id);

      if (Number(product.restaurante_id) !== Number(restaurante_id)) {
        throw createValidationError('Todos los productos deben pertenecer al restaurante seleccionado');
      }

      if (product.estado !== 'activo' || Number(product.disponible) !== 1) {
        throw createValidationError('Uno o mas productos no estan disponibles');
      }

      return {
        ...item,
        precio_unitario: Number(product.precio)
      };
    });

    // Obtener datos del cupón si se proporcionó
    let coupon = null;
    if (coupon_id) {
      // FIX: validar también que el cupón pertenece al mismo restaurante.
      // Sin este filtro, un cupón creado por el restaurante A podría
      // aplicarse a pedidos del restaurante B (vulnerabilidad menor).
      const [couponResult] = await connection.query(
        'SELECT * FROM cupones WHERE id = ? AND restaurante_id = ?',
        [coupon_id, restaurante_id]
      );
      coupon = couponResult[0];
    }

    const total = calculateOrderTotal(pricedItems, coupon);

    // Determinar estado inicial según método de pago
    const estadoInicial = metodo_pago === 'contra_entrega'
      ? ORDER_STATES.PENDIENTE
      : ORDER_STATES.COMPROBANTE_ENVIADO;

    const [orderResult] = await connection.query(
      `
        INSERT INTO pedidos (
          usuario_id,
          restaurante_id,
          total,
          estado,
          metodo_pago,
          estado_validacion_pago,
          notas,
          direccion_entrega,
          telefono_contacto,
          creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        usuario_id,
        restaurante_id,
        total,
        estadoInicial,
        metodo_pago,
        metodo_pago === 'contra_entrega' ? 'aprobado' : 'pendiente',
        notas,
        direccion_entrega,
        telefono_contacto
      ]
    );

    const pedidoId = orderResult.insertId;

    for (const item of pricedItems) {
      const subtotal = Number((item.cantidad * item.precio_unitario).toFixed(2));
      await connection.query(
        `
          INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `,
        [pedidoId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await connection.commit();
    return pedidoId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
 * Actualizar estado de validación de pago
 */
export async function updatePaymentValidation(id, estado) {
  const validStates = ['pendiente', 'aprobado', 'rechazado'];
  if (!validStates.includes(estado)) {
    throw new Error(`Estado de validación inválido: ${estado}`);
  }

  const sql = 'UPDATE pedidos SET estado_validacion_pago = ?, actualizado_en = NOW() WHERE id = ?';

  try {
    await query(sql, [estado, id]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando validación de pago: ${error.message}`);
  }
}

/**
 * Obtener pedido con información de pago
 */
export async function getOrderWithPaymentInfo(id) {
  const sql = `
    SELECT
      p.*,
      r.nombre as restaurante_nombre,
      r.telefono as restaurante_telefono,
      u.nombre as cliente_nombre,
      u.email as cliente_email,
      u.telefono as cliente_telefono,
      cp.url_imagen as comprobante_url,
      cp.estado_validacion as comprobante_estado,
      cp.metodo_pago as comprobante_metodo
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN comprobantes_pago cp ON p.id = cp.pedido_id
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
  PAYMENT_METHODS,
  normalizeOrderItems,
  calculateOrderTotal,
  createOrder,
  createOrderWithItems,
  addOrderItem,
  getOrderById,
  getOrderWithPaymentInfo,
  getOrdersByUser,
  getOrdersByRestaurant,
  updateOrderStatus,
  updatePaymentValidation,
  cancelOrder,
  getOrderStats
};
