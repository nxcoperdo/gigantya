/**
 * Modelo `LegalAcceptance.js` — log de aceptaciones de documentos legales.
 *
 * Patrón: SQL crudo con `query` / `queryOne` de `config/database.js`,
 * igual que el resto de modelos del proyecto (HomeMedia.js, HomeHero.js).
 *
 * Tipos de documento soportados (whitelist — se valida en cada método
 * que acepta un `tipo`):
 *   - 'tyc'        → Términos y Condiciones (TyC)
 *   - 'privacidad' → Política de Tratamiento de Datos Personales
 *   - 'cookies'    → Política de Cookies
 *   - 'merchant'   → Acuerdo Comercial con Restaurantes
 *
 * Por qué un modelo tan simple: la tabla es básicamente un log append-only.
 * No hay UPDATE (las aceptaciones son inmutables para auditoría legal) ni
 * DELETE desde la app. Los métodos son esencialmente:
 *   - `record({...})` → INSERT
 *   - `getByUsuario(usuarioId)` → SELECT
 *   - `getByRestaurante(restauranteId)` → SELECT
 *   - `hasAccepted(usuarioId, tipo, version)` → SELECT EXISTS
 *   - `getLatestByUsuario(usuarioId, tipo)` → última versión aceptada
 */
import { query, queryOne } from '../config/database.js';

// Versión actual de cada documento. Se centraliza acá para que el
// frontend y backend consulten la misma fuente de verdad.
// Si en el futuro se actualiza un documento, solo se cambia esta constante
// y se documenta en el changelog.
export const CURRENT_VERSIONS = {
  tyc:        'v1.0-2026-07-10',
  privacidad: 'v1.0-2026-07-10',
  cookies:    'v1.0-2026-07-10',
  merchant:   'v1.0-2026-07-10',
};

const ALLOWED_TYPES = ['tyc', 'privacidad', 'cookies', 'merchant'];

/**
 * Registra una aceptación de documento legal.
 * Retorna el id del registro insertado.
 */
