import cron from 'node-cron';
import { runDailyChecks } from './subscriptionCron.js';
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
}

export default { startScheduler };
