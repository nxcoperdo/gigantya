import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Servicio de Notificaciones Externas
 *
 * Maneja el envío de emails y mensajes de WhatsApp para notificaciones del sistema.
 * Se activa cuando un pedido cambia de estado o hay eventos importantes.
 *
 * Configuración requerida en .env:
 * - EMAIL_ENABLED=true/false
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * - EMAIL_FROM: "nombre <email@dominio.com>"
 *
 * - WHATSAPP_ENABLED=true/false
 * - WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID
 * - WHATSAPP_API_VERSION, WHATSAPP_LANGUAGE_CODE
 */

// ====================================================
// CONFIGURACIÓN DE EMAIL
// ====================================================

let emailTransporter = null;

function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('[NotificationService] Email no configurado (faltan variables SMTP)');
    return null;
  }

  emailTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  return emailTransporter;
}

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true' && getEmailTransporter() !== null;
}

// ====================================================
// CONFIGURACIÓN DE WHATSAPP BUSINESS CLOUD API (META)
// ====================================================

let whatsAppApiBase = null;

function getWhatsAppConfig() {
  if (whatsAppApiBase !== null) return whatsAppApiBase ? { base: whatsAppApiBase } : null;

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_API_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

  if (!phoneId || !token) {
    console.log('[NotificationService] WhatsApp no configurado (faltan variables)');
    whatsAppApiBase = false;
    return null;
  }

  whatsAppApiBase = `https://graph.facebook.com/${apiVersion}/${phoneId}`;
  return { base: whatsAppApiBase };
}

function isWhatsAppEnabled() {
  return process.env.WHATSAPP_ENABLED === 'true' && getWhatsAppConfig() !== null;
}

/**
 * Normaliza un número de teléfono al formato E.164 sin '+' que requiere
 * la WhatsApp Cloud API. Si el número ya trae el código de país 57 (Colombia)
 * se respeta; si no, se prefijará con 57.
 */
function normalizePhoneForWhatsApp(rawPhone) {
  if (!rawPhone) return null;
  // E.164 sin '+': solo dígitos, con código de país (Colombia = 57 por defecto)
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Si ya trae 57 al inicio (Colombia), respetar; si no, prefijar
  return digits.startsWith('57') ? digits : `57${digits}`;
}

// ====================================================
// PLANTILLAS DE EMAILS
// ====================================================

const EmailTemplates = {
  // Cliente: Pedido creado
  newOrderCustomer: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">¡Pedido Confirmado! 🎉</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pedido ha sido confirmado y está siendo procesado.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #667eea; margin-top: 0;">Detalle del Pedido #${pedido.id}</h2>
          <p><strong>Restaurante:</strong> ${pedido.restaurante_nombre}</p>
          <p><strong>Total:</strong> $${Number(pedido.total).toLocaleString('es-CO')}</p>
          <p><strong>Estado:</strong> <span style="color: #667eea; font-weight: bold;">${pedido.estado}</span></p>
          <p><strong>Fecha:</strong> ${new Date(pedido.creado_en).toLocaleString('es-CO')}</p>
        </div>

        <p style="font-size: 14px; color: #777;">Te notificaremos cuando tu pedido cambie de estado.</p>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">Gracias por usar GigantYA 🍽️</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pedido en preparación
  orderPreparing: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🍳 Tu pedido se está preparando</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">El restaurante ya está preparando tu pedido. ¡Pronto estará listo!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Restaurante:</strong> ${pedido.restaurante_nombre}</p>
          <p><strong>Estado actual:</strong> <span style="color: #f5576c; font-weight: bold;">${pedido.estado}</span></p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA - Tu pedido favorito</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pedido listo para recoger
  orderReady: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">✅ Pedido Listo</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">¡Tu pedido está listo para ser entregado!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Estado:</strong> <span style="color: #4facfe; font-weight: bold;">${pedido.estado}</span></p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pedido entregado
  orderDelivered: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 Pedido Entregado</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pedido ha sido entregado exitosamente. ¡Esperamos que lo disfrutes!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Total pagado:</strong> $${Number(pedido.total).toLocaleString('es-CO')}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;"><strong>⭐ ¿Te gustó tu experiencia?</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Califica tu experiencia en la aplicación para ayudar a otros clientes.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA - Gracias por tu compra</p>
        </div>
      </div>
    </div>
  `,

  // Restaurante: Nuevo pedido recibido
  newOrderRestaurant: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🔔 Nuevo Pedido Recibido</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola equipo de <strong>${pedido.restaurante_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Han recibido un nuevo pedido. ¡Prepárenlo lo antes posible!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #ff6b6b; margin-top: 0;">Pedido #${pedido.id}</h2>
          <p><strong>Cliente:</strong> ${pedido.cliente_nombre}</p>
          <p><strong>Teléfono:</strong> ${pedido.cliente_telefono || 'No disponible'}</p>
          <p><strong>Total:</strong> $${Number(pedido.total).toLocaleString('es-CO')}</p>
          <p><strong>Notas:</strong> ${pedido.notas || 'Sin notas'}</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pago aprobado
  paymentApproved: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">✅ Pago Aprobado</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pago ha sido aprobado correctamente.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Monto:</strong> $${Number(pedido.total).toLocaleString('es-CO')}</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pago rechazado
  paymentRejected: (pedido, motivo) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">⚠️ Pago Rechazado</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pago ha sido rechazado. Por favor, verifica la información e intenta nuevamente.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Motivo:</strong> ${motivo || 'No especificado'}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;"><strong>Importante:</strong> Contacta al restaurante para resolver esta situación.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA</p>
        </div>
      </div>
    </div>
  `
};

