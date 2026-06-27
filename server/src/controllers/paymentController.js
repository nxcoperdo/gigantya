import * as PaymentProofModel from '../models/PaymentProof.js';
import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';
import notificationService from '../services/notificationService.js';

// Nota: la carpeta `uploads/payment-proofs/` se crea automáticamente al
// inicializar `createUploader({ subdir: 'payment-proofs' })` en paymentRoutes.js.

/**
 * Obtener configuración de pagos del restaurante (Nequi/Daviplata)
 */
export async function getPaymentConfig(req, res) {
  try {
    const { restaurante_id } = req.params;

    const config = await PaymentProofModel.getRestaurantPaymentConfig(restaurante_id);

    res.json({
      configuracion: config || {
        nequi: { telefono: '', titular: '' },
        daviplata: { telefono: '', titular: '' }
      }
    });
  } catch (error) {
    console.error('Error obteniendo configuración de pagos:', error);
    res.status(500).json({
      error: 'Error obteniendo configuración de pagos',
      detalles: error.message
    });
  }
}

/**
 * Actualizar configuración de pagos del restaurante
 */
export async function updatePaymentConfig(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({
        error: 'Solo restaurantes pueden configurar sus métodos de pago'
      });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const { nequi, daviplata, bre_b } = req.body;

    const config = {
      nequi: {
        telefono: nequi?.telefono || '',
        titular: nequi?.titular || ''
      },
      daviplata: {
        telefono: daviplata?.telefono || '',
        titular: daviplata?.titular || ''
      },
      bre_b: {
        clave: bre_b?.clave || '',
        titular: bre_b?.titular || ''
      }
    };

    await PaymentProofModel.updateRestaurantPaymentConfig(restaurante.id, config);

    res.json({
      mensaje: 'Configuración de pagos actualizada exitosamente',
      configuracion: config
    });
  } catch (error) {
    console.error('Error actualizando configuración de pagos:', error);
    res.status(500).json({
      error: 'Error actualizando configuración de pagos',
      detalles: error.message
    });
  }
}

/**
 * Subir comprobante de pago
 */
export async function uploadPaymentProof(req, res) {
  try {
    if (req.user.tipo_usuario !== 'cliente') {
      return res.status(403).json({
        error: 'Solo clientes pueden subir comprobantes de pago'
      });
    }

    const { pedido_id, metodo_pago } = req.body;

    if (!pedido_id || !metodo_pago) {
      return res.status(400).json({
        error: 'pedido_id y metodo_pago son requeridos'
      });
    }

    if (!['nequi', 'daviplata', 'bre_b'].includes(metodo_pago)) {
      return res.status(400).json({
        error: 'Método de pago no válido. Use: nequi, daviplata, bre_b'
      });
    }

    // Verificar que el pedido pertenece al usuario
    const pedido = await OrderModel.getOrderById(pedido_id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (pedido.usuario_id !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permiso para subir comprobante de este pedido'
      });
    }

    // Verificar archivo
    if (!req.file) {
      return res.status(400).json({ error: 'Debe subir un comprobante de pago' });
    }

    const url_imagen = `/uploads/payment-proofs/${req.file.filename}`;

    // Verificar si ya existe un comprobante para este pedido
    const existingProof = await PaymentProofModel.getProofByOrderId(pedido_id);
    if (existingProof) {
      return res.status(400).json({
        error: 'Ya existe un comprobante para este pedido'
      });
    }

    // Crear comprobante
    const proofId = await PaymentProofModel.createProof({
      pedido_id,
      url_imagen,
      metodo_pago
    });

    // Actualizar estado del pedido
    await OrderModel.updateOrderStatus(pedido_id, OrderModel.ORDER_STATES.COMPROBANTE_ENVIADO);

    // Notificar al restaurante
    try {
      const restauranteData = await RestaurantModel.getRestaurantById(pedido.restaurante_id);
      if (restauranteData && restauranteData.usuario_id) {
        await NotificationModel.createNotification({
          usuario_id: restauranteData.usuario_id,
          tipo: 'pago',
          titulo: 'Nuevo Comprobante de Pago',
          mensaje: `El pedido #${pedido_id} tiene un nuevo comprobante de pago por ${metodo_pago}`,
          data: { pedido_id, comprobante_id: proofId }
        });
      }
    } catch (notifError) {
      console.error('Error enviando notificación de comprobante:', notifError);
    }

    res.status(201).json({
      mensaje: 'Comprobante subido exitosamente',
      comprobante_id: proofId
    });
  } catch (error) {
    console.error('Error subiendo comprobante de pago:', error);
    res.status(500).json({
      error: 'Error subiendo comprobante de pago',
      detalles: error.message
    });
  }
}

