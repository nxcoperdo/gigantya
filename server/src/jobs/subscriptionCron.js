import * as SubscriptionModel from '../models/Subscription.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';
import logger from '../utils/logger.js';

const DIAS_AVISO = 3;

/**
 * Job diario. Hace dos cosas:
 *   1. Notifica a restaurantes cuyo plan vence en 3 días.
 *   2. Degrada a `basico` las suscripciones ya vencidas.
 *
 * Idempotente: cada suscripción solo recibe un recordatorio (campo
 * `recordatorio_enviado` lo marca). Si vuelve a correr el mismo día
 * no duplica notificaciones.
 */
export async function runDailyChecks() {
  logger.info('[subscriptionCron] Iniciando verificación diaria de suscripciones');
  const inicio = Date.now();

  try {
    await Promise.all([enviarRecordatorios(), degradarVencidas()]);
  } catch (error) {
    logger.error(`[subscriptionCron] Error: ${error.message}`);
  }

  logger.info(`[subscriptionCron] Verificación finalizada en ${Date.now() - inicio}ms`);
}

/**
 * Suscripciones que vencen en 3 días → notificación in-app.
 */
async function enviarRecordatorios() {
  const proximas = await SubscriptionModel.getSubscriptionsExpiringInDays(DIAS_AVISO);
  if (proximas.length === 0) return;

  logger.info(`[subscriptionCron] ${proximas.length} suscripciones próximas a vencer`);

  for (const s of proximas) {
    try {
      await NotificationModel.createNotification({
        usuario_id: s.usuario_id,
        tipo: 'plan_por_vencer',
        titulo: `Tu plan ${s.plan} vence pronto`,
        mensaje: `Tu suscripción del plan ${s.plan} vence el ${new Date(s.fecha_vencimiento).toLocaleDateString('es-CO')}. Contacta al administrador para renovar y mantener tus funciones activas.`,
      });
      await SubscriptionModel.markReminderSent(s.id);
      logger.info(`[subscriptionCron] Recordatorio enviado a restaurante ${s.restaurante_nombre}`);
    } catch (err) {
      logger.error(`[subscriptionCron] No se pudo notificar a ${s.restaurante_nombre}: ${err.message}`);
    }
  }
}

/**
 * Suscripciones con fecha_vencimiento < hoy → marcar vencidas y bajar a basico.
 */
async function degradarVencidas() {
  const vencidas = await SubscriptionModel.getExpiredActiveSubscriptions();
  if (vencidas.length === 0) return;

  logger.info(`[subscriptionCron] ${vencidas.length} suscripciones vencidas para degradar`);

  for (const s of vencidas) {
    try {
      // Marcar la suscripción como vencida (idempotente)
      const updated = await SubscriptionModel.markSubscriptionExpired(s.id);
      if (updated === 0) continue;

      // Bajar el restaurante a plan basico
      await RestaurantModel.updateRestaurant(s.restaurante_id_db, {
        plan: 'basico',
        fecha_vencimiento_plan: null,
      });

      // Avisar al restaurante
      await NotificationModel.createNotification({
        usuario_id: s.usuario_id,
        tipo: 'plan_vencido',
        titulo: 'Tu plan ha vencido',
        mensaje: 'Tu suscripción venció. Tu restaurante pasó al plan Básico. Contacta al administrador para renovar.',
      });

      logger.info(`[subscriptionCron] Restaurante ${s.restaurante_nombre} degradado a plan básico`);
    } catch (err) {
      logger.error(`[subscriptionCron] No se pudo degradar ${s.restaurante_nombre}: ${err.message}`);
    }
  }
}

export default { runDailyChecks };
