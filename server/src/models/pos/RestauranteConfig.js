/**
 * Modelo `RestauranteConfig` (Fase 8).
 *
 * Wrapper sobre la columna JSON `restaurantes.configuracion_pos`.
 * Decisión: una sola columna JSON en vez de tabla nueva
 * (`restaurante_config`). Razón: ya hay patrón de columnas JSON en
 * `restaurantes` (`configuracion_impuestos`, `configuracion_envios`),
 * una tabla nueva agregaría JOIN extra sin beneficio.
 *
 * Schema default (lo que se devuelve si la columna es NULL):
 *   {
 *     propina_sugerida_porcentaje: 10,
 *     metodos_pago_habilitados: [
 *       'efectivo','transferencia','tarjeta','nequi','daviplata'
 *     ],
 *     formato_impresion: '80mm',
 *     split_bill_habilitado:    true,
 *     transfer_mesa_habilitado: true,
 *     merge_mesa_habilitado:    true,
 *   }
 *
 * El shape se valida con `validateConfig()` antes de guardar. Si llega
 * un campo inválido, se rechaza el PUT entero (fail-fast, sin
 * "guardar lo que se pueda" — el dueño debe ver el error claro).
 */
import { queryOne, query } from '../../config/database.js';

const DEFAULT_CONFIG = Object.freeze({
  propina_sugerida_porcentaje: 10,
  metodos_pago_habilitados: ['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata'],
  formato_impresion: '80mm',
  split_bill_habilitado: true,
  transfer_mesa_habilitado: true,
  merge_mesa_habilitado: true,
});

const VALID_METODOS = new Set(['efectivo', 'transferencia', 'tarjeta', 'mixto', 'nequi', 'daviplata']);
const VALID_FORMATOS = new Set(['80mm', '58mm', 'A4']);

/** Parsea el JSON de la BD, devolviendo el default si es NULL o
 *  malformado. Nunca lanza — los datos viejos deben poder leerse. */
function parseConfig(raw) {
  if (!raw) return { ...DEFAULT_CONFIG };
  let parsed;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return { ...DEFAULT_CONFIG }; }
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    return { ...DEFAULT_CONFIG };
  }
  // Merge con defaults: si el JSON tiene un subset, completamos con
  // defaults. Si tiene claves desconocidas, las ignoramos.
  return {
    propina_sugerida_porcentaje: Number(parsed.propina_sugerida_porcentaje ?? DEFAULT_CONFIG.propina_sugerida_porcentaje),
    metodos_pago_habilitados: Array.isArray(parsed.metodos_pago_habilitados)
      ? parsed.metodos_pago_habilitados.filter((m) => VALID_METODOS.has(m))
      : [...DEFAULT_CONFIG.metodos_pago_habilitados],
    formato_impresion: VALID_FORMATOS.has(parsed.formato_impresion)
      ? parsed.formato_impresion
      : DEFAULT_CONFIG.formato_impresion,
    split_bill_habilitado: parsed.split_bill_habilitado !== false,
    transfer_mesa_habilitado: parsed.transfer_mesa_habilitado !== false,
    merge_mesa_habilitado: parsed.merge_mesa_habilitado !== false,
  };
}

/** Valida un patch parcial contra el schema. Devuelve array de errores
 *  (vacío si está OK). No muta el input. */
export function validateConfig(patch) {
  const errs = [];
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
    return ['El body debe ser un objeto JSON'];
  }
  if ('propina_sugerida_porcentaje' in patch) {
    const v = Number(patch.propina_sugerida_porcentaje);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      errs.push('propina_sugerida_porcentaje debe ser un número entre 0 y 100');
    }
  }
  if ('metodos_pago_habilitados' in patch) {
    if (!Array.isArray(patch.metodos_pago_habilitados)) {
      errs.push('metodos_pago_habilitados debe ser un array');
    } else if (patch.metodos_pago_habilitados.length === 0) {
      errs.push('metodos_pago_habilitados no puede estar vacío');
    } else {
      const invalid = patch.metodos_pago_habilitados.filter((m) => !VALID_METODOS.has(m));
      if (invalid.length) {
        errs.push(`métodos inválidos: ${invalid.join(', ')}`);
      }
    }
  }
  if ('formato_impresion' in patch && !VALID_FORMATOS.has(patch.formato_impresion)) {
    errs.push(`formato_impresion debe ser uno de: ${[...VALID_FORMATOS].join(', ')}`);
  }
  for (const k of ['split_bill_habilitado', 'transfer_mesa_habilitado', 'merge_mesa_habilitado']) {
    if (k in patch && typeof patch[k] !== 'boolean') {
      errs.push(`${k} debe ser boolean`);
    }
  }
  return errs;
}

/** Merge defensivo: dado el config actual y un patch, devuelve el
 *  nuevo config. Si una clave del patch es inválida, se ignora esa
 *  clave (NO se rechaza el patch entero — para no perder el resto
 *  de cambios válidos). */
export function mergeConfig(current, patch) {
  const next = { ...current, ...patch };
  // Re-validar el resultado completo (defensa de tenant: alguien
  // podría haber escrito JSON inválido en la BD).
  return parseConfig(next);
}

/** Lee la config de UN restaurante. Devuelve la versión normalizada
 *  (con defaults aplicados). */
export async function getConfig(restauranteId) {
  const row = await queryOne(
    `SELECT configuracion_pos FROM restaurantes WHERE id = ? LIMIT 1`,
    [Number(restauranteId)]
  );
  if (!row) return null;
  return parseConfig(row.configuracion_pos);
}

/** Update con merge: trae el JSON actual, hace merge con el patch,
 *  guarda. Si `expectedVersion` viene, hace optimistic locking
 *  (no implementado aún — placeholder para futuro, ver [[gigantya-pos-mvp]]). */
export async function updateConfig(restauranteId, patch) {
  // Re-leemos para evitar race conditions con dos updates concurrentes.
  // El SELECT + UPDATE no es atómico a nivel de fila, pero para esta
  // feature (cambios manuales del dueño, baja concurrencia) es OK.
  // Si en el futuro hay problemas, agregar `WHERE json_equals(...)`.
  const actual = await getConfig(restauranteId);
  if (!actual) throw new Error('restaurante no encontrado');
  const merged = mergeConfig(actual, patch);
  await query(
    `UPDATE restaurantes SET configuracion_pos = CAST(? AS JSON) WHERE id = ?`,
    [JSON.stringify(merged), Number(restauranteId)]
  );
  return merged;
}

export const DEFAULT_POS_CONFIG = DEFAULT_CONFIG;
export { VALID_METODOS, VALID_FORMATOS };

export default {
  getConfig,
  updateConfig,
  validateConfig,
  mergeConfig,
  DEFAULT_POS_CONFIG,
};
