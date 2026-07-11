import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';
import * as CouponModel from '../models/Coupon.js';
import notificationService from '../services/notificationService.js';
import { createOrderCore, notificarNuevoPedido } from '../services/orderService.js';
import pool from '../config/database.js';

/**
 * Crear nuevo pedido (cliente web).
 *
 * El grueso de la lógica (validar items, snapshot de adiciones, INSERT en
 * transacción) vive en `orderService.createOrderCore`. Acá solo:
 *   1) Validamos que el caller sea un cliente.
 *   2) Resolvemos la modalidad (`es_retiro_local` / `es_consumo_en_local`)
 *      según los flags del local y la elección del cliente.
 *   3) Validamos el cupón (si trae).
 *   4) Llamamos al service con `canal='web'`, `mesa_id=null`, `creado_por=null`.
 *   5) Notificamos al restaurante.
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

    // Determinar la modalidad del pedido.
    // - Si el local NO ofrece domicilio (ofrece_domicilio=0), se fuerza
    //   retiro en mostrador. El cliente no tiene opción: el local no hace
    //   envíos, así que el pedido se retira sí o sí.
    // - Si el local SÍ ofrece domicilio (ofrece_domicilio=1), el cliente
    //   puede elegir entre envío a domicilio y retiro en mostrador desde
    //   el checkout. Respetamos lo que el frontend mandó en `es_retiro_local`.
    //   Default: false (envío) si el frontend no lo envía.
    const ofreceDomicilio = restaurante.ofrece_domicilio === undefined
      ? true
      : Boolean(Number(restaurante.ofrece_domicilio));
    const esRetiroLocal = !ofreceDomicilio
      || req.body.es_retiro_local === true
      || req.body.es_retiro_local === 1
      || req.body.es_retiro_local === '1'
      || req.body.es_retiro_local === 'true';

    // Modalidad "consumo en el local" (comer en la mesa). El cliente la
    // elige en el checkout, pero el backend solo la respeta si el local
    // la ofrece. Si el local no la tiene activa, se ignora el flag del
    // body aunque el cliente lo mande.
    const ofreceConsumoEnLocal = restaurante.ofrece_consumo_en_local === undefined
      ? false
      : Boolean(Number(restaurante.ofrece_consumo_en_local));
    const esConsumoEnLocal = ofreceConsumoEnLocal
      && !esRetiroLocal  // mutually exclusive: si el local solo retira, el cliente no puede elegir consumo
      && (req.body.es_consumo_en_local === true
        || req.body.es_consumo_en_local === 1
        || req.body.es_consumo_en_local === '1'
        || req.body.es_consumo_en_local === 'true');

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
        // Traemos id y precio de cada producto para calcular el subtotal
        // base. Las adiciones se agregan abajo.
        const [products] = await pool.query(
          'SELECT id, precio FROM productos WHERE id IN (?)',
          [productIds]
        );
        const priceById = new Map(products.map((p) => [Number(p.id), Number(p.precio)]));

        // Subtotal del cupón = (precio base + suma de adiciones) * cantidad.
        // Cargamos las adiciones para que el descuento calcule sobre el
        // subtotal REAL del pedido (con extras), no solo sobre la base.
        // Si el item no trae adiciones o los ids son inválidos, lo
        // tratamos como precio base.
        const adicionIds = [
          ...new Set(
            normalizedItems
              .flatMap((i) => (i.adiciones || []).map((a) => a.adicion_id))
              .filter((id) => Number.isInteger(id) && id > 0)
          ),
        ];
        let adicionesById = new Map();
        if (adicionIds.length > 0) {
          const [adicRows] = await pool.query(
            `SELECT id, precio_extra FROM producto_adiciones
             WHERE id IN (?) AND activo = 1`,
            [adicionIds]
          );
          adicionesById = new Map(
            adicRows.map((r) => [
              Number(r.id),
              r.precio_extra == null ? 0 : Number(r.precio_extra),
            ])
          );
        }

        const subtotal = normalizedItems.reduce((sum, item) => {
          const precioBase = priceById.get(Number(item.producto_id)) || 0;
          const sumaAdiciones = (item.adiciones || []).reduce((s, a) => {
            const p = adicionesById.get(a.adicion_id);
            return s + (p == null ? 0 : p * (a.cantidad || 0));
          }, 0);
          return sum + (precioBase + sumaAdiciones) * item.cantidad;
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

    // Crear pedido de forma transaccional. El service maneja: validación de
    // productos, snapshot de adiciones/removibles, INSERT, y reserva de mesa
    // (no aplica para flujo web — `mesa_id` queda null). El `total` se respeta
    // si el frontend lo mandó válido.
    const pedidoId = await createOrderCore({
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
      latitud: latitud ?? null,
      longitud: longitud ?? null,
      direccion_formateada: direccion_formateada ?? null,
      place_id: place_id ?? null,
      esRetiroLocal,
      esConsumoEnLocal,
      total: (typeof totalFromFrontend === 'number' && totalFromFrontend > 0) ? totalFromFrontend : null,
      canal: 'web',  // flujo del cliente
      mesa_id: null, // web no usa mesas
      creado_por: null,
    }, { clientSource: 'web' });

    // Registrar uso del cupón si se aplicó
    if (couponId) {
      await CouponModel.recordCouponUsage(couponId);
    }

    const pedido = await OrderModel.getOrderById(pedidoId);

    // Notificar al restaurante (interna + email). El service lo hace
    // best-effort y no rompe la respuesta si falla.
    notificarNuevoPedido(pedidoId);

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

      // Las modalidades del pedido están persistidas en
      // `pedidos.es_retiro_local` y `pedidos.es_consumo_en_local` al
      // momento de crear el pedido. Las usamos (en lugar del flag
      // actual del restaurante) para que un cambio de flag posterior
      // no afecte las notificaciones de pedidos históricos.
      const esRetiroLocalNotif = Boolean(Number(pedidoActualizado.es_retiro_local));
      const esConsumoEnLocalNotif = Boolean(Number(pedidoActualizado.es_consumo_en_local));

      // Si el pedido es de retiro o consumo en local y el estado es
      // "Listo", necesitamos el nombre del local para el mensaje.
      const necesitaNombreLocal = matchedState === 'Listo'
        && (esRetiroLocalNotif || esConsumoEnLocalNotif);
      const restauranteNotif = necesitaNombreLocal
        ? await RestaurantModel.getRestaurantById(pedidoActualizado.restaurante_id)
        : null;

      // Notificación interna (base de datos)
      // Customizamos el mensaje y el título según la modalidad:
      // - Consumo en el local + Listo → "te lo llevamos a la mesa"
      // - Retiro en mostrador  + Listo → "pasá a retirarlo por el mostrador"
      // - Otro estado o modalidad → mensaje genérico
      const esListoConsumo = esConsumoEnLocalNotif && matchedState === 'Listo';
      const esListoRetiro = esRetiroLocalNotif && matchedState === 'Listo';
      const notifTitulo = esListoConsumo
        ? '🍽️ ¡Tu pedido está listo, te lo llevamos a la mesa!'
        : esListoRetiro
          ? '🛍️ ¡Tu pedido está listo para retirar!'
          : 'Actualización de Pedido';
      const notifMensaje = esListoConsumo
        ? `Tu pedido #${id} está listo en ${restauranteNotif?.nombre || 'el local'}. Avisale a la mesera con tu número de pedido y te lo llevamos a la mesa.`
        : esListoRetiro
          ? `Tu pedido #${id} ya está listo en ${restauranteNotif?.nombre || 'el local'}. Pasá a retirarlo por el mostrador.`
          : `Tu pedido #${id} ahora está en estado: ${matchedState}`;

      await NotificationModel.createNotification({
        usuario_id: pedidoActualizado.usuario_id,
        tipo: 'pedido',
        titulo: notifTitulo,
        mensaje: notifMensaje,
        data: {
          pedido_id: id,
          estado: matchedState,
          es_retiro_local: esRetiroLocalNotif,
          es_consumo_en_local: esConsumoEnLocalNotif
        }
      });

      // Notificación externa (email/SMS) - solo para ciertos estados
      const estadosConNotificacion = ['Preparando', 'Listo', 'Entregado'];
      if (estadosConNotificacion.includes(matchedState)) {
        // Obtener datos completos para la notificación
        const cliente = await RestaurantModel.getUserById(pedidoActualizado.usuario_id);

        // Reusamos restauranteNotif si ya lo consultamos arriba; si no,
        // lo consultamos ahora. Esto evita una query extra en el caso
        // común (Listo + retiro/consumo).
        const restauranteData = restauranteNotif
          || await RestaurantModel.getRestaurantById(pedidoActualizado.restaurante_id);

        const pedidoParaNotificar = {
          ...pedidoActualizado,
          cliente_email: cliente?.email,
          cliente_telefono: cliente?.telefono,
          cliente_nombre: cliente?.nombre,
          restaurante_email: restauranteData?.usuario_email,
          restaurante_nombre: restauranteData?.nombre,
          // Flags que usa notificationService para elegir el template de
          // email correcto cuando el estado es "Listo".
          esRetiroLocal: esRetiroLocalNotif,
          esConsumoEnLocal: esConsumoEnLocalNotif
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

    // Clientes solo pueden cancelar pedidos que aún no entraron a cocina.
    // Estados permitidos: Pendiente, Comprobante Enviado, Pago Confirmado, Pago Rechazado.
    // (restaurante y admin siguen pudiendo cancelar cualquier estado != Entregado, igual que antes).
    const CLIENT_CANCELLABLE_STATES = [
      OrderModel.ORDER_STATES.PENDIENTE,
      OrderModel.ORDER_STATES.COMPROBANTE_ENVIADO,
      OrderModel.ORDER_STATES.PAGO_CONFIRMADO,
      OrderModel.ORDER_STATES.PAGO_RECHAZADO,
    ];
    if (
      req.user.tipo_usuario === 'cliente' &&
      !CLIENT_CANCELLABLE_STATES.includes(pedido.estado)
    ) {
      return res.status(400).json({
        error: 'No se puede cancelar un pedido que ya entró en preparación',
        detalles: `El pedido está en estado "${pedido.estado}". Solo puedes cancelarlo si está Pendiente, Comprobante Enviado, Pago Confirmado o Pago Rechazado.`,
      });
    }

    await OrderModel.cancelOrder(id, motivo);

    // Notificar al restaurante que el pedido fue cancelado.
    // 1) in-app (tabla notificaciones) — best-effort.
    // 2) email al restaurante — best-effort.
    // 3) WhatsApp al dueño del restaurante (su teléfono) — best-effort.
    try {
      const pedidoCancelado = await OrderModel.getOrderById(id);
      const duenoRestaurante = await RestaurantModel.getRestaurantUser(pedidoCancelado.restaurante_id);

      // 1) in-app
      if (duenoRestaurante && duenoRestaurante.id) {
        await NotificationModel.createNotification({
          usuario_id: duenoRestaurante.id,
          tipo: 'pedido',
          titulo: 'Pedido Cancelado por el cliente',
          mensaje: `El pedido #${id} fue cancelado por el cliente. Motivo: "${motivo}"`,
          data: { pedido_id: id, motivo }
        });
      }

      // 2) email al restaurante
      if (duenoRestaurante && duenoRestaurante.email) {
        await notificationService.sendOrderNotification({
          to: duenoRestaurante.email,
          template: 'orderCancelledByClient',
          pedido: pedidoCancelado,
          motivo
        });
      }

      // 3) WhatsApp al dueño del restaurante
      if (duenoRestaurante && duenoRestaurante.telefono) {
        await notificationService.sendOrderWhatsApp({
          to: duenoRestaurante.telefono,
          type: 'cancelled',
          pedido: pedidoCancelado,
          motivo
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