// ====================================================
// FUNCIONES DE ENVÍO DE EMAIL
// ====================================================

/**
 * Enviar email a un destinatario
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailEnabled()) {
    console.log('[NotificationService] Email no enviado (deshabilitado o sin configurar)');
    return { sent: false, reason: 'email_not_configured' };
  }

  const from = process.env.EMAIL_FROM || 'GigantYA <noreply@gigantya.com>';

  try {
    const info = await getEmailTransporter().sendMail({
      from,
      to,
      subject,
      html,
      text: text || subject
    });

    console.log(`[NotificationService] Email enviado a ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[NotificationService] Error enviando email:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Enviar email de notificación de pedido
 */
export async function sendOrderNotification({ to, template, pedido, motivo }) {
  const templateFn = EmailTemplates[template];
  if (!templateFn) {
    console.error('[NotificationService] Plantilla de email no encontrada:', template);
    return { sent: false, reason: 'template_not_found' };
  }

  const subject = getSubjectForTemplate(template, pedido);
  const html = templateFn(pedido, motivo);

  return sendEmail({ to, subject, html });
}

function getSubjectForTemplate(template, pedido) {
  const subjects = {
    newOrderCustomer: `✅ Pedido #${pedido.id} confirmado - GigantYA`,
    orderPreparing: `🍳 Pedido #${pedido.id} en preparación - GigantYA`,
    orderReady: `✅ Pedido #${pedido.id} listo - GigantYA`,
    orderDelivered: `🎉 Pedido #${pedido.id} entregado - GigantYA`,
    newOrderRestaurant: `🔔 Nuevo Pedido #${pedido.id} - GigantYA`,
    paymentApproved: `✅ Pago aprobado - Pedido #${pedido.id}`,
    paymentRejected: `⚠️ Pago rechazado - Pedido #${pedido.id}`
  };
  return subjects[template] || 'Notificación de GigantYA';
}

// ====================================================
// FUNCIONES DE ENVÍO DE WHATSAPP (META CLOUD API)
// ====================================================

/**
 * Enviar un mensaje de WhatsApp usando una plantilla pre-aprobada por Meta.
 *
 * @param {object}  params
 * @param {string}  params.to            - Número de teléfono destino (E.164 con o sin '+')
 * @param {string}  params.template      - Nombre de la plantilla aprobada en Meta Business Manager
 * @param {string}  [params.languageCode]- Código de idioma (ej. 'es'). Default: WHATSAPP_LANGUAGE_CODE o 'es'
 * @param {string[]} [params.parameters] - Array de strings que reemplazan {{1}}, {{2}}, ... en la plantilla
 */