/**
 * Obtener comprobante de un pedido
 */
export async function getPaymentProof(req, res) {
  try {
    const { pedido_id } = req.params;

    const proof = await PaymentProofModel.getProofByOrderId(pedido_id);

    if (!proof) {
      return res.status(404).json({ error: 'No hay comprobante para este pedido' });
    }

    // Validar permisos
    const pedido = await OrderModel.getOrderById(pedido_id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (req.user.tipo_usuario === 'cliente' && pedido.usuario_id !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permiso para ver este comprobante'
      });
    }

    res.json({
      comprobante: proof
    });
  } catch (error) {
    console.error('Error obteniendo comprobante:', error);
    res.status(500).json({
      error: 'Error obteniendo comprobante',
      detalles: error.message
    });
  }
}

/**
 * Obtener comprobantes pendientes de validación (Restaurante)
 */
export async function getPendingProofs(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({
        error: 'Solo restaurantes pueden ver comprobantes pendientes'
      });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const proofs = await PaymentProofModel.getPendingProofs(restaurante.id);

    res.json({
      total: proofs.length,
      comprobantes: proofs
    });
  } catch (error) {
    console.error('Error obteniendo comprobantes pendientes:', error);
    res.status(500).json({
      error: 'Error obteniendo comprobantes pendientes',
      detalles: error.message
    });
  }
}

/**
 * Obtener todos los comprobantes de un restaurante
 */
export async function getProofsByRestaurant(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({
        error: 'Solo restaurantes pueden ver sus comprobantes'
      });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const { estado } = req.query;
    const proofs = await PaymentProofModel.getProofsByRestaurant(restaurante.id, estado || null);

    res.json({
      total: proofs.length,
      comprobantes: proofs
    });
  } catch (error) {
    console.error('Error obteniendo comprobantes:', error);
    res.status(500).json({
      error: 'Error obteniendo comprobantes',
      detalles: error.message
    });
  }
}

/**
 * Aprobar comprobante de pago
 */
export async function approvePaymentProof(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({
        error: 'Solo restaurantes pueden aprobar comprobantes'
      });
    }

    const { id } = req.params;

    const proof = await PaymentProofModel.getProofById(id);
    if (!proof) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    // Verificar que el pedido pertenece al restaurante
    const pedido = await OrderModel.getOrderById(proof.pedido_id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante || restaurante.id !== pedido.restaurante_id) {
      return res.status(403).json({
        error: 'No tienes permiso para aprobar este comprobante'
      });
    }

    // Actualizar estado del comprobante
    await PaymentProofModel.updateProofStatus(id, 'aprobado', req.user.id);

    // Actualizar estado del pedido - pasa directamente a Preparando
    await OrderModel.updateOrderStatus(proof.pedido_id, OrderModel.ORDER_STATES.PREPARANDO);
    await OrderModel.updatePaymentValidation(proof.pedido_id, 'aprobado');

    // Notificar al cliente (interna y externa)
    try {
      // Notificación interna
      await NotificationModel.createNotification({
        usuario_id: pedido.usuario_id,
        tipo: 'pago',
        titulo: 'Pago Aprobado',
        mensaje: `Tu pago del pedido #${proof.pedido_id} ha sido aprobado. ¡Gracias!`,
        data: { pedido_id: proof.pedido_id }
      });

      // Notificación externa (email/SMS)
      const cliente = await RestaurantModel.getUserById(pedido.usuario_id);
      const restauranteData = await RestaurantModel.getRestaurantById(pedido.restaurante_id);

      const pedidoParaNotificar = {
        id: proof.pedido_id,
        total: pedido.total,
        cliente_email: cliente?.email,
        cliente_telefono: cliente?.telefono,
        cliente_nombre: cliente?.nombre,
        restaurante_nombre: restauranteData?.nombre
      };

      notificationService.notifyOrderStatusChange({
        pedido: pedidoParaNotificar,
        nuevoEstado: 'Pago Confirmado',
        notifyCustomer: true
      }).catch(err => console.error('Error enviando notificación de pago aprobado:', err));
    } catch (notifError) {
      console.error('Error enviando notificación de aprobación:', notifError);
    }

    res.json({
      mensaje: 'Pago aprobado exitosamente'
    });
  } catch (error) {
    console.error('Error aprobando pago:', error);
    res.status(500).json({
      error: 'Error aprobando pago',
      detalles: error.message
    });
  }
}

