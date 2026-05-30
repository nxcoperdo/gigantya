import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Crear nuevo pedido
 */
export async function createOrder(req, res) {
  try {
    const { restaurante_id, items, total, notas, direccion_entrega, telefono_contacto } = req.body;

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

    if (!total || isNaN(total) || total <= 0) {
      return res.status(400).json({ 
        error: 'total debe ser un número positivo' 
      });
    }

    // Verificar que el restaurante existe
    const restaurante = await RestaurantModel.getRestaurantById(restaurante_id);
    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    // Crear pedido
    const pedidoId = await OrderModel.createOrder({
      usuario_id: req.user.id,
      restaurante_id,
      total,
      notas,
      direccion_entrega,
      telefono_contacto
    });

    // Agregar items
    for (const item of items) {
      await OrderModel.addOrderItem(
        pedidoId,
        item.producto_id,
        item.cantidad,
        item.precio_unitario
      );
    }

    const pedido = await OrderModel.getOrderById(pedidoId);

    res.status(201).json({
      mensaje: 'Pedido creado exitosamente',
      pedido
    });
  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ 
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

    const { estado, limit = 20 } = req.query;

    let pedidos = await OrderModel.getOrdersByUser(req.user.id, limit);

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
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ 
        error: 'estado es requerido' 
      });
    }

    // Validar estado
    if (!Object.values(OrderModel.ORDER_STATES).includes(estado)) {
      return res.status(400).json({ 
        error: `Estado inválido. Opciones: ${Object.values(OrderModel.ORDER_STATES).join(', ')}` 
      });
    }

    const pedido = await OrderModel.getOrderById(id);

    if (!pedido) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado' 
      });
    }

    // Validar permiso (solo restaurante owner)
    if (req.user.tipo_usuario === 'restaurante') {
      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (!restaurante || restaurante.id !== pedido.restaurante_id) {
        return res.status(403).json({ 
          error: 'No tienes permiso para cambiar este pedido' 
        });
      }
    } else if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'No tienes permiso para cambiar el estado' 
      });
    }

    await OrderModel.updateOrderStatus(id, estado);

    const pedidoActualizado = await OrderModel.getOrderById(id);

    res.json({
      mensaje: 'Estado del pedido actualizado',
      pedido: pedidoActualizado
    });
  } catch (error) {
    console.error('Error actualizando estado del pedido:', error);
    res.status(500).json({ 
      error: 'Error actualizando pedido',
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