export async function sendWhatsApp({ to, template, languageCode, parameters }) {
  if (!isWhatsAppEnabled()) {
    console.log('[NotificationService] WhatsApp no enviado (deshabilitado o sin configurar)');
    return { sent: false, reason: 'whatsapp_not_configured' };
  }

  const finalTo = normalizePhoneForWhatsApp(to);
  if (!finalTo) {
    console.warn('[NotificationService] WhatsApp no enviado: teléfono inválido', to);
    return { sent: false, reason: 'invalid_phone' };
  }

  const { base } = getWhatsAppConfig();

  const body = {
    messaging_product: 'whatsapp',
    to: finalTo,
    type: 'template',
    template: {
      name: template,
      language: { code: languageCode || process.env.WHATSAPP_LANGUAGE_CODE || 'es' },
      components: parameters && parameters.length
        ? [{ type: 'body', parameters: parameters.map(p => ({ type: 'text', text: String(p) })) }]
        : []
    }
  };

  try {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[NotificationService] Error WhatsApp:', res.status, JSON.stringify(data));
      return { sent: false, error: data.error?.message || `HTTP ${res.status}`, meta: data };
    }

    console.log(`[NotificationService] WhatsApp enviado a ${finalTo}: ${data.messages?.[0]?.id}`);
    return { sent: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('[NotificationService] Error enviando WhatsApp:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Mapa de plantillas WhatsApp por tipo de notificación.
 * Los nombres de plantilla deben existir en Meta Business Manager y estar APROBADOS.
 * Las funciones `params` devuelven los valores que reemplazan {{1}}, {{2}}, ... en cada plantilla.
 */
const WhatsAppTemplates = {
  newOrder: {
    template: 'order_confirmed',
    params: pedido => [String(pedido.id), `$${Number(pedido.total).toLocaleString('es-CO')}`]
  },
  preparing: {
    template: 'order_preparing',
    params: pedido => [String(pedido.id)]
  },
  ready: {
    template: 'order_ready',
    params: pedido => [String(pedido.id)]
  },
  delivered: {
    template: 'order_delivered',
    params: pedido => [String(pedido.id)]
  },
  paymentApproved: {
    template: 'payment_approved',
    params: pedido => [String(pedido.id)]
  },
  paymentRejected: {
    template: 'payment_rejected',
    params: pedido => [String(pedido.id), pedido.motivo || 'Contacta al restaurante']
  }
};

/**
 * Enviar WhatsApp de notificación de pedido según el tipo.
 */
export async function sendOrderWhatsApp({ to, type, pedido, motivo }) {
  const config = WhatsAppTemplates[type];
  if (!config) {
    console.error('[NotificationService] Tipo de WhatsApp no encontrado:', type);
    return { sent: false, reason: 'whatsapp_type_not_found' };
  }

  const pedidoConMotivo = motivo ? { ...pedido, motivo } : pedido;
  return sendWhatsApp({
    to,
    template: config.template,
    parameters: config.params(pedidoConMotivo)
  });
}

// ====================================================
// FUNCIONES PRINCIPALES DEL SERVICIO
// ====================================================

/**
 * Notificar cambio de estado de pedido
 * Envía email y/o WhatsApp según configuración
 */
export async function notifyOrderStatusChange({
  pedido,
  nuevoEstado,
  notifyCustomer = true,
  notifyRestaurant = false,
  motivo
}) {
  const results = {
    email: null,
    whatsapp: null
  };

  // Determinar tipo de notificación según estado
  const customerTemplates = {
    'Preparando': 'orderPreparing',
    'Listo': 'orderReady',
    'Entregado': 'orderDelivered',
    'Pago Confirmado': 'paymentApproved',
    'Pago Rechazado': 'paymentRejected'
  };

  // Notificar al cliente
  if (notifyCustomer && pedido.cliente_email) {
    const template = customerTemplates[nuevoEstado];
    if (template) {
      results.email = await sendOrderNotification({
        to: pedido.cliente_email,
        template,
        pedido,
        motivo
      });
    }
  }

  // Notificar al restaurante (solo para nuevos pedidos)
  if (notifyRestaurant && pedido.restaurante_email && nuevoEstado === 'Pendiente') {
    results.restaurantEmail = await sendOrderNotification({
      to: pedido.restaurante_email,
      template: 'newOrderRestaurant',
      pedido
    });
  }

  // WhatsApp opcional para estados críticos
  if (pedido.cliente_telefono && ['Entregado', 'Pago Rechazado'].includes(nuevoEstado)) {
    const whatsappType = nuevoEstado === 'Entregado' ? 'delivered' : 'paymentRejected';
    results.whatsapp = await sendOrderWhatsApp({
      to: pedido.cliente_telefono,
      type: whatsappType,
      pedido,
      motivo
    });
  }

  return results;
}

/**
 * Notificar nuevo pedido
 */
export async function notifyNewOrder({ pedido, restauranteEmail, clienteEmail }) {
  const results = {
    customerEmail: null,
    restaurantEmail: null,
    customerWhatsapp: null,
    restaurantWhatsapp: null
  };

  // Email al cliente
  if (clienteEmail) {
    results.customerEmail = await sendOrderNotification({
      to: clienteEmail,
      template: 'newOrderCustomer',
      pedido
    });
  }

  // Email al restaurante
  if (restauranteEmail) {
    results.restaurantEmail = await sendOrderNotification({
      to: restauranteEmail,
      template: 'newOrderRestaurant',
      pedido
    });
  }

  return results;
}

// ====================================================
// EXPORTACIÓN DEFAULT
// ====================================================

export default {
  // Configuración
  isEmailEnabled,
  isWhatsAppEnabled,

  // Email
  sendEmail,
  sendOrderNotification,

  // WhatsApp
  sendWhatsApp,
  sendOrderWhatsApp,

  // Funciones principales
  notifyOrderStatusChange,
  notifyNewOrder,

  // Plantillas (para personalización)
  EmailTemplates
};
