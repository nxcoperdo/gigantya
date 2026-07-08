import * as AuditLogModel from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/**
 * Helper para registrar una acción de auditoría.
 *
 * NO es un middleware global: debe llamarse EXPLÍCITAMENTE desde
 * cada controller, justo después de una mutación exitosa. Esto
 * evita ensuciar el log con GETs de polling u operaciones read-only.
 *
 * Reglas:
 *  - Si el log falla, la acción principal NO debe fallar. Se loguea
 *    el error a winston y se traga la excepción.
 *  - Se intenta capturar la IP del cliente respetando proxies
 *    (req.ip) y se hace fallback a X-Forwarded-For si req.ip no
 *    está disponible (caso apps detrás de nginx sin trust proxy).
 *  - user_agent se trunca a 255 chars (limitación de la columna).
 *
 * @param {import('express').Request} req
 * @param {string} accion           - ej: 'restaurante.approve', 'comprobante.reject'
 * @param {string} entidad_tipo     - ej: 'restaurante' | 'usuario' | 'comprobante' | 'plan' | 'modalidad'
 * @param {number|null} entidad_id  - id del recurso afectado
 * @param {object} [datos]          - { antes, despues }
 * @returns {Promise<void>}
 */
export async function recordAudit(req, accion, entidadTipo, entidadId, datos = {}) {
  try {
    // Cadena de IPs en orden de preferencia. Importa el orden: cada
    // proxy va agregando headers, y queremos el cliente ORIGINAL.
    //   1. cf-connecting-ip  → Cloudflare (lo más cercano al cliente)
    //   2. x-forwarded-for   → alternativa genérica, primer hop = cliente
    //   3. req.ip            → respeta app.set('trust proxy', N)
    //   4. fallback null
    // NOTA: cf-connecting-ip SOLO es confiable si el tráfico pasa
    // efectivamente por Cloudflare. Detrás de Cloudflare + nginx,
    // cf-connecting-ip trae la IP real del cliente final. Si por
    // alguna razón Cloudflare no estuviera en frente y alguien
    // mandara un header cf-connecting-ip falso, quedaría logueado
    // igual (riesgo aceptable: el atacante no nos ve a nosotros
    // ganando nada con eso, solo falsea su propio registro).
    const cfIp = req.headers['cf-connecting-ip'];
    const ipFromCf = typeof cfIp === 'string' && cfIp.trim().length > 0
      ? cfIp.trim()
      : null;

    const xffHeader = req.headers['x-forwarded-for'];
    const ipFromXff = typeof xffHeader === 'string'
      ? xffHeader.split(',')[0]?.trim()
      : null;

    const ip = ipFromCf || ipFromXff || req.ip || null;

    const userAgent = req.headers['user-agent']
      ? String(req.headers['user-agent']).slice(0, 255)
      : null;

    await AuditLogModel.createLog({
      admin_id: req.user.id,
      accion,
      entidad_tipo: entidadTipo,
      entidad_id: entidadId ?? null,
      datos_antes: datos.antes ?? null,
      datos_despues: datos.despues ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch (error) {
    // NUNCA propagamos: una falla de log no debe tumbar la acción principal.
    logger.error('Error registrando auditoría', {
      accion,
      entidadTipo,
      entidadId,
      adminId: req.user?.id,
      error: error.message,
    });
  }
}
