/**
 * Controller de documentos legales.
 *
 * Endpoints:
 *   GET  /api/legal/version          → devuelve las versiones vigentes
 *   GET  /api/legal/mis-aceptaciones → las aceptaciones del usuario autenticado
 *   POST /api/legal/aceptar          → registra una aceptación
 *
 * Decisiones:
 *   - `GET /version` es público (no requiere auth) porque las páginas
 *     /terminos, /privacidad y /cookies las ve cualquiera y el frontend
 *     necesita saber qué versión mostrar.
 *   - `POST /aceptar` y `GET /mis-aceptaciones` sí requieren auth (verifyToken)
 *     porque registramos quién aceptó qué.
 *   - `POST /aceptar` acepta tanto usuarios como restaurantes
 *     (campo `restaurante_id` opcional en el body). El cliente manda
 *     el que corresponda según su rol.
 *   - Si un visitante anónimo quiere "aceptar" cookies (caso del banner
 *     de la home), se permite con usuario_id=null y restaurante_id=null.
 *     La aceptación queda como log de auditoría pero no se usa para
 *     condicionar nada crítico (las cookies siguen bloqueadas en el
 *     cliente por la preferencia local).
 *   - Validamos `tipo` contra whitelist en el modelo, pero también acá
 *     para devolver 400 con mensaje claro antes de tocar la DB.
 */
import * as LegalModel from '../models/LegalAcceptance.js';

const ALLOWED_TYPES = ['tyc', 'privacidad', 'cookies', 'merchant'];

/**
 * GET /api/legal/version
 * Público. Devuelve las versiones vigentes de cada documento.
 * Cacheable 1h (las versiones cambian rara vez y se cachean por ETag).
 */
export async function getVersion(req, res) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
    res.json({
      versions: LegalModel.getCurrentVersions(),
      updated_at: '2026-07-10',
    });
  } catch (error) {
    console.error('[Legal] Error en getVersion:', error);
    res.status(500).json({ error: 'Error al obtener versiones' });
  }
}

/**
 * GET /api/legal/mis-aceptaciones
 * Requiere auth. Devuelve el historial de aceptaciones del usuario
 * logueado (o de su restaurante si el query trae `restaurante_id`).
 */
export async function getMisAceptaciones(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const aceptaciones = await LegalModel.getByUsuario(userId);
    res.json({ total: aceptaciones.length, aceptaciones });
  } catch (error) {
    console.error('[Legal] Error en getMisAceptaciones:', error);
    res.status(500).json({ error: 'Error al obtener aceptaciones' });
  }
}

/**
 * GET /api/legal/restaurante/:id/aceptaciones
 * Requiere auth (admin o dueño del local).
 * Devuelve las aceptaciones del Merchant Agreement firmadas por el local.
 */
export async function getAceptacionesRestaurante(req, res) {
  try {
    const { id } = req.params;
    const aceptaciones = await LegalModel.getByRestaurante(id);
    res.json({ total: aceptaciones.length, aceptaciones });
  } catch (error) {
    console.error('[Legal] Error en getAceptacionesRestaurante:', error);
    res.status(500).json({ error: 'Error al obtener aceptaciones del restaurante' });
  }
}

/**
 * POST /api/legal/aceptar
 * Requiere auth (aunque permite visitante anónimo para cookies).
 * Body esperado:
 *   {
 *     tipo: 'tyc' | 'privacidad' | 'cookies' | 'merchant',
 *     version: 'v1.0-2026-07-10',
 *     restaurante_id?: number  // solo si es el dueño aceptando Merchant
 *   }
 *
 * Devuelve 201 con { id, creado_en }.
 */
export async function aceptar(req, res) {
  try {
    const { tipo, version, restaurante_id } = req.body || {};

    // 1. Validar tipo
    if (!tipo || !ALLOWED_TYPES.includes(tipo)) {
      return res.status(400).json({
        error: 'Tipo de documento inválido',
        allowed: ALLOWED_TYPES,
      });
    }

    // 2. Validar version (debe matchear una de las vigentes o aceptar
    //    cualquiera que mande el cliente, ya que podríamos estar en
    //    medio de un deploy con versión nueva en backend y viejo en
    //    frontend cacheado)
    if (!version || typeof version !== 'string' || version.length > 40) {
      return res.status(400).json({ error: 'version requerida (string, max 40 chars)' });
    }

    // 3. Determinar IDs de contexto
    const userId = req.user?.id || null;
    let restauranteId = null;
    if (restaurante_id != null) {
      restauranteId = parseInt(restaurante_id, 10);
      if (Number.isNaN(restauranteId)) {
        return res.status(400).json({ error: 'restaurante_id inválido' });
      }
      // Si el usuario está logueado, validar que sea el dueño del local
      // o admin. Para los locales que no son del usuario logueado, el
      // POST requiere rol admin (lo chequeamos en la ruta).
    }

    // 4. Extraer IP y user-agent del request
    //    trust proxy=2 en app.js garantiza que req.ip es la IP real del
    //    cliente (la que viene en cf-connecting-ip / X-Forwarded-For).
    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('User-Agent') || null;

    // 5. Insertar
    const id = await LegalModel.record({
      usuario_id: userId,
      restaurante_id: restauranteId,
      tipo,
      version,
      ip,
      user_agent: userAgent,
    });

    res.status(201).json({
      id,
      tipo,
      version,
      creado_en: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Legal] Error en aceptar:', error);
    res.status(500).json({ error: 'Error al registrar aceptación' });
  }
}

export default {
  getVersion,
  getMisAceptaciones,
  getAceptacionesRestaurante,
  aceptar,
};