/**
 * Rechazar comprobante de pago
 */
export async function rejectPaymentProof(req, res) {
  try {
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({
        error: 'Solo restaurantes pueden rechazar comprobantes'
      });
    }

    const { id } = req.params;
    const { motivo_rechazo } = req.body;

    const proof = await PaymentProofModel.getProofById(id);
    if (!proof) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    // Verificar que el pedido pertenece al restaurante
    const pedido = await OrderModel.getOrderById(proof.pedido_id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante || restaurante.id !== pedido.restaurante_id) {
      return res.status(403).json({
        error: 'No tienes permiso para rechazar este comprobante'
      });
    }

    // Actualizar estado del comprobante
    await PaymentProofModel.updateProofStatus(id, 'rechazado', req.user.id, motivo_rechazo || null);

    // Actualizar estado del pedido
    await OrderModel.updateOrderStatus(proof.pedido_id, OrderModel.ORDER_STATES.PAGO_RECHAZADO);
    await OrderModel.updatePaymentValidation(proof.pedido_id, 'rechazado');

    // Notificar al cliente (interna y externa)
    try {
      // Notificación interna
      await NotificationModel.createNotification({
        usuario_id: pedido.usuario_id,
        tipo: 'pago',
        titulo: 'Pago Rechazado',
        mensaje: `Tu pago del pedido #${proof.pedido_id} ha sido rechazado. ${motivo_rechazo ? 'Motivo: ' + motivo_rechazo : 'Contacta al restaurante.'}`,
        data: { pedido_id: proof.pedido_id }
      });

      // Notificación externa (email/SMS) - más urgente
      const cliente = await RestaurantModel.getUserById(pedido.usuario_id);
      const restauranteData = await RestaurantModel.getRestaurantById(pedido.restaurante_id);

      const pedidoParaNotificar = {
        id: proof.pedido_id,
        total: pedido.total,
        cliente_email: cliente?.email,
        cliente_telefono: cliente?.telefono,
        cliente_nombre: cliente?.nombre,
        restaurante_nombre: restauranteData?.nombre
      };

      // Email y SMS para pago rechazado (es más urgente)
      notificationService.notifyOrderStatusChange({
        pedido: pedidoParaNotificar,
        nuevoEstado: 'Pago Rechazado',
        notifyCustomer: true,
        motivo: motivo_rechazo
      }).catch(err => console.error('Error enviando notificación de pago rechazado:', err));
    } catch (notifError) {
      console.error('Error enviando notificación de rechazo:', notifError);
    }

    res.json({
      mensaje: 'Pago rechazado'
    });
  } catch (error) {
    console.error('Error rechazando pago:', error);
    res.status(500).json({
      error: 'Error rechazando pago',
      detalles: error.message
    });
  }
}

export default {
  getPaymentConfig,
  updatePaymentConfig,
  uploadPaymentProof,
  getPaymentProof,
  getPendingProofs,
  getProofsByRestaurant,
  approvePaymentProof,
  rejectPaymentProof
};
