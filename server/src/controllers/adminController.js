import * as RestaurantModel from '../models/Restaurant.js';
import * as UserModel from '../models/User.js';
import * as NotificationModel from '../models/Notification.js';
import * as SubscriptionModel from '../models/Subscription.js';
import * as PaymentProofModel from '../models/PaymentProof.js';
import * as OrderModel from '../models/Order.js';
import { query, getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { recordAudit } from '../middleware/auditMiddleware.js';
import * as AuditLogModel from '../models/AuditLog.js';

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
        error: 'Local no encontrado'
      });
    }

    await RestaurantModel.approveRestaurant(id);

    await recordAudit(req, 'restaurante.approve', 'restaurante', Number(id), {
      despues: { aprobado: true, nombre: restaurante.nombre },
    });

    res.json({
      mensaje: 'Local aprobado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error aprobando local',
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
        error: 'Local no encontrado'
      });
    }

    await RestaurantModel.rejectRestaurant(id);

    await recordAudit(req, 'restaurante.reject', 'restaurante', Number(id), {
      despues: { aprobado: false, nombre: restaurante.nombre, razon },
    });

    res.json({
      mensaje: 'Local rechazado'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error rechazando local',
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
  let connection;
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { nombre, email, password, tipo_usuario, telefono, documento_identidad, ofrece_domicilio } = req.body;

    if (!nombre || !email || !password || !tipo_usuario) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Verificar si el email ya existe
    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Usar transacción para crear usuario y restaurante atómicamente
    connection = await getConnection();
    await connection.beginTransaction();

    try {
      const userId = await UserModel.createUserWithConnection({
        nombre,
        email,
        contrasena: password,
        tipo_usuario,
        telefono,
        documento_identidad
      }, connection);

      // Si es restaurante, crear también la entrada en la tabla restaurantes
      if (tipo_usuario === 'restaurante') {
        // Default `true` para mantener compatibilidad con la migración previa.
        // El admin puede haber elegido `false` desde el modal si quiere crear
        // un local que solo ofrece retiro en local desde el inicio.
        const ofreceDomicilioInicial = ofrece_domicilio === undefined
          ? true
          : Boolean(ofrece_domicilio);
        await RestaurantModel.createRestaurantWithConnection({
          usuario_id: userId,
          nombre: nombre,
          descripcion: 'Local en configuración',
          direccion: 'Pendiente de configuración',
          telefono: telefono || '',
          horario_apertura: '09:00',
          horario_cierre: '21:00',
          imagen_url: null,
          ciudad: 'Gigante, Huila',
          ofrece_domicilio: ofreceDomicilioInicial,
        }, connection);
        logger.info(`Admin creó restaurante pendiente para usuario ${email} (ofrece_domicilio=${ofreceDomicilioInicial})`);
      }

      await connection.commit();
      logger.info(`Admin creó usuario ${email} con rol ${tipo_usuario}`);

      res.status(201).json({
        mensaje: tipo_usuario === 'restaurante'
          ? 'Usuario y local pendientes creados exitosamente'
          : 'Usuario creado exitosamente',
        userId
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: 'Error creando usuario', detalles: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
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

    // Capturar el estado anterior antes de la mutación para el log.
    const usuarioAnterior = await UserModel.getUserById(id);
    if (!usuarioAnterior) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await query('UPDATE usuarios SET estado = ? WHERE id = ?', [estado, id]);

    // Sincronizar `restaurantes.estado` cuando se reactiva un usuario
    // de tipo restaurante. Esto evita el bug de "login funciona pero el
    // dashboard ve un restaurante inactivo" tras un reject previo.
    if (estado === 'activo') {
      await query(
        `UPDATE restaurantes
           SET estado = 'activo'
         WHERE usuario_id = ?
           AND EXISTS (SELECT 1 FROM usuarios WHERE id = ? AND tipo_usuario = 'restaurante')`,
        [id, id]
      );
    }

    await recordAudit(req, 'user.status_change', 'usuario', Number(id), {
      antes: { estado: usuarioAnterior.estado },
      despues: { estado },
    });

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

    const usuarioAnterior = await UserModel.getUserById(id);
    if (!usuarioAnterior) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await UserModel.updateUser(id, updateData);

    // Solo auditamos cambios de tipo_usuario o estado (los demás campos —
    // nombre, telefono, documento — son cambios menores que pueden ser
    // spam en el log).
    const cambiosImportantes = {};
    if (updateData.tipo_usuario && updateData.tipo_usuario !== usuarioAnterior.tipo_usuario) {
      cambiosImportantes.tipo_usuario = { antes: usuarioAnterior.tipo_usuario, despues: updateData.tipo_usuario };
    }
    if (updateData.estado && updateData.estado !== usuarioAnterior.estado) {
      cambiosImportantes.estado = { antes: usuarioAnterior.estado, despues: updateData.estado };
    }
    if (Object.keys(cambiosImportantes).length > 0) {
      await recordAudit(req, 'user.update', 'usuario', Number(id), {
        antes: { tipo_usuario: usuarioAnterior.tipo_usuario, estado: usuarioAnterior.estado },
        despues: cambiosImportantes,
      });
    }

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

    // Capturar el usuario ANTES de borrar para que el log tenga contexto.
    const usuario = await UserModel.getUserById(id);

    await query('DELETE FROM usuarios WHERE id = ?', [id]);

    await recordAudit(req, 'user.delete', 'usuario', Number(id), {
      antes: usuario ? { nombre: usuario.nombre, email: usuario.email, tipo_usuario: usuario.tipo_usuario } : null,
    });

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
      return res.status(404).json({ error: 'Local no encontrado' });
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

    await recordAudit(req, 'plan.change', 'restaurante', Number(id), {
      antes: { plan: restaurante.plan },
      despues: {
        plan,
        fecha_vencimiento: plan === 'basico' ? null : fecha_vencimiento,
        monto_pagado,
      },
    });

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
 * Actualizar configuración de impuestos y envíos de un restaurante
 */
export async function updateRestaurantConfig(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden configurar impuestos y envíos' });
    }

    const { id } = req.params;
    const { configuracion_impuestos, configuracion_envios } = req.body;

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    const updateData = {};

    if (configuracion_impuestos !== undefined) {
      // Validar configuración de impuestos
      const { activo, porcentaje } = configuracion_impuestos;
      if (typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
      }
      if (typeof porcentaje !== 'number' || porcentaje < 0 || porcentaje > 100) {
        return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });
      }
      updateData.configuracion_impuestos = JSON.stringify({ activo, porcentaje });
    }

    if (configuracion_envios !== undefined) {
      // Validar configuración de envíos
      const { activo, costo_fijo, envio_gratis_activo, envio_gratis_desde } = configuracion_envios;
      if (typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
      }
      if (typeof costo_fijo !== 'number' || costo_fijo < 0) {
        return res.status(400).json({ error: 'El costo fijo debe ser un número positivo' });
      }
      if (typeof envio_gratis_activo !== 'boolean') {
        return res.status(400).json({ error: 'El campo "envio_gratis_activo" debe ser booleano' });
      }
      if (typeof envio_gratis_desde !== 'number' || envio_gratis_desde < 0) {
        return res.status(400).json({ error: 'El monto para envío gratis debe ser un número positivo' });
      }
      updateData.configuracion_envios = JSON.stringify({ activo, costo_fijo, envio_gratis_activo, envio_gratis_desde });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
    }

    await RestaurantModel.updateRestaurant(id, updateData);

    logger.info(`Admin ${req.user.id} actualizó configuración de impuestos/envíos del restaurante ${id}`);

    // Obtener configuración actualizada
    const restauranteActualizado = await RestaurantModel.getRestaurantById(id);

    res.json({
      mensaje: 'Configuración de impuestos y envíos actualizada exitosamente',
      configuracion_impuestos: restauranteActualizado.configuracion_impuestos,
      configuracion_envios: restauranteActualizado.configuracion_envios
    });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando configuración', detalles: error.message });
  }
}

/**
 * Cambiar la modalidad de un restaurante entre "ofrece domicilio" y "solo
 * retiro en local". Endpoint dedicado (en vez de un genérico PUT) para
 * mantener consistencia con /plan y /config y para registrar el cambio en
 * logs.
 */
export async function updateRestaurantDomicilio(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar la modalidad' });
    }

    const { id } = req.params;
    const { ofrece_domicilio } = req.body;

    if (ofrece_domicilio === undefined || ofrece_domicilio === null) {
      return res.status(400).json({ error: 'El campo "ofrece_domicilio" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(ofrece_domicilio);

    await RestaurantModel.updateRestaurant(id, { ofrece_domicilio: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { ofrece_domicilio: Boolean(restaurante.ofrece_domicilio) },
      despues: { ofrece_domicilio: nuevoValor, campo: 'ofrece_domicilio' },
    });

    logger.info(`Admin ${req.user.id} cambió modalidad del restaurante ${id} a ofrece_domicilio=${nuevoValor}`);

    res.json({
      mensaje: 'Modalidad de servicio actualizada',
      restaurante_id: id,
      ofrece_domicilio: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando modalidad:', error);
    res.status(500).json({ error: 'Error actualizando modalidad', detalles: error.message });
  }
}

/**
 * Cambiar el flag "Ofrece consumo en el local" de un restaurante desde
 * el dashboard admin. Cuando está activo, el cliente puede elegir la
 * modalidad "Consumo en el local" (comer en la mesa) en el checkout.
 *
 * Réplica de `updateRestaurantDomicilio` para mantener consistencia
 * con el resto de los endpoints dedicados. Mismo patrón de validación
 * y logging.
 */
export async function updateRestaurantConsumoEnLocal(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar esta modalidad' });
    }

    const { id } = req.params;
    const { ofrece_consumo_en_local } = req.body;

    if (ofrece_consumo_en_local === undefined || ofrece_consumo_en_local === null) {
      return res.status(400).json({ error: 'El campo "ofrece_consumo_en_local" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(ofrece_consumo_en_local);

    await RestaurantModel.updateRestaurant(id, { ofrece_consumo_en_local: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { ofrece_consumo_en_local: Boolean(restaurante.ofrece_consumo_en_local) },
      despues: { ofrece_consumo_en_local: nuevoValor, campo: 'ofrece_consumo_en_local' },
    });

    logger.info(`Admin ${req.user.id} cambió modalidad del restaurante ${id} a ofrece_consumo_en_local=${nuevoValor}`);

    res.json({
      mensaje: 'Modalidad de consumo en el local actualizada',
      restaurante_id: id,
      ofrece_consumo_en_local: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando modalidad de consumo en local:', error);
    res.status(500).json({ error: 'Error actualizando modalidad', detalles: error.message });
  }
}

/**
 * Cambiar el flag "Mercado y abarrotes" de un restaurante desde el dashboard
 * admin. Endpoint dedicado (en vez de un genérico PUT) para mantener
 * consistencia con /ofrece-domicilio, /plan y /config y para registrar el
 * cambio en logs.
 */
export async function updateRestaurantEsMercado(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar el tipo de negocio' });
    }

    const { id } = req.params;
    const { es_mercado_abarrotes } = req.body;

    if (es_mercado_abarrotes === undefined || es_mercado_abarrotes === null) {
      return res.status(400).json({ error: 'El campo "es_mercado_abarrotes" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(es_mercado_abarrotes);

    await RestaurantModel.updateRestaurant(id, { es_mercado_abarrotes: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { es_mercado_abarrotes: Boolean(restaurante.es_mercado_abarrotes) },
      despues: { es_mercado_abarrotes: nuevoValor, campo: 'es_mercado_abarrotes' },
    });

    logger.info(`Admin ${req.user.id} cambió tipo de negocio del restaurante ${id} a es_mercado_abarrotes=${nuevoValor}`);

    res.json({
      mensaje: 'Tipo de negocio actualizado',
      restaurante_id: id,
      es_mercado_abarrotes: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando tipo de negocio:', error);
    res.status(500).json({ error: 'Error actualizando tipo de negocio', detalles: error.message });
  }
}

/**
 * Cambiar el flag "Comida rápida" de un restaurante desde el dashboard
 * admin. Réplica de `updateRestaurantEsMercado` para mantener consistencia
 * con /ofrece-domicilio, /plan y /config. Mismo patrón de validación,
 * logging y respuesta.
 */
export async function updateRestaurantEsComidaRapida(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar el tipo de negocio' });
    }

    const { id } = req.params;
    const { es_comida_rapida } = req.body;

    if (es_comida_rapida === undefined || es_comida_rapida === null) {
      return res.status(400).json({ error: 'El campo "es_comida_rapida" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(es_comida_rapida);

    await RestaurantModel.updateRestaurant(id, { es_comida_rapida: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { es_comida_rapida: Boolean(restaurante.es_comida_rapida) },
      despues: { es_comida_rapida: nuevoValor, campo: 'es_comida_rapida' },
    });

    logger.info(`Admin ${req.user.id} cambió tipo de negocio del restaurante ${id} a es_comida_rapida=${nuevoValor}`);

    res.json({
      mensaje: 'Tipo de negocio actualizado',
      restaurante_id: id,
      es_comida_rapida: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando tipo de negocio:', error);
    res.status(500).json({ error: 'Error actualizando tipo de negocio', detalles: error.message });
  }
}

/**
 * Cambiar el flag "Es restaurante" de un restaurante desde el dashboard
 * admin. Réplica de `updateRestaurantEsMercado` / `updateRestaurantEsComidaRapida`
 * para mantener consistencia con /ofrece-domicilio, /plan y /config. Mismo
 * patrón de validación, logging y respuesta.
 *
 * El flag `es_restaurante` (migración
 * 20260702000001_add_es_restaurante_to_restaurantes.js) hace explícito el
 * nicho restaurante. Combinado con `es_comida_rapida` permite combos
 * (1,1) → el local aparece tanto en el feed "Restaurantes" como en
 * "Comida rápida".
 */
export async function updateRestaurantEsRestaurante(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar el tipo de negocio' });
    }

    const { id } = req.params;
    const { es_restaurante } = req.body;

    if (es_restaurante === undefined || es_restaurante === null) {
      return res.status(400).json({ error: 'El campo "es_restaurante" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(es_restaurante);

    await RestaurantModel.updateRestaurant(id, { es_restaurante: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { es_restaurante: Boolean(restaurante.es_restaurante) },
      despues: { es_restaurante: nuevoValor, campo: 'es_restaurante' },
    });

    logger.info(`Admin ${req.user.id} cambió tipo de negocio del restaurante ${id} a es_restaurante=${nuevoValor}`);

    res.json({
      mensaje: 'Tipo de negocio actualizado',
      restaurante_id: id,
      es_restaurante: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando tipo de negocio:', error);
    res.status(500).json({ error: 'Error actualizando tipo de negocio', detalles: error.message });
  }
}

/**
 * Cambiar el flag "Es panadería/pastelería" de un restaurante desde el
 * dashboard admin. Réplica de `updateRestaurantEsComidaRapida` para
 * mantener consistencia con /ofrece-domicilio, /plan y /config. Mismo
 * patrón de validación, logging y respuesta.
 *
 * El flag `es_panaderia_pasteleria` (migración
 * 20260703000001_add_panaderia_pasteleria_nicho.js) identifica a las
 * panaderías y pastelerías. Es combinable con `es_restaurante` y
 * `es_comida_rapida` (un local puede ser restaurante + panadería, o
 * comida rápida + panadería) y mutuamente excluyente con
 * `es_mercado_abarrotes` (mercado es nicho único). Esta exclusión NO
 * se enforce a nivel DB — se valida en la UI admin al activar el toggle.
 */
export async function updateRestaurantEsPanaderiaPasteleria(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar el tipo de negocio' });
    }

    const { id } = req.params;
    const { es_panaderia_pasteleria } = req.body;

    if (es_panaderia_pasteleria === undefined || es_panaderia_pasteleria === null) {
      return res.status(400).json({ error: 'El campo "es_panaderia_pasteleria" es requerido' });
    }

    const restaurante = await RestaurantModel.getRestaurantById(id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Normalizar a boolean — aceptar 1/0, 'true'/'false', true/false.
    const nuevoValor = Boolean(es_panaderia_pasteleria);

    await RestaurantModel.updateRestaurant(id, { es_panaderia_pasteleria: nuevoValor });

    await recordAudit(req, 'modalidad.toggle', 'restaurante', Number(id), {
      antes: { es_panaderia_pasteleria: Boolean(restaurante.es_panaderia_pasteleria) },
      despues: { es_panaderia_pasteleria: nuevoValor, campo: 'es_panaderia_pasteleria' },
    });

    logger.info(`Admin ${req.user.id} cambió tipo de negocio del restaurante ${id} a es_panaderia_pasteleria=${nuevoValor}`);

    res.json({
      mensaje: 'Tipo de negocio actualizado',
      restaurante_id: id,
      es_panaderia_pasteleria: nuevoValor,
    });
  } catch (error) {
    console.error('Error actualizando tipo de negocio:', error);
    res.status(500).json({ error: 'Error actualizando tipo de negocio', detalles: error.message });
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

/**
 * Listar usuarios online (con actividad en los últimos N minutos).
 * La marca `ultima_actividad` se actualiza de forma asíncrona en el
 * middleware `verifyToken`, así que esta función solo LEE. El query param
 * `minutos` se clampea entre 1 y 60 para evitar valores absurdos.
 */
export async function getOnlineUsers(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver esto' });
    }

    const ventanaMin = Math.max(1, Math.min(60, parseInt(req.query.minutos, 10) || 5));
    const usuarios = await UserModel.getOnlineUsers(ventanaMin);

    res.json({
      ventana_minutos: ventanaMin,
      total: usuarios.length,
      usuarios: usuarios.map(u => ({
        ...u,
        // Number() para que `hace_segundos` viaje como number en JSON
        // (MySQL lo devuelve como string por ser BIGINT derivado de TIMESTAMPDIFF)
        hace_segundos: Number(u.hace_segundos) || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error listando usuarios online', detalles: error.message });
  }
}

/**
 * Detalle completo de un usuario para el modal de detalle del admin.
 *
 * Enriquece el `getUserProfile` con:
 *  - Si es restaurante, conteo de pedidos del local.
 *  - Conteo de pedidos como cliente.
 *  - `ultima_actividad` (que `getUserById` no incluye).
 */
export async function getUserByIdAdmin(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { id } = req.params;
    const usuario = await UserModel.getUserProfile(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Conteo de pedidos como cliente.
    const pedidosClienteRow = await query(
      'SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ?',
      [id]
    );
    usuario.pedidos_count = pedidosClienteRow[0]?.total || 0;

    // Si es restaurante, conteo de pedidos del local.
    if (usuario.tipo_usuario === 'restaurante' && usuario.restaurante) {
      const pedidosRestRow = await query(
        'SELECT COUNT(*) AS total FROM pedidos WHERE restaurante_id = ?',
        [usuario.restaurante.id]
      );
      usuario.restaurante.pedidos_count = pedidosRestRow[0]?.total || 0;
    }

    // Última actividad explícita (getUserById no la devuelve).
    const lastRow = await query(
      'SELECT ultima_actividad FROM usuarios WHERE id = ?',
      [id]
    );
    usuario.ultima_actividad = lastRow[0]?.ultima_actividad || null;

    res.json({ usuario });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuario', detalles: error.message });
  }
}

/**
 * Pedidos de un usuario (cliente) o de un restaurante. Usado por el
 * tab "Pedidos" del modal de detalle.
 *
 * Query params:
 *  - `rol` (opcional): 'cliente' (default) o 'restaurante' para saber
 *    qué FK usar.
 *  - `limit` (opcional, default 50).
 */
export async function getUserOrdersAdmin(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { id } = req.params;
    const { rol = 'cliente', limit = 50 } = req.query;
    const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

    let sql;
    let params;
    if (rol === 'restaurante') {
      sql = `
        SELECT p.*, u.nombre AS cliente, r.nombre AS restaurante
          FROM pedidos p
          LEFT JOIN usuarios u ON p.usuario_id = u.id
          INNER JOIN restaurantes r ON p.restaurante_id = r.id
         WHERE r.usuario_id = ?
         ORDER BY p.creado_en DESC
         LIMIT ?`;
      params = [id, lim];
    } else {
      sql = `
        SELECT p.*, u.nombre AS cliente, r.nombre AS restaurante
          FROM pedidos p
          LEFT JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN restaurantes r ON p.restaurante_id = r.id
         WHERE p.usuario_id = ?
         ORDER BY p.creado_en DESC
         LIMIT ?`;
      params = [id, lim];
    }

    const pedidos = await query(sql, params);
    res.json({ total: pedidos.length, pedidos });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo pedidos del usuario', detalles: error.message });
  }
}

/**
 * Comprobantes de pago de TODA la plataforma (no filtrados por restaurante).
 * Usado por la pestaña "Comprobantes" del admin.
 *
 * Query params:
 *  - `estado`: 'pendiente' | 'aprobado' | 'rechazado'
 *  - `restaurante_id`
 *  - `cliente_id` (filtra por usuario_id del pedido)
 *  - `metodo_pago`: 'nequi' | 'daviplata' | 'bre_b' | 'contra_entrega'
 *  - `desde`, `hasta` (ISO date)
 *  - `limit` (default 100), `offset` (default 0)
 */
export async function getAllPaymentProofsAdmin(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const {
      estado,
      restaurante_id,
      cliente_id,
      metodo_pago,
      desde,
      hasta,
      limit = 100,
      offset = 0,
    } = req.query;

    const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    let sql = `
      SELECT
        cp.*,
        p.total AS pedido_total,
        p.estado AS pedido_estado,
        p.restaurante_id,
        p.usuario_id AS cliente_id,
        u.nombre AS cliente_nombre,
        u.telefono AS cliente_telefono,
        r.nombre AS restaurante_nombre,
        vu.nombre AS validado_por_nombre
      FROM comprobantes_pago cp
      INNER JOIN pedidos p ON cp.pedido_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN usuarios vu ON cp.validado_por = vu.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      sql += ' AND cp.estado_validacion = ?';
      params.push(estado);
    }
    if (restaurante_id) {
      sql += ' AND p.restaurante_id = ?';
      params.push(restaurante_id);
    }
    if (cliente_id) {
      sql += ' AND p.usuario_id = ?';
      params.push(cliente_id);
    }
    if (metodo_pago) {
      sql += ' AND cp.metodo_pago = ?';
      params.push(metodo_pago);
    }
    if (desde) {
      sql += ' AND cp.fecha_subida >= ?';
      params.push(desde);
    }
    if (hasta) {
      sql += ' AND cp.fecha_subida <= ?';
      params.push(hasta);
    }

    sql += ' ORDER BY cp.fecha_subida DESC LIMIT ? OFFSET ?';
    params.push(lim, off);

    const comprobantes = await query(sql, params);
    res.json({ total: comprobantes.length, comprobantes });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo comprobantes', detalles: error.message });
  }
}

/**
 * Aprobar un comprobante de pago desde el panel admin.
 * El admin puede aprobar comprobantes de cualquier local (no solo del suyo).
 */
export async function approvePaymentProofAdmin(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { id } = req.params;
    const proof = await PaymentProofModel.getProofById(id);
    if (!proof) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    await PaymentProofModel.updateProofStatus(id, 'aprobado', req.user.id, null);
    await OrderModel.updatePaymentValidation(proof.pedido_id, 'aprobado');

    await recordAudit(req, 'comprobante.approve', 'comprobante', Number(id), {
      antes: { estado_validacion: proof.estado_validacion },
      despues: { estado_validacion: 'aprobado', pedido_id: proof.pedido_id },
    });

    res.json({ mensaje: 'Comprobante aprobado por admin' });
  } catch (error) {
    res.status(500).json({ error: 'Error aprobando comprobante', detalles: error.message });
  }
}

/**
 * Rechazar un comprobante de pago desde el panel admin.
 * Body: { motivo_rechazo: string }.
 */
export async function rejectPaymentProofAdmin(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { id } = req.params;
    const { motivo_rechazo } = req.body;
    if (!motivo_rechazo || !String(motivo_rechazo).trim()) {
      return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
    }

    const proof = await PaymentProofModel.getProofById(id);
    if (!proof) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    await PaymentProofModel.updateProofStatus(id, 'rechazado', req.user.id, motivo_rechazo);
    await OrderModel.updatePaymentValidation(proof.pedido_id, 'rechazado');

    await recordAudit(req, 'comprobante.reject', 'comprobante', Number(id), {
      antes: { estado_validacion: proof.estado_validacion },
      despues: { estado_validacion: 'rechazado', motivo_rechazo, pedido_id: proof.pedido_id },
    });

    res.json({ mensaje: 'Comprobante rechazado por admin' });
  } catch (error) {
    res.status(500).json({ error: 'Error rechazando comprobante', detalles: error.message });
  }
}

/**
 * Listar logs de auditoría con filtros y paginación. Usado por el
 * tab "Auditoría" del panel admin.
 *
 * Query params (todos opcionales): admin_id, accion, entidad_tipo,
 * entidad_id, desde, hasta, limit (default 100), offset (default 0).
 */
export async function getAuditLogs(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const filtros = {
      admin_id: req.query.admin_id || undefined,
      accion: req.query.accion || undefined,
      entidad_tipo: req.query.entidad_tipo || undefined,
      entidad_id: req.query.entidad_id || undefined,
      desde: req.query.desde || undefined,
      hasta: req.query.hasta || undefined,
      limit: Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 100)),
      offset: Math.max(0, parseInt(req.query.offset, 10) || 0),
    };

    const resultado = await AuditLogModel.getLogs(filtros);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo logs de auditoría', detalles: error.message });
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
  updateRestaurantConfig,
  updateRestaurantDomicilio,
  updateRestaurantConsumoEnLocal,
  updateRestaurantEsMercado,
  updateRestaurantEsComidaRapida,
  updateRestaurantEsRestaurante,
  updateRestaurantEsPanaderiaPasteleria,
  getOnlineUsers,
  getUserByIdAdmin,
  getUserOrdersAdmin,
  getAllPaymentProofsAdmin,
  approvePaymentProofAdmin,
  rejectPaymentProofAdmin,
  getAuditLogs,
};
