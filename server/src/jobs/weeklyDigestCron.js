import * as UserModel from '../models/User.js';
import * as RestaurantModel from '../models/Restaurant.js';
import notificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

const { sendEmail, EmailTemplates } = notificationService;

const DIAS_INACTIVIDAD = 7;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://gigantya.com/dashboard';

/**
 * Job semanal (Capa 3 del manual contextual).
 *
 * Cada lunes a las 8am, busca restaurantes cuyo dueño no accedió al
 * dashboard en los últimos 7 días y le manda un email corto con 3
 * tips contextuales + link al dashboard.
 *
 * Idempotente: `ultimo_acceso_dashboard` se actualiza en cada visita
 * del dueño a /dashboard, así que solo entran los realmente inactivos.
 * Si la BD está vacía o no hay inactivos, no se manda nada.
 */
export async function runWeeklyDigest() {
  logger.info('[weeklyDigest] Buscando locales inactivos...');
  const inicio = Date.now();

  try {
    const inactivos = await RestaurantModel.getRestaurantesInactivos(DIAS_INACTIVIDAD);
    if (inactivos.length === 0) {
      logger.info('[weeklyDigest] Sin locales inactivos. Nada que enviar.');
      return { sent: 0, skipped: 0 };
    }

    logger.info(`[weeklyDigest] ${inactivos.length} locales inactivos. Enviando repaso...`);

    let sent = 0;
    let skipped = 0;

    for (const r of inactivos) {
      try {
        // getUserById ya devuelve email del dueño
        const dueno = await UserModel.getUserById(r.usuario_id);
        if (!dueno?.email) {
          logger.warn(`[weeklyDigest] Local ${r.restaurante_id}: dueño sin email, salteo`);
          skipped++;
          continue;
        }

        const html = EmailTemplates.weeklyDigest({
          nombre: dueno.nombre,
          restaurante: r.nombre,
          link: DASHBOARD_URL,
          tips: getTipsAleatorios(3),
        });

        const result = await sendEmail({
          to: dueno.email,
          subject: `${dueno.nombre.split(' ')[0]}, ¿todo bien con tu local? Te mostramos 3 tips rápidos`,
          html,
        });
        if (result.sent) sent++;
        else skipped++;
      } catch (err) {
        logger.error(`[weeklyDigest] Error enviando a local ${r.restaurante_id}: ${err.message}`);
        skipped++;
      }
    }

    logger.info(`[weeklyDigest] Finalizado en ${Date.now() - inicio}ms — sent=${sent} skipped=${skipped}`);
    return { sent, skipped };
  } catch (error) {
    logger.error(`[weeklyDigest] Error general: ${error.message}`);
    return { sent: 0, skipped: 0, error: error.message };
  }
}

/**
 * Devuelve N tips aleatorios (determinístico, sin Math.random) del set
 * fijo. La elección de tips cambia cada semana porque `Date.now()`
 * cambia — pero dentro de la misma corrida es estable (Fisher-Yates
 * con PRNG de congruencia lineal sembrado por la fecha).
 */
function getTipsAleatorios(n) {
  const all = [
    {
      titulo: 'Revisa tus ventas del día',
      texto: 'En Reportes puedes ver cuánto vendiste hoy, qué productos son los más pedidos y cómo se comparan con la semana pasada.',
      link: 'https://gigantya.com/pos/reportes',
    },
    {
      titulo: 'Abre la caja al empezar el día',
      texto: 'Ir a Caja → "Abrir caja" con el fondo inicial. Así todos los cobros del día quedan registrados.',
      link: 'https://gigantya.com/pos/caja',
    },
    {
      titulo: 'Revisa el kardex de inventario',
      texto: 'En Inventario puedes ver qué ingredientes tienes en stock y cuáles están por debajo del mínimo.',
      link: 'https://gigantya.com/pos/inventario',
    },
    {
      titulo: 'Configura tus modificadores',
      texto: 'En el dashboard puedes agregar modificadores obligatorios u opcionales a tus productos (ej: "Tamaño", "Punto de la carne").',
      link: 'https://gigantya.com/dashboard',
    },
    {
      titulo: 'Mira las reseñas de tus clientes',
      texto: 'Las reseñas que te dejan en la página del local te ayudan a saber qué mejorar.',
      link: 'https://gigantya.com/dashboard',
    },
    {
      titulo: 'Comparte tu página con un link',
      texto: 'Tu página pública en gigantya.com ya está lista para compartir por WhatsApp a tus clientes.',
      link: 'https://gigantya.com',
    },
  ];

  // Fisher-Yates con PRNG determinístico sembrado por la fecha ISO del
  // momento. Si corre 2 veces en la misma semana sale lo mismo (ok);
  // si corre otra semana sale otra combinación (ok).
  const seedStr = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const arr = [...all];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export default { runWeeklyDigest };
