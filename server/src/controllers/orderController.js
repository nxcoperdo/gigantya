import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';
import * as CouponModel from '../models/Coupon.js';
import notificationService from '../services/notificationService.js';
import pool from '../config/database.js';

/**
 * Crear nuevo pedido
 */
export async function createOrder(req, res) {
  try {
    const {
      restaurante_id,
      items,
      notas,
      direccion_entrega,
      telefono_contacto,
      coupon_code,
      cupon_codigo,
      cupon_descuento,
      // Si el carrito tiene productos de varios locales, el cupón tiene
      // que ser GLOBAL (uno de local no podría aplicarse a un carrito
      // multi-local). El frontend envía este flag para que la validación
      // sepa buscar solamente en el pool de cupones globales.
      es_carrito_multi_local,
      metodo_pago,
      costo_envio,
      total: totalFromFrontend,
      barrio_id,
      // Campos opcionales de Google Maps (Places Autocomplete del cliente)
      latitud,
      longitud,
      direccion_formateada,
      place_id,
    } = req.body;

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
        error: 'Local no encontrado'
      });
    }

    // Determinar la modalidad del pedido a partir del flag del local.
    // - ofrece_domicilio = 1 → envío a domicilio (como hasta hoy)
    // - ofrece_domicilio = 0 → retiro en mostrador (no se requiere dirección
    //   de envío). El frontend muestra un banner informativo cuando el
    //   cliente entra al checkout con un carrito de este tipo de local;
    //   el modelo `createOrderWithItems` se encarga de forzar nulls en
    //   dirección/barrio/sector y costo_envio=0.
    const ofreceDomicilio = restaurante.ofrece_domicilio === undefined
      ? true
      : Boolean(Number(restaurante.ofrece_domicilio));
    const esRetiroLocal = !ofreceDomicilio;

    // Validar método de pago
    const validPaymentMethods = ['contra_entrega', 'nequi', 'daviplata', 'bre_b'];
    const paymentMethod = metodo_pago || 'contra_entrega';
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Método de pago no válido. Use: contra_entrega, nequi, daviplata, bre_b'
      });
    }

    // Validar cupón si se proporciona (acepta coupon_code o cupon_codigo)
    let couponId = null;
    const codigoCupon = (cupon_codigo && cupon_codigo.trim()) || (coupon_code && coupon_code.trim());
    if (codigoCupon) {
      try {
        const normalizedItems = OrderModel.normalizeOrderItems(items);
        const productIds = normalizedItems.map(i => i.producto_id);
        const [products] = await pool.query('SELECT precio FROM productos WHERE id IN (?)', [productIds]);

        const subtotal = normalizedItems.reduce((sum, item) => {
          const p = products.find(prod => prod.id === item.producto_id);
          return sum + (p ? p.precio * item.cantidad : 0);
        }, 0);

        const coupon = await CouponModel.validateCoupon(
          codigoCupon,
          restaurante_id,
          subtotal,
          {
            es_carrito_multi_local: es_carrito_multi_local === true
              || es_carrito_multi_local === 1
              || es_carrito_multi_local === '1'
              || es_carrito_multi_local === 'true',
          }
        );
        couponId = coupon.id;

        // Validar que el descuento aplicado sea correcto
        let descuentoEsperado = 0;
        if (coupon.tipo_descuento === 'porcentaje') {
          descuentoEsperado = (subtotal * coupon.descuento) / 100;
        } else {
          descuentoEsperado = coupon.descuento;
        }

        // Si el frontend envía cupon_descuento, validar que coincida
        if (cupon_descuento !== undefined && Math.abs(cupon_descuento - descuentoEsperado) > 0.01) {
          return res.status(400).json({ error: 'El descuento del cupón no coincide con el valor esperado' });
        }
      } catch (couponError) {
        return res.status(400).json({ error: couponError.message });
      }
    }

    // Crear pedido de forma transaccional. El total y los precios se recalculan desde la BD.
    // Si el frontend envió un total válido, lo usamos; sino, recalculamos desde la BD.
    const pedidoId = await OrderModel.createOrderWithItems({
      usuario_id: req.user.id,
      restaurante_id,
      items,
      notas,
      direccion_entrega,
      telefono_contacto,
      coupon_id: couponId,
      metodo_pago: paymentMethod,
      costo_envio: costo_envio || 0,
      barrio_id: barrio_id || null,
      // Campos opcionales de Google Maps — si vienen, el modelo intentará geocoding
      // para resolver el sector por punto geográfico.
      latitud: latitud ?? null,
      longitud: longitud ?? null,
      direccion_formateada: direccion_formateada ?? null,
      place_id: place_id ?? null,
      // Modalidad del pedido: si el local es solo retiro, el modelo ignora
      // dirección/barrio/sector y fuerza costo_envio=0 aunque el body los traiga.
      esRetiroLocal,
      total: (typeof totalFromFrontend === 'number' && totalFromFrontend > 0) ? totalFromFrontend : null
    });

    // Registrar uso del cupón si se aplicó
    if (couponId) {
      await CouponModel.recordCouponUsage(couponId);
    }

    const pedido = await OrderModel.getOrderById(pedidoId);

    // Notificar al restaurante (interna y externa)
    try {
      const restauranteData = await RestaurantModel.getRestaurantById(restaurante_id);
      if (restauranteData && restauranteData.usuario_id) {
        // Notificación interna
        await NotificationModel.createNotification({
          usuario_id: restauranteData.usuario_id,
          tipo: 'pedido',
          titulo: 'Nuevo Pedido Recibido',
          mensaje: `Has recibido un nuevo pedido #${pedidoId}`,
          data: { pedido_id: pedidoId }
        });

        // Notificación externa (email) - obtenemos el email del usuario del restaurante
        const restauranteUsuario = await RestaurantModel.getRestaurantUser(restaurante_id);
        if (restauranteUsuario?.email) {
          notificationService.notifyNewOrder({
            pedido,
            restauranteEmail: restauranteUsuario.email,
            clienteEmail: req.user.email
          }).catch(err => console.error('Error enviando email de nuevo pedido:', err));
        }
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
        error: 'Solo locales pueden ver sus pedidos'
      });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante) {
      return res.status(404).json({
        error: 'No tienes un local asociado'
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

    // Notificar al cliente (interna y externa)
    try {
      const pedidoActualizado = await OrderModel.getOrderById(id);

      // La modalidad del pedido (envío vs. retiro en mostrador) está
      // persistida en `pedidos.es_retiro_local` al momento de crear el
      // pedido. Usamos esa columna en lugar de consultar el flag actual
      // del local: si el local cambió a ofrecer domicilios después de
      // tomar un pedido de retiro, el cliente aún así debe recibir la
      // notificación de "Listo para retirar" (la modalidad no cambia
      // retroactivamente).
      const esRetiroLocalNotif = Boolean(Number(pedidoActualizado.es_retiro_local));

      // Si el pedido es de retiro y el estado es "Listo", también
      // incluimos el nombre del local en el mensaje (lo necesitamos
      // tanto para la notificación interna como para el email).
      const restauranteNotif = esRetiroLocalNotif
        ? await RestaurantModel.getRestaurantById(pedidoActualizado.restaurante_id)
        : null;

      // Notificación interna (base de datos)
      // Si es retiro y el estado es "Listo", customizamos el mensaje y el
      // título para que el cliente entienda que tiene que ir a buscar el
      // pedido al local (no que lo van a enviar).
      const esNotifRetiroListo = esRetiroLocalNotif && matchedState === 'Listo';
      const notifTitulo = esNotifRetiroListo
        ? '🛍️ ¡Tu pedido está listo para retirar!'
        : 'Actualización de Pedido';
      const notifMensaje = esNotifRetiroListo
        ? `Tu pedido #${id} ya está listo en ${restauranteNotif?.nombre || 'el local'}. Pasá a retirarlo por el mostrador.`
        : `Tu pedido #${id} ahora está en estado: ${matchedState}`;

      await NotificationModel.createNotification({
        usuario_id: pedidoActualizado.usuario_id,
        tipo: 'pedido',
        titulo: notifTitulo,
        mensaje: notifMensaje,
        data: { pedido_id: id, estado: matchedState, es_retiro_local: esRetiroLocalNotif }
      });

      // Notificación externa (email/SMS) - solo para ciertos estados
      const estadosConNotificacion = ['Preparando', 'Listo', 'Entregado'];
      if (estadosConNotificacion.includes(matchedState)) {
        // Obtener datos completos para la notificación
        const cliente = await RestaurantModel.getUserById(pedidoActualizado.usuario_id);

        // Reusamos restauranteNotif si ya lo consultamos arriba; si no,
        // lo consultamos ahora. Esto evita una query extra en el caso
        // común (Listo + retiro).
        const restauranteData = restauranteNotif
          || await RestaurantModel.getRestaurantById(pedidoActualizado.restaurante_id);

        const pedidoParaNotificar = {
          ...pedidoActualizado,
          cliente_email: cliente?.email,
          cliente_telefono: cliente?.telefono,
          cliente_nombre: cliente?.nombre,
          restaurante_email: restauranteData?.usuario_email,
          restaurante_nombre: restauranteData?.nombre,
          // Flag que usa notificationService para elegir el template
          // "orderReadyPickup" cuando aplica (Listo + retiro en mostrador).
          esRetiroLocal: esRetiroLocalNotif
        };

        notificationService.notifyOrderStatusChange({
          pedido: pedidoParaNotificar,
          nuevoEstado: matchedState,
          notifyCustomer: true
        }).catch(err => console.error('Error enviando notificación externa:', err));
      }
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
    const { motivo } = req.body;

    const pedido = await OrderModel.getOrderById(id);

    if (!pedido) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado' 
      });
    }

    // Validar permisos de cancelación
    let canCancel = false;
    if (req.user.tipo_usuario === 'admin') {
      canCancel = true;
    } else if (req.user.tipo_usuario === 'cliente' && pedido.usuario_id === req.user.id) {
      canCancel = true;
    } else if (req.user.tipo_usuario === 'restaurante') {
      const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
      if (restaurante && restaurante.id === pedido.restaurante_id) {
        canCancel = true;
      }
    }

    if (!canCancel) {
      return res.status(403).json({
        error: 'No tienes permiso para cancelar este pedido'
      });
    }

    // Obligatorio dar motivo para la cancelación
    if (!motivo || motivo.trim().length < 3) {
      return res.status(400).json({
        error: 'Es obligatorio proporcionar un motivo válido para la cancelación (mínimo 3 caracteres)'
      });
    }

    // Solo se pueden cancelar pedidos que no hayan sido entregados
    if (pedido.estado === OrderModel.ORDER_STATES.ENTREGADO) {
      return res.status(400).json({
        error: 'No se puede cancelar un pedido que ya ha sido entregado'
      });
    }

    await OrderModel.cancelOrder(id, motivo);

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

