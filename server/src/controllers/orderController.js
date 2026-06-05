import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';

/**
 * Crear nuevo pedido
 */
export async function createOrder(req, res) {
  try {
    const { restaurante_id, items, notas, direccion_entrega, telefono_contacto } = req.body;

    // Validar que sea cliente
    if (req.user.tipo_usuario !== 'cliente') {
      return res.status(403).json({ 
        error: 'Solo clientes pueden crear pedidos' 
      });
    }

    // Validaciones
    if (!restaurante_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'restaurante_id e items (array no vacío) son requeridos' 
      });
    }

    // Verificar que el restaurante existe
    const restaurante = await RestaurantModel.getRestaurantById(restaurante_id);
    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    // Crear pedido de forma transaccional. El total y los precios se recalculan desde la BD.
    const pedidoId = await OrderModel.createOrderWithItems({
      usuario_id: req.user.id,
      restaurante_id,
      items,
      notas,
      direccion_entrega,
      telefono_contacto
    });

    const pedido = await OrderModel.getOrderById(pedidoId);

    // Notificar al restaurante
    try {
      const restauranteData = await RestaurantModel.getRestaurantById(restaurante_id);
      if (restauranteData && restauranteData.usuario_id) {
        await NotificationModel.createNotification({
          usuario_id: restauranteData.usuario_id,
          tipo: 'pedido',
          titulo: 'Nuevo Pedido Recibido',
          mensaje: `Has recibido un nuevo pedido #${pedidoId}`,
          data: { pedido_id: pedidoId }
        });
      }
    } catch (notifError) {
      console.error('Error enviando notificación de nuevo pedido:', notifError);
    }

    res.status(201).json({
      mensaje: 'Pedido creado exitosamente',
      pedido
    });
  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(error.statusCode || 500).json({ 
      error: 'Error creando pedido',
      detalles: error.message 
    });
  }
}

/**
 * Obtener detalles del pedido
 */
export async function getOrder(req, res) {
  try {
    const { id } = req.params;

    const pedido = await OrderModel.getOrderById(id);

    if (!pedido) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado' 
      });
    }

    // Validar permiso
    if (req.user.tipo_usuario === 'cliente' && pedido.usuario_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para ver este pedido' 
      });
    }

    if (req.user.tipo_usuario === 'restaurante') {
      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (!restaurante || restaurante.id !== pedido.restaurante_id) {
        return res.status(403).json({ 
          error: 'No tienes permiso para ver este pedido' 
        });
      }
    }

    res.json({
      pedido
    });
  } catch (error) {
    console.error('Error obteniendo pedido:', error);
    res.status(500).json({ 
      error: 'Error obteniendo pedido',
      detalles: error.message 
    });
  }
}

/**
 * Obtener histórico de pedidos del cliente
 */
export async function getClientOrders(req, res) {
    try {
        if (req.user.tipo_usuario !== 'cliente') {
            return res.status(403).json({
                error: 'Solo clientes pueden ver su histórico'
            });
        }

        // 1. Convertimos 'limit' explícitamente a número aquí
        const { estado, limit } = req.query;
        const limitNum = parseInt(limit, 10) || 20;

        // 2. Pasamos el valor numérico limpio
        let pedidos = await OrderModel.getOrdersByUser(req.user.id, limitNum);

        // Filtrar por estado si se especifica
        if (estado) {
            pedidos = pedidos.filter(p => p.estado === estado);
        }

    res.json({
            total: pedidos.length,
            pedidos
        });
    } catch (error) {
        console.error('Error obteniendo pedidos del cliente:', error);
        res.status(500).json({
            error: 'Error obteniendo pedidos',
            detalles: error.message
        });
    }
}

/**
 * Obtener pedidos del restaurante
 */
