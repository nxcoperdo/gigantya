import * as RestaurantModel from '../models/Restaurant.js';
import * as UserModel from '../models/User.js';
import * as NotificationModel from '../models/Notification.js';
import * as SubscriptionModel from '../models/Subscription.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Obtener todos los restaurantes (pendientes de aprobación y aprobados)
 */
export async function getAllRestaurants(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden ver esto'
      });
    }

    const sql = 'SELECT * FROM restaurantes ORDER BY creado_en DESC';
    const restaurantes = await query(sql);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo restaurantes',
      detalles: error.message
    });
  }
}

/**
 * Obtener restaurantes pendientes de aprobación
 */
export async function getPendingRestaurants(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden ver esto'
      });
    }

    const sql = 'SELECT * FROM restaurantes WHERE aprobado = 0 AND estado = "activo" ORDER BY creado_en DESC';
    const restaurantes = await query(sql);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo restaurantes pendientes',
      detalles: error.message
    });
  }
}

/**
 * Aprobar restaurante
 */
export async function approveRestaurant(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden aprobar'
      });
    }

    const { id } = req.params;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({
        error: 'Restaurante no encontrado'
      });
    }

    await RestaurantModel.approveRestaurant(id);

    res.json({
      mensaje: 'Restaurante aprobado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error aprobando restaurante',
      detalles: error.message
    });
  }
}

/**
 * Rechazar restaurante
 */
export async function rejectRestaurant(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden rechazar'
      });
    }

    const { id } = req.params;
    const { razon = '' } = req.body;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({
        error: 'Restaurante no encontrado'
      });
    }

    await RestaurantModel.rejectRestaurant(id);

    res.json({
      mensaje: 'Restaurante rechazado'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error rechazando restaurante',
      detalles: error.message
    });
  }
}

/**
 * Obtener estadísticas generales
 */
export async function getStats(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden ver esto'
      });
    }

    const usuarios = await query('SELECT COUNT(*) as total FROM usuarios WHERE estado = "activo"');
    const restaurantes = await query('SELECT COUNT(*) as total FROM restaurantes WHERE aprobado = 1 AND estado = "activo"');
    const pedidos = await query('SELECT COUNT(*) as total FROM pedidos');
    const ingresos = await query('SELECT SUM(total) as total FROM pedidos WHERE estado = "Entregado"');

    res.json({
      estadisticas: {
        usuarios_totales: usuarios[0]?.total || 0,
        restaurantes_aprobados: restaurantes[0]?.total || 0,
        pedidos_totales: pedidos[0]?.total || 0,
        ingresos_totales: ingresos[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      detalles: error.message
    });
  }
}

/**
 * Crear usuario desde panel admin
 */
export async function adminCreateUser(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { nombre, email, password, tipo_usuario, telefono, documento_identidad } = req.body;

    if (!nombre || !email || !password || !tipo_usuario) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Verificar si el email ya existe
    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const userId = await UserModel.createUser({
      nombre,
      email,
      contrasena: password,
      tipo_usuario,
      telefono,
      documento_identidad
    });

    logger.info(`Admin creó usuario ${email} con rol ${tipo_usuario}`);

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      userId
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creando usuario', detalles: error.message });
  }
}

/**
 * Obtener lista de todos los usuarios
 */
export async function getAllUsers(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const users = await query('SELECT id, nombre, email, tipo_usuario, estado, creado_en FROM usuarios ORDER BY creado_en DESC');
    res.json({ total: users.length, usuarios: users });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuarios', detalles: error.message });
  }
}

/**
 * Cambiar estado de usuario (Activo/Inactivo/Suspendido)
 */
export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['activo', 'inactivo', 'suspendido'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    await query('UPDATE usuarios SET estado = ? WHERE id = ?', [estado, id]);

    logger.info(`Admin cambió estado del usuario ${id} a ${estado}`);
    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando estado', detalles: error.message });
  }
}

/**
 * Actualizar datos de usuario
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
    }

    await UserModel.updateUser(id, updateData);

    logger.info(`Admin actualizó datos del usuario ${id}`);
    res.json({ mensaje: 'Usuario actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando usuario', detalles: error.message });
  }
}

/**
 * Eliminar usuario
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    await query('DELETE FROM usuarios WHERE id = ?', [id]);

    logger.info(`Admin eliminó el usuario ${id}`);
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando usuario', detalles: error.message });
  }
}

/**
 * Obtener todos los pedidos (Vista Admin)
 */
export async function getAllOrders(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const sql = `
      SELECT
        p.*,
        u.nombre as cliente,
        r.nombre as restaurante
      FROM pedidos p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN restaurantes r ON p.restaurante_id = r.id
      ORDER BY p.creado_en DESC
    `;
    const pedidos = await query(sql);

    res.json({
      total: pedidos.length,
      pedidos
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo pedidos', detalles: error.message });
  }
}

/**
 * Actualizar estado de pedido (Vista Admin)
 */
export async function updateOrderStatus(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'El campo "estado" es requerido' });
    }

    await query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, id]);

    logger.info(`Admin actualizó estado del pedido ${id} a ${estado}`);
    res.json({ mensaje: 'Estado del pedido actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando estado del pedido', detalles: error.message });
  }
}

/**
 * Enviar notificación global a todos los usuarios
 */
