import cron from 'node-cron';
import { runDailyChecks } from './subscriptionCron.js';
import { runWeeklyDigest } from './weeklyDigestCron.js';
import logger from '../utils/logger.js';

/**
 * Arranca los jobs programados. Se llama desde server.js al iniciar.
 *
 * Variables de entorno:
 *   CRON_ENABLED   — 'false' desactiva los jobs (útil en tests)
 *   CRON_DAILY_AT  — hora local del check diario, formato "HH:MM" (default "02:00")
 */
export function startScheduler() {
  if (process.env.CRON_ENABLED === 'false') {
    logger.info('[scheduler] CRON deshabilitado por variable de entorno');
    return;
  }

  const hora = process.env.CRON_DAILY_AT || '02:00';
  // node-cron espera "M H * * *"
  const [mm, hh] = hora.split(':');
  const expression = `${parseInt(mm, 10)} ${parseInt(hh, 10)} * * *`;

  cron.schedule(expression, runDailyChecks);
  logger.info(`[scheduler] Job diario de suscripciones programado a las ${hora} (cron: ${expression})`);

  // Job semanal: lunes 8:13am (corremos a los :13 para no coincidir con la
  // manada de crons que arrancan en punto). Manda un email a los dueños
  // de locales que no entraron al dashboard en 7+ días.
  cron.schedule('13 8 * * 1', runWeeklyDigest);
  logger.info('[scheduler] Job semanal de repaso programado los lunes 8:13am (cron: 13 8 * * 1)');
}

export default { startScheduler };