export async function getRestaurantOrders(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo restaurantes pueden ver sus pedidos' 
      });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'No tienes un restaurante asociado' 
      });
    }

    const { estado } = req.query;

    const pedidos = await OrderModel.getOrdersByRestaurant(restaurante.id, estado);

    res.json({
      total: pedidos.length,
      restaurante_id: restaurante.id,
      pedidos
    });
  } catch (error) {
    console.error('Error obteniendo pedidos del restaurante:', error);
    res.status(500).json({ 
      error: 'Error obteniendo pedidos',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar estado del pedido
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;

    // 1. Validación robusta del cuerpo
    if (!req.body || typeof req.body !== 'object') {
      console.error('SISTEMA: req.body no es un objeto. Recibido:', req.body);
      return res.status(400).json({ error: 'Cuerpo de la petición inválido' });
    }

    const { estado } = req.body;
    if (!estado) {
      console.error('SISTEMA: Falta el campo "estado" en req.body. Recibido:', req.body);
      return res.status(400).json({ error: 'El campo "estado" es requerido' });
    }

    // 2. Normalización flexible del estado (ignora mayúsculas/minúsculas y espacios)
    const cleanEstado = estado.toString().trim();
    const validStates = Object.values(OrderModel.ORDER_STATES);
    const matchedState = validStates.find(
      s => s.toLowerCase() === cleanEstado.toLowerCase()
    );

    if (!matchedState) {
      console.error(`SISTEMA: Estado inválido recibido: "${estado}". Permitidos:`, validStates);
      return res.status(400).json({
        error: `Estado "${estado}" no es válido. Use: ${validStates.join(', ')}`
      });
    }

    // 3. Proceso de actualización
    const pedido = await OrderModel.getOrderById(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Validar permisos
    if (req.user.tipo_usuario === 'restaurante') {
      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (!restaurante || restaurante.id !== pedido.restaurante_id) {
        return res.status(403).json({ error: 'No tienes permiso para cambiar este pedido' });
      }
    } else if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para cambiar el estado' });
    }

    // Usar el estado normalizado (matchedState) para asegurar compatibilidad con la DB
    await OrderModel.updateOrderStatus(id, matchedState);

    // Notificar al cliente
    try {
      const pedidoActualizado = await OrderModel.getOrderById(id);
      await NotificationModel.createNotification({
        usuario_id: pedidoActualizado.usuario_id,
        tipo: 'pedido',
        titulo: 'Actualización de Pedido',
        mensaje: `Tu pedido #${id} ahora está en estado: ${matchedState}`,
        data: { pedido_id: id, estado: matchedState }
      });
    } catch (notifError) {
      console.error('Error en notificación:', notifError);
    }

    const pedidoFinal = await OrderModel.getOrderById(id);
    res.json({
      mensaje: 'Estado del pedido actualizado',
      pedido: pedidoFinal
    });
  } catch (error) {
    console.error('Error crítico en updateOrderStatus:', error);
    res.status(500).json({
      error: 'Error interno del servidor al actualizar pedido',
      detalles: error.message
    });
  }
}

/**
 * Cancelar pedido
 */
export async function cancelOrder(req, res) {
  try {
    const { id } = req.params;

    const pedido = await OrderModel.getOrderById(id);

    if (!pedido) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado' 
      });
    }

    // Solo cliente puede cancelar su propio pedido
    if (pedido.usuario_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para cancelar este pedido' 
      });
    }

    // Solo se pueden cancelar pedidos pendientes
    if (pedido.estado !== OrderModel.ORDER_STATES.PENDIENTE) {
      return res.status(400).json({ 
        error: 'Solo se pueden cancelar pedidos pendientes' 
      });
    }

    await OrderModel.cancelOrder(id);

    // Notificar al restaurante que el pedido fue cancelado
    try {
      const pedido = await OrderModel.getOrderById(id);
      const restauranteData = await RestaurantModel.getRestaurantById(pedido.restaurante_id);
      if (restauranteData && restauranteData.usuario_id) {
        await NotificationModel.createNotification({
          usuario_id: restauranteData.usuario_id,
          tipo: 'pedido',
          titulo: 'Pedido Cancelado',
          mensaje: `El pedido #${id} ha sido cancelado por el cliente`,
          data: { pedido_id: id }
        });
      }
    } catch (notifError) {
      console.error('Error enviando notificación de cancelación:', notifError);
    }

    res.json({
      mensaje: 'Pedido cancelado exitosamente'
    });
  } catch (error) {
    console.error('Error cancelando pedido:', error);
    res.status(500).json({ 
      error: 'Error cancelando pedido',
      detalles: error.message 
    });
  }
}

export default {
  createOrder,
  getOrder,
  getClientOrders,
  getRestaurantOrders,
  updateOrderStatus,
  cancelOrder
};

