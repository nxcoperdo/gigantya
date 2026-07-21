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
// HELPERS COMPARTIDOS
// ====================================================

/**
 * Escapa caracteres HTML para que strings de usuario no rompan el
 * layout ni abran un XSS al renderizarse dentro de `innerHTML` (que
 * es como se mandan los emails). Exportado para que cualquier job
 * que mande HTML pueda reusarlo en vez de duplicar la lógica.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
          <p><strong>Local:</strong> ${pedido.restaurante_nombre}</p>
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
        <p style="font-size: 16px; color: #555;">El local ya está preparando tu pedido. ¡Pronto estará listo!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Local:</strong> ${pedido.restaurante_nombre}</p>
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

  // Cliente: Pedido listo para retirar en mostrador
  // (variante del template anterior usada cuando el local no ofrece
  //  domicilio. El cliente debe acercarse al local a buscar su pedido.)
  orderReadyPickup: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🛍️ ¡Tu pedido está listo para retirar!</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pedido ya está listo en <strong>${pedido.restaurante_nombre}</strong>. ¡Pasá a retirarlo por el mostrador del local!</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Local:</strong> ${pedido.restaurante_nombre}</p>
          <p><strong>Estado:</strong> <span style="color: #4facfe; font-weight: bold;">Listo para retirar</span></p>
        </div>

        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
          <p style="margin: 0; font-size: 14px;"><strong>📍 ¿Qué hago ahora?</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Acercate al mostrador del local y pedí tu pedido #${pedido.id}. No hace falta que confirmes nada antes.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA - Retiro en mostrador</p>
        </div>
      </div>
    </div>
  `,

  // Cliente: Pedido listo para consumir en el local (comer en la mesa)
  // (variante del template de pickup usada cuando el cliente eligió
  //  consumo en el local. La mesera lleva el pedido a la mesa.)
  orderReadyConsumoLocal: (pedido) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🍽️ ¡Tu pedido está listo, lo llevamos a tu mesa!</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pedido en <strong>${pedido.restaurante_nombre}</strong> ya está listo. Avisale a la mesera con tu número de pedido y te lo llevamos a la mesa.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Local:</strong> ${pedido.restaurante_nombre}</p>
          <p><strong>Estado:</strong> <span style="color: #f5576c; font-weight: bold;">Listo en mesa</span></p>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <p style="margin: 0; font-size: 14px;"><strong>📣 ¿Qué hago ahora?</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Cuando la mesera diga tu número de pedido, respondele "AQUÍ". Te llevamos todo a la mesa.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA - Consumo en el local</p>
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

  // Restaurante: pedido cancelado por el cliente
  orderCancelledByClient: (pedido, motivo) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">❌ Pedido Cancelado por el Cliente</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hola equipo de <strong>${escapeHtml(pedido.restaurante_nombre || 'tu local')}</strong>,</p>
        <p style="font-size: 16px; color: #555;">El cliente ha cancelado el pedido <strong>#${pedido.id}</strong>. No hace falta prepararlo.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nombre || 'No disponible')}</p>
          <p><strong>Teléfono:</strong> ${escapeHtml(pedido.cliente_telefono || 'No disponible')}</p>
          <p><strong>Total:</strong> $${Number(pedido.total || 0).toLocaleString('es-CO')}</p>
          <p><strong>Método de pago:</strong> ${escapeHtml(pedido.metodo_pago || 'No especificado')}</p>
          <p><strong>Motivo de cancelación:</strong> <em>${escapeHtml(motivo || 'No especificado')}</em></p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;"><strong>⚠️ Acción recomendada:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">
            ${pedido.metodo_pago && pedido.metodo_pago !== 'contra_entrega'
              ? 'El cliente había pagado por transferencia. Contactalo para coordinar la devolución del dinero.'
              : 'El pago era contra entrega, no hace falta devolver dinero.'}
          </p>
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
        <p style="font-size: 16px; color: #333;">Hola <strong>${escapeHtml(pedido.cliente_nombre)}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Tu pago ha sido rechazado. Por favor, verifica la información e intenta nuevamente.</p>

        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Pedido #${pedido.id}</strong></p>
          <p><strong>Motivo:</strong> ${escapeHtml(motivo || 'No especificado')}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;"><strong>Importante:</strong> Contacta al local para resolver esta situación.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 14px; color: #999;">GigantYA</p>
        </div>
      </div>
    </div>
  `,

  /**
   * Dueño de local: nuevo mensaje de un cliente en el chat del local.
   * Complementa la notificación in-app (NotificationModel) — este llega
   * también si el dueño no tiene la pestaña de chat abierta.
   *
   * Params: { nombre, restaurante, cliente, preview, link }
   *   - nombre: nombre del dueño (para "Hola X")
   *   - restaurante: nombre del local
   *   - cliente: nombre del cliente que escribió
   *   - preview: primeros 200 chars del mensaje
   *   - link: URL absoluta al chat (ej: https://gigantya.com/dashboard/chat)
   */
  newChatMessage: ({ nombre, restaurante, cliente, preview, link }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1f2937; font-size: 20px; margin: 0 0 8px;">
        💬 Nuevo mensaje de ${escapeHtml(cliente || 'un cliente')}
      </h1>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Hola ${escapeHtml(String(nombre || '').split(' ')[0] || '')}, <strong>${escapeHtml(cliente || 'un cliente')}</strong>
        te escribió en el chat de <strong>${escapeHtml(restaurante || 'tu local')}</strong>:
      </p>
      <div style="background: #f3f4f6; border-left: 4px solid #FF6B00; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5; font-style: italic;">
          "${escapeHtml(preview || '')}"
        </p>
      </div>
      <p style="margin-top: 24px; text-align: center;">
        <a href="${escapeHtml(link || 'https://gigantya.com/dashboard/chat')}"
           style="display: inline-block; background: #FF6B00; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Abrir el chat
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Recibiste este email porque eres dueño de un local con la función de chat habilitada en GigantYA.
      </p>
    </div>
  `,

  /**
   * CLIENTE: el local le respondió por primera vez en el chat.
   * Params: { nombre, restaurante, preview, link }
   *   - nombre: nombre del cliente (para "Hola X")
   *   - restaurante: nombre del local
   *   - preview: primeros 200 chars de la respuesta del local
   *   - link: URL absoluta al chat (ej: https://gigantya.com/restaurant/4)
   *
   * Se manda UNA SOLA VEZ por conversación (cuando el vendedor responde
   * por primera vez). Las respuestas siguientes NO generan este email.
   */
  clientChatFirstReply: ({ nombre, restaurante, preview, link }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1f2937; font-size: 20px; margin: 0 0 8px;">
        💬 ${escapeHtml(restaurante || 'El local')} te respondió
      </h1>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Hola ${escapeHtml(String(nombre || '').split(' ')[0] || '')}, el local te respondió en el chat:
      </p>
      <div style="background: #f3f4f6; border-left: 4px solid #FF6B00; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5; font-style: italic;">
          "${escapeHtml(preview || '')}"
        </p>
      </div>
      <p style="margin-top: 24px; text-align: center;">
        <a href="${escapeHtml(link || 'https://gigantya.com')}"
           style="display: inline-block; background: #FF6B00; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Abrir el chat
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Recibiste este email porque iniciaste una conversación con este local en GigantYA.
      </p>
    </div>
  `,

  /**
   * Dueño de local: repaso semanal con tips contextuales.
   * Se manda solo si el dueño no entró al dashboard en 7+ días
   * (ver `weeklyDigestCron.js`).
   */
  weeklyDigest: ({ nombre, restaurante, link, tips }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1f2937; font-size: 22px; margin: 0 0 8px;">Hola ${escapeHtml(String(nombre).split(' ')[0])} 👋</h1>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Hace tiempo que no entras a GigantYA para revisar <strong>${escapeHtml(restaurante)}</strong>.
        Aquí van 3 tips rápidos que te pueden servir:
      </p>
      ${tips.map(t => `
        <div style="border-left: 4px solid #FF6B00; background: #fff7ed; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin: 0 0 4px; color: #1f2937; font-size: 15px;">${escapeHtml(t.titulo)}</h3>
          <p style="margin: 0 0 8px; color: #4b5563; font-size: 14px; line-height: 1.5;">${escapeHtml(t.texto)}</p>
          <a href="${escapeHtml(t.link)}" style="color: #FF6B00; font-size: 13px; font-weight: 600; text-decoration: none;">Ir ahora →</a>
        </div>
      `).join('')}
      <p style="margin-top: 24px; text-align: center;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #FF6B00; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Abrir mi dashboard</a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Recibiste este email porque eres dueño de un local en GigantYA. Si quieres dejar de recibirlo, puedes escribirnos a <a href="mailto:coderepairtech@gmail.com" style="color: #9ca3af; text-decoration: underline;">coderepairtech@gmail.com</a>.
      </p>
    </div>
  `,
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
    orderReadyPickup: `🛍️ Pedido #${pedido.id} listo para retirar - GigantYA`,
    orderReadyConsumoLocal: `🍽️ Pedido #${pedido.id} listo en la mesa - GigantYA`,
    orderDelivered: `🎉 Pedido #${pedido.id} entregado - GigantYA`,
    newOrderRestaurant: `🔔 Nuevo Pedido #${pedido.id} - GigantYA`,
    paymentApproved: `✅ Pago aprobado - Pedido #${pedido.id}`,
    paymentRejected: `⚠️ Pago rechazado - Pedido #${pedido.id}`,
    orderCancelledByClient: `❌ Pedido #${pedido.id} cancelado por el cliente - GigantYA`,
    weeklyDigest: '💡 3 tips rápidos para tu local - GigantYA',
    newChatMessage: '💬 Nuevo mensaje en tu chat - GigantYA',
    clientChatFirstReply: '💬 El local te respondió - GigantYA',
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
const FORMA_PAGO_LEGIBLE = {
  contra_entrega: 'Contra entrega',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bre_b: 'Bre-B',
};

function formaPagoLegible(forma) {
  if (!forma) return 'Contra entrega';
  return FORMA_PAGO_LEGIBLE[forma] || forma;
}

const WhatsAppTemplates = {
  newOrder: {
    template: 'order_confirmed',
    params: pedido => [String(pedido.id), `$${Number(pedido.total).toLocaleString('es-CO')}`]
  },
  // WhatsApp al RESTAURANTE cuando entra un pedido nuevo.
  // Plantilla distinta de `newOrder` (que es para el cliente con template
  // `order_confirmed`). La plantilla `new_order_restaurant` debe crearse
  // en Meta Business Manager — ver bloque al final de este archivo.
  newOrderRestaurant: {
    template: 'new_order_restaurant',
    params: pedido => [
      String(pedido.id),
      String(pedido.cliente_nombre || 'Cliente'),
      `$${Number(pedido.total).toLocaleString('es-CO')}`,
      String(formaPagoLegible(pedido.metodo_pago)),
    ]
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
    params: pedido => [String(pedido.id), pedido.motivo || 'Contacta al local']
  },
  cancelled: {
    template: 'order_cancelled',
    params: pedido => [
      String(pedido.id),
      String(pedido.cliente_nombre || 'Cliente'),
      String(pedido.motivo || 'Sin motivo especificado')
    ]
  },
  // WhatsApp al RESTAURANTE cuando entra un mensaje nuevo al chat del
  // local. La plantilla `chat_new_message` tiene que existir en Meta
  // Business Manager (ver bloque al final del archivo). Mientras no
  // esté aprobada, el envío falla silenciosamente (best-effort) y el
  // email + notificación in-app siguen siendo el fallback.
  //
  // {{1}} = nombre del cliente
  // {{2}} = preview del mensaje (recortado a 80 chars para que entre en
  //         la preview de WhatsApp sin truncarse feo)
  newChatMessage: {
    template: 'chat_new_message',
    params: ({ cliente, preview }) => [
      String(cliente || 'un cliente'),
      String((preview || '').substring(0, 80))
    ]
  },
  // WhatsApp al CLIENTE cuando el local le responde por primera vez.
  // Solo se manda UNA vez por conversación (la primera respuesta del
  // vendedor) para no spamear.
  //
  // {{1}} = nombre del restaurante (para "Hola, {restaurante} te respondió")
  // {{2}} = preview del mensaje del local (recortado a 80 chars)
  clientChatFirstReply: {
    template: 'chat_first_reply',
    params: ({ restaurante, preview }) => [
      String(restaurante || 'El local'),
      String((preview || '').substring(0, 80))
    ]
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
    // Si el estado es "Listo", elegimos el template según la modalidad
    // del pedido. Precedencia (de más específica a más genérica):
    //   - esConsumoEnLocal → orderReadyConsumoLocal (mesa)
    //   - esRetiroLocal    → orderReadyPickup (mostrador)
    //   - caso contrario   → orderReady (envío a domicilio)
    // Los flags llegan del controller (orderController.js), leídos de
    // las columnas persistidas pedidos.es_retiro_local /
    // pedidos.es_consumo_en_local al momento de crear el pedido.
    const isTrue = (v) => v === true || v === 1 || v === '1' || v === 'true';
    let template = customerTemplates[nuevoEstado];
    if (nuevoEstado === 'Listo' && isTrue(pedido.esConsumoEnLocal)) {
      template = 'orderReadyConsumoLocal';
    } else if (
      template === 'orderReady' && isTrue(pedido.esRetiroLocal)
    ) {
      template = 'orderReadyPickup';
    }
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

  // WhatsApp al cliente: se manda en los 5 estados críticos del flujo
  // de pedido + pago. El email sigue mandándose para todos los estados
  // (incluido Pendiente → Email de nuevo pedido).
  //
  // El mapping por estado es declarativo: agregar un estado nuevo es 1
  // línea. Las claves deben coincidir con las plantillas aprobadas en
  // Meta Business Manager (order_preparing, order_ready, order_delivered,
  // payment_approved, payment_rejected).
  const whatsappByState = {
    'Preparando': 'preparing',
    'Listo': 'ready',
    'Entregado': 'delivered',
    'Pago Confirmado': 'paymentApproved',
    'Pago Rechazado': 'paymentRejected',
  };
  const whatsappType = whatsappByState[nuevoEstado];
  if (pedido.cliente_telefono && whatsappType) {
    results.whatsapp = await sendOrderWhatsApp({
      to: pedido.cliente_telefono,
      type: whatsappType,
      pedido,
      motivo,
    });
  }

  return results;
}

/**
 * Notificar nuevo pedido
 *
 * Best-effort: cada canal (email/WhatsApp) es independiente. Si uno falla,
 * se loguea y seguimos con los demás — el pedido YA está creado en BD.
 *
 * @param {object} params
 * @param {object} params.pedido
 * @param {string} [params.restauranteEmail]
 * @param {string} [params.restauranteTelefono]   - E.164 o formato local
 * @param {string} [params.clienteEmail]
 */
export async function notifyNewOrder({ pedido, restauranteEmail, restauranteTelefono, clienteEmail }) {
  const results = {
    customerEmail: null,
    restaurantEmail: null,
    customerWhatsapp: null,
    restaurantWhatsapp: null,
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

  // WhatsApp al restaurante. Si no tiene teléfono cargado, simplemente se
  // salta este canal — el restaurante sigue recibiendo la notificación
  // in-app y el email.
  if (restauranteTelefono) {
    results.restaurantWhatsapp = await sendOrderWhatsApp({
      to: restauranteTelefono,
      type: 'newOrderRestaurant',
      pedido,
    }).catch((err) => {
      console.error('[notifyNewOrder] Error WhatsApp restaurante:', err);
      return null;
    });
  }

  return results;
}

/* ============================================================
 * PLANTILLAS DE META BUSINESS MANAGER — WhatsApp Cloud API
 * ============================================================
 *
 * Hay que crear 10 plantillas aprobadas en Meta Business Manager
 * (https://business.facebook.com/wa/manage/message-templates/):
 *
 *   1. order_confirmed      → cliente: pedido confirmado
 *   2. order_preparing      → cliente: en preparación
 *   3. order_ready          → cliente: listo
 *   4. order_delivered      → cliente: entregado
 *   5. payment_approved     → cliente: pago aprobado
 *   6. payment_rejected     → cliente: pago rechazado
 *   7. order_cancelled      → restaurante: pedido cancelado
 *   8. new_order_restaurant → restaurante: NUEVO pedido recibido
 *   9. chat_new_message     → restaurante: nuevo mensaje en el chat
 *  10. chat_first_reply     → cliente: el local le respondió por primera vez
 *
 * Categoría: TRANSACTIONAL (necesario porque la cuenta es de empresa).
 * Idioma: español (es).
 *
 * ----------------------------------------------------------------
 * 8) new_order_restaurant  (4 variables: {{1}} {{2}} {{3}} {{4}})
 * ----------------------------------------------------------------
 *
 * Nombre:          new_order_restaurant
 * Categoría:       Transaccional
 * Idioma:          es
 *
 * Header (opcional, recomendado):
 *   🔔 Nuevo pedido recibido
 *
 * Body (OBLIGATORIO — copiar literal, los {{N}} los completa Meta):
 *
 *   Hola {{1}}, acabas de recibir un nuevo pedido en tu local.
 *
 *   Pedido: #{{2}}
 *   Cliente: {{3}}
 *   Total: {{4}}
 *
 *   Ingresa a GigantYA para aceptar y preparar el pedido.
 *
 * Footer (opcional):
 *   GigantYA — Panel de pedidos
 *
 * Buttons (opcional, recomendado, 1 botón tipo URL):
 *   Acción: Ver pedido
 *   Tipo:   URL
 *   URL:    https://gigantya.com/dashboard/pedidos/{{1}}
 *   Texto:  Ver pedido
 *
 * ----------------------------------------------------------------
 * Mapeo de variables (lo que envía el backend en `params`):
 *
 *   {{1}} = pedido.id                 (ej: "4711")
 *   {{2}} = pedido.cliente_nombre     (ej: "Carlos Pérez")
 *   {{3}} = total formateado es-CO    (ej: "$45.900")
 *   {{4}} = forma de pago legible     (ej: "Nequi" / "Contra entrega")
 *
 * ----------------------------------------------------------------
 * Si la plantilla todavía no está aprobada en Meta, el envío falla
 * silenciosamente (best-effort) y el log muestra:
 *   [NotificationService] WhatsApp no enviado (...) error 132001: Template not found
 * El restaurante igual recibe la notificación in-app y el email.
 * ============================================================ */

/**
 * Notificar al dueño de un local que le llegó un mensaje nuevo en el chat
 * (Fase 6 del piloto Fruver).
 *
 * Best-effort, igual que `notifyNewOrder`: cada canal (email/WhatsApp)
 * es independiente. La notificación in-app se sigue creando en
 * `chatService.notifyVendorNewMessage` (NotificationModel), este helper
 * agrega email + WhatsApp por encima.
 *
 * Si el `conv` no tiene `cliente_telefono` o el dueño no tiene email,
 * ese canal se salta. No falla el flujo.
 *
 * @param {object} params
 * @param {object} params.conversacion  - Conv con cliente_nombre, cliente_telefono, restaurante_id, etc.
 * @param {object} params.mensaje       - Mensaje con contenido
 * @param {object} params.dueno         - { email, telefono, nombre } del dueño (de getRestaurantUser)
 * @param {string} [params.link]        - URL absoluta al chat (default: gigantya.com/dashboard/chat)
 */
export async function notifyNewChatMessage({ conversacion, mensaje, dueno, link }) {
  const results = { email: null, whatsapp: null };

  if (!conversacion || !mensaje) {
    return results;
  }

  const restauranteNombre = conversacion.restaurante_nombre || 'tu local';
  const cliente = conversacion.cliente_nombre || 'Un cliente';
  const preview = (mensaje.contenido || '').substring(0, 200);
  const finalLink = link || process.env.CHAT_NOTIFICATION_LINK || 'https://gigantya.com/dashboard/chat';

  // Email al dueño
  if (dueno?.email) {
    try {
      results.email = await sendEmail({
        to: dueno.email,
        subject: '💬 Nuevo mensaje en tu chat - GigantYA',
        html: EmailTemplates.newChatMessage({
          nombre: dueno.nombre || 'equipo',
          restaurante: restauranteNombre,
          cliente,
          preview,
          link: finalLink,
        }),
      });
    } catch (err) {
      console.error('[notifyNewChatMessage] Error email:', err.message);
      results.email = { sent: false, error: err.message };
    }
  }

  // WhatsApp al dueño
  if (dueno?.telefono) {
    try {
      results.whatsapp = await sendWhatsApp({
        to: dueno.telefono,
        template: 'chat_new_message',
        parameters: [cliente, preview],
      });
    } catch (err) {
      console.error('[notifyNewChatMessage] Error WhatsApp:', err.message);
      results.whatsapp = { sent: false, error: err.message };
    }
  }

  return results;
}

/**
 * Notifica al CLIENTE que el local le respondió por primera vez en el chat.
 *
 * Se llama desde `chatService.appendMensaje` SOLO cuando el emisor del
 * mensaje es el vendedor Y es su primera respuesta en esta conversación
 * (countByEmisor === 1). Esto evita spamear al cliente con cada respuesta
 * del chat — solo recibe UNA notificación por conversación.
 *
 * Canales (best-effort, independientes):
 *  - WhatsApp al teléfono del cliente:
 *    - Anónimo: el teléfono que dejó en el modal
 *    - Logueado: el teléfono de su user (si tiene)
 *  - Email al cliente (solo si está logueado y tiene email)
 *  - NotificationModel in-app (solo si está logueado) — para que aparezca
 *    el toast en su NotificationCenter cuando esté logueado en la web
 *
 * Si el cliente es anónimo y solo dejó teléfono → va solo WhatsApp.
 * Si la plantilla `chat_first_reply` no está aprobada en Meta todavía,
 * el WhatsApp falla silenciosamente y el resto del flujo sigue.
 *
 * @param {object} params
 * @param {object} [params.cliente]            - { id, nombre, email, telefono } del usuario logueado (o null si anónimo)
 * @param {object} [params.clienteAnonimo]    - { telefono, nombre } si es anónimo
 * @param {object} params.conversacion         - Conv con id, restaurante_id, restaurante_nombre, etc.
 * @param {object} params.mensaje              - Mensaje del vendedor con contenido
 * @param {string} [params.link]              - URL al chat (default: gigantya.com/restaurant/{restaurante_id})
 */
export async function notifyClientFirstChatReply({ cliente = null, clienteAnonimo = null, conversacion, mensaje, link }) {
  const results = { email: null, whatsapp: null, inApp: null };

  if (!conversacion || !mensaje) {
    return results;
  }

  const restauranteNombre = conversacion.restaurante_nombre || 'el local';
  const preview = (mensaje.contenido || '').substring(0, 200);
  const restauranteId = conversacion.restaurante_id;
  const finalLink = link || process.env.CHAT_CLIENT_LINK || `https://gigantya.com/restaurant/${restauranteId}`;

  // Determinar el teléfono destino para WhatsApp
  const clienteTelefono = cliente?.telefono || clienteAnonimo?.telefono;
  const clienteNombre = cliente?.nombre || clienteAnonimo?.nombre || 'Hola';

  // WhatsApp al cliente
  if (clienteTelefono) {
    try {
      results.whatsapp = await sendWhatsApp({
        to: clienteTelefono,
        template: 'chat_first_reply',
        parameters: [restauranteNombre, preview],
      });
    } catch (err) {
      console.error('[notifyClientFirstChatReply] Error WhatsApp:', err.message);
      results.whatsapp = { sent: false, error: err.message };
    }
  }

  // Email al cliente (solo si está logueado y tiene email)
  if (cliente?.email) {
    try {
      results.email = await sendEmail({
        to: cliente.email,
        subject: '💬 El local te respondió - GigantYA',
        html: EmailTemplates.clientChatFirstReply({
          nombre: clienteNombre,
          restaurante: restauranteNombre,
          preview,
          link: finalLink,
        }),
      });
    } catch (err) {
      console.error('[notifyClientFirstChatReply] Error email:', err.message);
      results.email = { sent: false, error: err.message };
    }
  }

  // NotificationModel in-app (solo logueado)
  if (cliente?.id) {
    try {
      const { createNotification } = await import('../models/Notification.js');
      await createNotification({
        usuario_id: cliente.id,
        tipo: 'chat_respuesta',
        titulo: `${restauranteNombre} te respondió`,
        mensaje: preview,
        data: { conversacion_id: conversacion.id, mensaje_id: mensaje.id, restaurante_id: restauranteId },
      });
    } catch (err) {
      console.error('[notifyClientFirstChatReply] Error NotificationModel:', err.message);
      results.inApp = { sent: false, error: err.message };
    }
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
  notifyNewChatMessage,
  notifyClientFirstChatReply,

  // Plantillas (para personalización)
  EmailTemplates
};