export async function sendGlobalNotification(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { titulo, mensaje } = req.body;
    if (!titulo || !mensaje) {
      return res.status(400).json({ error: 'Título y mensaje son requeridos' });
    }

    const usuarios = await query('SELECT id FROM usuarios WHERE estado = "activo"');

    const promises = usuarios.map(u =>
      NotificationModel.createNotification({
        usuario_id: u.id,
        tipo: 'global',
        titulo,
        mensaje
      })
    );

    await Promise.all(promises);

    res.json({
      mensaje: `Notificación global enviada a ${usuarios.length} usuarios`
    });
  } catch (error) {
    res.status(500).json({ error: 'Error enviando notificación global', detalles: error.message });
  }
}

/**
 * Obtener analíticas avanzadas
 */
export async function getAdvancedAnalytics(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const topRestaurants = await query(`
      SELECT r.nombre, SUM(p.total) as ingresos, COUNT(p.id) as total_pedidos
      FROM restaurantes r
      JOIN pedidos p ON r.id = p.restaurante_id
      GROUP BY r.id
      ORDER BY ingresos DESC
      LIMIT 5
    `);

    const topProducts = await query(`
      SELECT pr.nombre, r.nombre as restaurante, SUM(ip.cantidad) as cantidad_vendida
      FROM items_pedido ip
      JOIN productos pr ON ip.producto_id = pr.id
      JOIN restaurantes r ON pr.restaurante_id = r.id
      GROUP BY ip.producto_id
      ORDER BY cantidad_vendida DESC
      LIMIT 5
    `);

    const ordersByDay = await query(`
      SELECT DATE(creado_en) as fecha, COUNT(*) as total
      FROM pedidos
      GROUP BY fecha
      ORDER BY fecha DESC
      LIMIT 30
    `);

    res.json({
      analytics: {
        topRestaurants,
        topProducts,
        tendenciaPedidos: ordersByDay
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo analíticas', detalles: error.message });
  }
}

/**
 * Actualizar el plan de suscripción de un restaurante.
 *
 * Body esperado:
 *   {
 *     plan: 'basico' | 'profesional' | 'premium',
 *     fecha_vencimiento?: 'YYYY-MM-DD HH:MM:SS'   // requerido si plan !== 'basico'
 *     monto_pagado?: number,
 *     metodo_pago?: string,
 *     notas?: string
 *   }
 *
 * Efectos:
 *   - Cierra la suscripción activa previa (si existe).
 *   - Crea un nuevo registro en `suscripciones` con estado='activa'.
 *   - Actualiza `restaurantes.plan` y `restaurantes.fecha_vencimiento_plan`.
 *   - Devuelve el historial de planes.
 */
export async function updateRestaurantPlan(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar planes' });
    }

    const { id } = req.params;
    const {
      plan,
      fecha_vencimiento,
      monto_pagado = null,
      metodo_pago = null,
      notas = null,
    } = req.body;

    if (!plan || !['basico', 'profesional', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan no válido. Opciones: basico, profesional, premium' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    // Datos a actualizar en el restaurante
    const restauranteUpdateData = {
      plan,
      fecha_vencimiento_plan: plan === 'basico' ? null : fecha_vencimiento,
    };

    // Si baja de Premium a Profesional o Básico, eliminar el banner
    if (restaurante.plan === 'premium' && plan !== 'premium') {
      restauranteUpdateData.banner_url = null;
    }

    // Plan basico = sin suscripción (no se necesita fecha de vencimiento)
    if (plan === 'basico') {
      await SubscriptionModel.createSubscription({
        restaurante_id: id,
        plan,
        fecha_inicio: new Date(),
        fecha_vencimiento: new Date(), // inmediatamente vencida
        monto_pagado,
        metodo_pago,
        notas: notas || 'Cambio a plan básico',
        creado_por: req.user.id,
      });
      await RestaurantModel.updateRestaurant(id, restauranteUpdateData);
    } else {
      if (!fecha_vencimiento) {
        return res.status(400).json({
          error: 'Para asignar un plan Profesional o Premium se requiere fecha_vencimiento',
        });
      }
      const fechaInicio = new Date();
      const fechaVenc = new Date(fecha_vencimiento);
      if (Number.isNaN(fechaVenc.getTime())) {
        return res.status(400).json({ error: 'fecha_vencimiento no es válida' });
      }
      if (fechaVenc <= fechaInicio) {
        return res.status(400).json({ error: 'fecha_vencimiento debe ser futura' });
      }

      await SubscriptionModel.createSubscription({
        restaurante_id: id,
        plan,
        fecha_inicio: fechaInicio,
        fecha_vencimiento: fechaVenc,
        monto_pagado,
        metodo_pago,
        notas,
        creado_por: req.user.id,
      });
      await RestaurantModel.updateRestaurant(id, restauranteUpdateData);
    }

    logger.info(`Admin ${req.user.id} cambió plan del restaurante ${id} a ${plan}`);

    const historial = await SubscriptionModel.getSubscriptionHistory(id);
    res.json({
      mensaje: 'Plan de suscripción actualizado exitosamente',
      plan,
      fecha_vencimiento_plan: plan === 'basico' ? null : fecha_vencimiento,
      historial,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando plan', detalles: error.message });
  }
}

/**
 * Historial de suscripciones de un restaurante.
 */
export async function getRestaurantSubscriptionHistory(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver historial' });
    }
    const { id } = req.params;
    const historial = await SubscriptionModel.getSubscriptionHistory(id);
    res.json({ restaurante_id: id, total: historial.length, historial });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo historial', detalles: error.message });
  }
}

export default {
  getAllRestaurants,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getStats,
  adminCreateUser,
  getAllUsers,
  updateUserStatus,
  updateUser,
  deleteUser,
  getAllOrders,
  updateOrderStatus,
  sendGlobalNotification,
  getAdvancedAnalytics,
  updateRestaurantPlan,
  getRestaurantSubscriptionHistory,
};