export async function record({ usuario_id, restaurante_id, tipo, version, ip, user_agent }) {
  // Whitelist defensiva: si llega un tipo raro, fallamos temprano con
  // un error claro. Esto evita SQL injection por tipo malformado.
  if (!ALLOWED_TYPES.includes(tipo)) {
    throw new Error(`Tipo de documento legal inválido: ${tipo}`);
  }
  if (!version || typeof version !== 'string') {
    throw new Error('version es requerida y debe ser string');
  }

  // Defensiva: usuario_id y restaurante_id pueden ser NULL (visitante
  // anónimo), pero si vienen, deben ser enteros.
  const sanitizedUsuarioId = usuario_id != null ? parseInt(usuario_id, 10) : null;
  const sanitizedRestauranteId = restaurante_id != null ? parseInt(restaurante_id, 10) : null;
  const sanitizedIp = ip ? String(ip).substring(0, 45) : null;
  // user_agent puede ser largo (algunos browsers mandan >500 chars).
  // Lo truncamos a 1000 chars para no inflar la tabla.
  const sanitizedUA = user_agent ? String(user_agent).substring(0, 1000) : null;

  const sql = `
    INSERT INTO aceptaciones_legales
      (usuario_id, restaurante_id, tipo, version, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [sanitizedUsuarioId, sanitizedRestauranteId, tipo, version, sanitizedIp, sanitizedUA];

  const result = await query(sql, params);
  return result.insertId;
}

/**
 * Lista todas las aceptaciones de un usuario, ordenadas de la más
 * reciente a la más vieja.
 */
export async function getByUsuario(usuarioId) {
  const sql = `
    SELECT id, usuario_id, restaurante_id, tipo, version, ip, user_agent, creado_en
    FROM aceptaciones_legales
    WHERE usuario_id = ?
    ORDER BY creado_en DESC
  `;
  return query(sql, [parseInt(usuarioId, 10)]);
}

/**
 * Lista todas las aceptaciones de un restaurante, ordenadas de la más
 * reciente a la más vieja. Usado por el panel del local para mostrar
 * qué versiones del Merchant Agreement firmó.
 */
export async function getByRestaurante(restauranteId) {
  const sql = `
    SELECT id, usuario_id, restaurante_id, tipo, version, ip, user_agent, creado_en
    FROM aceptaciones_legales
    WHERE restaurante_id = ?
    ORDER BY creado_en DESC
  `;
  return query(sql, [parseInt(restauranteId, 10)]);
}

/**
 * Devuelve la última versión aceptada por un usuario para un tipo dado.
 * Útil para el frontend: si el usuario ya aceptó la versión actual,
 * no le mostramos de nuevo el modal.
 */
export async function getLatestByUsuario(usuarioId, tipo) {
  if (!ALLOWED_TYPES.includes(tipo)) {
    throw new Error(`Tipo inválido: ${tipo}`);
  }
  const sql = `
    SELECT id, version, ip, creado_en
    FROM aceptaciones_legales
    WHERE usuario_id = ? AND tipo = ?
    ORDER BY creado_en DESC
    LIMIT 1
  `;
  return queryOne(sql, [parseInt(usuarioId, 10), tipo]);
}

/**
 * Idem para restaurantes. Devuelve la última versión del Merchant
 * Agreement que firmó el local.
 */
export async function getLatestByRestaurante(restauranteId, tipo) {
  if (!ALLOWED_TYPES.includes(tipo)) {
    throw new Error(`Tipo inválido: ${tipo}`);
  }
  const sql = `
    SELECT id, version, ip, creado_en
    FROM aceptaciones_legales
    WHERE restaurante_id = ? AND tipo = ?
    ORDER BY creado_en DESC
    LIMIT 1
  `;
  return queryOne(sql, [parseInt(restauranteId, 10), tipo]);
}

/**
 * Devuelve qué tipos de documento ya fueron aceptados a la versión
 * vigente por un usuario (o por los restaurantes donde es dueño).
 *
 * Es el motor del modal obligatorio: el frontend llama a este método
 * (vía GET /api/legal/estado) y según lo que devuelva, muestra el
 * modal de TyC/Privacidad (clientes) o Merchant (dueños).
 *
 * @param {Object} params
 * @param {number|null} params.usuarioId   - id del usuario logueado
 * @param {number[]}    params.restauranteIds - ids de locales donde es dueño
 * @returns {Promise<{
 *   user:    { tyc: boolean, privacidad: boolean },
 *   merchants: Array<{ restaurante_id: number, merchant: boolean }>
 * }>}
 */
export async function getAcceptedState({ usuarioId, restauranteIds = [] }) {
  const versions = getCurrentVersions();
  const state = {
    user: { tyc: false, privacidad: false },
    merchants: restauranteIds.map((id) => ({
      restaurante_id: parseInt(id, 10),
      merchant: false,
    })),
  };

  // Si no hay nada para chequear, devolver el state vacío.
  if (!usuarioId && restauranteIds.length === 0) return state;

  // 1. Aceptaciones del usuario (TyC + Privacidad)
  if (usuarioId) {
    const sqlUser = `
      SELECT tipo, version
      FROM aceptaciones_legales
      WHERE usuario_id = ?
        AND tipo IN ('tyc', 'privacidad')
      ORDER BY creado_en DESC
    `;
    const rows = await query(sqlUser, [parseInt(usuarioId, 10)]);
    for (const row of rows) {
      if (row.tipo === 'tyc' && row.version === versions.tyc) state.user.tyc = true;
      if (row.tipo === 'privacidad' && row.version === versions.privacidad) state.user.privacidad = true;
    }
  }

  // 2. Aceptaciones de cada local donde es dueño (Merchant Agreement)
  for (const entry of state.merchants) {
    if (!entry.restaurante_id || Number.isNaN(entry.restaurante_id)) continue;
    const sqlRest = `
      SELECT version
      FROM aceptaciones_legales
      WHERE restaurante_id = ? AND tipo = 'merchant'
      ORDER BY creado_en DESC
      LIMIT 1
    `;
    const row = await queryOne(sqlRest, [entry.restaurante_id]);
    if (row && row.version === versions.merchant) entry.merchant = true;
  }

  return state;
}

/**
 * Devuelve todas las versiones actuales de los documentos legales.
 * Lo usa el frontend al montar para saber qué versiones están vigentes
 * y mostrar el badge de "v1.0" en cada página.
 */
export function getCurrentVersions() {
  return { ...CURRENT_VERSIONS };
}
