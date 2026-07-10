/**
 * Modelo `HomeHero` (Fase 12d).
 *
 * Maneja 2 tablas:
 *   - `home_hero_settings`: singleton con la config global del hero
 *     (4 toggles + textos editables). SIEMPRE tiene exactamente 1 fila
 *     con id=1. El backend lo garantiza con un `INSERT ... ON DUPLICATE
 *     KEY UPDATE` defensivo en `getSettings()`.
 *   - `home_hero_buttons`: 0..N botones custom (CRUD libre).
 *
 * Decisiones:
 *   - `getSettings()` siempre devuelve una fila válida, incluso si la
 *     tabla está vacía. Esto es importante porque el endpoint público
 *     `GET /api/home/hero` no puede fallar por una fila faltante.
 *   - `getHeroCompleto()` une las 2 tablas en una sola llamada
 *     (settings + solo buttons activos, ordenados). Es lo que consume
 *     la home pública.
 *   - `reorderButtons()` hace un UPDATE batch dentro de una transacción
 *     para que la reasignación de `orden` sea atómica. Si dos admins
 *     reordenan a la vez, no queda en estado intermedio.
 *   - Sin timestamps "creado_en" en settings (es singleton, no se
 *     "crea"). `actualizado_en` se maneja con NOW() del lado DB.
 *   - En `createButton` se asigna `orden = id` automáticamente para
 *     que el orden natural de creación sea estable (no se "amontonan"
 *     en orden=0).
 *
 * Patrón: SQL crudo con mysql2/promise (igual que `HomeMedia.js`,
 * `Restaurante.js`, etc.). No usamos ORM en este proyecto.
 */
import { query, queryOne, getConnection } from '../config/database.js';

/** Defaults que coinciden con la migración. Los usamos en `getSettings`
 *  para construir la fila singleton si por algún motivo está vacía. */
const SETTINGS_DEFAULTS = Object.freeze({
  mostrar_titulo: 1,
  titulo_pre: 'Pide lo que',
  titulo_post: 'Amas',
  mostrar_subtitulo: 1,
  subtitulo_pre: 'Descubre los mejores locales de',
  subtitulo_bold: 'Gigante',
  subtitulo_post: 'en tu dispositivo',
  mostrar_buscador: 1,
  buscador_placeholder: 'Buscar local, producto o categoría...',
  mostrar_badge_locales: 1,
  badge_locales_pre: 'Más de',
  badge_locales_sufijo: 'locales disponibles',
});

/** Columnas permitidas en `updateSettings` (whitelist defensivo). */
const SETTINGS_ALLOWED = Object.freeze([
  'mostrar_titulo', 'titulo_pre', 'titulo_post',
  'mostrar_subtitulo', 'subtitulo_pre', 'subtitulo_bold', 'subtitulo_post',
  'mostrar_buscador', 'buscador_placeholder',
  'mostrar_badge_locales', 'badge_locales_pre', 'badge_locales_sufijo',
]);

/** Columnas permitidas en `createButton` / `updateButton` (whitelist). */
const BUTTON_ALLOWED = Object.freeze([
  'label', 'url', 'variant', 'icono',
  'orden', 'activo', 'nueva_pestana',
]);

// ============ SETTINGS (singleton) ============

/**
 * Devuelve la fila singleton de settings. Si por algún motivo no existe
 * (caso borde: la migración corrió pero la fila no se insertó), la
 * crea con defaults usando `INSERT ... ON DUPLICATE KEY UPDATE id=id`
 * (idempotente) y reintenta la lectura.
 *
 * Decisión: la fila SIEMPRE existe (sembrada en la migración). Este
 * upsert defensivo cubre el caso de bases de datos creadas ANTES de
 * la migración (no aplica a deploys limpios, pero sí a seeds).
 *
 * @returns {Promise<object>} fila de settings con keys en snake_case
 */
export async function getSettings() {
  let row = await queryOne(
    `SELECT * FROM home_hero_settings WHERE id = 1 LIMIT 1`
  );
  if (!row) {
    // Fila singleton faltante. La creamos con defaults idempotentemente.
    // ON DUPLICATE KEY UPDATE id=id no modifica nada si ya existe, y
    // el INSERT inicial la crea si no. Después re-leemos.
    await query(
      `INSERT INTO home_hero_settings (id) VALUES (1)
       ON DUPLICATE KEY UPDATE id = id`
    );
    row = await queryOne(
      `SELECT * FROM home_hero_settings WHERE id = 1 LIMIT 1`
    );
  }
  return row;
}

/**
 * Actualiza la fila singleton de settings. Acepta solo las columnas de
 * SETTINGS_ALLOWED (whitelist defensivo). Los booleanos se coerciónan
 * a 0/1 explícitamente. Devuelve la fila actualizada.
 *
 * @param {object} patch - objeto con keys en SETTINGS_ALLOWED
 * @param {number|null} userId - id del admin que está editando (auditoría)
 * @returns {Promise<object>} fila actualizada
 */
export async function updateSettings(patch, userId) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('patch debe ser un objeto');
  }

  // Construir SET clause solo con columnas whitelisteadas.
  const fields = [];
  const values = [];
  for (const key of Object.keys(patch)) {
    if (!SETTINGS_ALLOWED.includes(key)) continue;
    let val = patch[key];
    // Coerción: booleanos a 0/1 (MySQL TINYINT).
    if (typeof SETTINGS_DEFAULTS[key] === 'number') {
      val = val ? 1 : 0;
    } else if (typeof val === 'string') {
      val = val.trim();
    }
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) {
    // Nada para actualizar → devolvemos la fila actual.
    return getSettings();
  }

  // Auditoría.
  fields.push('actualizado_en = NOW()');
  if (userId) {
    fields.push('actualizado_por = ?');
    values.push(Number(userId));
  }

  await query(
    `UPDATE home_hero_settings SET ${fields.join(', ')} WHERE id = 1`,
    values
  );
  return getSettings();
}

// ============ BUTTONS (CRUD libre) ============

/**
 * Lista todos los botones (activos e inactivos). Orden estable por
 * `orden ASC, id ASC`. Usado por el admin (muestra el switch ON/OFF
 * de cada uno) — el endpoint público usa `listActiveButtons()`.
 *
 * @returns {Promise<object[]>} array de filas
 */
export async function listButtons() {
  return query(
    `SELECT id, label, url, variant, icono, orden, activo, nueva_pestana,
            creado_en, actualizado_en
       FROM home_hero_buttons
      ORDER BY orden ASC, id ASC`
  );
}

/** Lista solo los botones activos (los que se muestran en la home). */
export async function listActiveButtons() {
  return query(
    `SELECT id, label, url, variant, icono, orden, activo, nueva_pestana
       FROM home_hero_buttons
      WHERE activo = 1
      ORDER BY orden ASC, id ASC`
  );
}

/** Devuelve un botón por id, o null. */
export async function getButtonById(id) {
  if (!id) return null;
  return queryOne(
    `SELECT * FROM home_hero_buttons WHERE id = ? LIMIT 1`,
    [Number(id)]
  );
}

/**
 * Crea un botón nuevo. Acepta solo campos whitelisteados. El `orden` se
 * asigna automáticamente al `id` resultante para que el orden natural
 * de creación sea estable (no se amontonan en 0).
 *
 * @returns {Promise<{id: number, button: object}>}
 */
export async function createButton(patch) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('patch debe ser un objeto');
  }
  // Solo nos quedamos con los campos permitidos.
  const data = {};
  for (const key of Object.keys(patch)) {
    if (BUTTON_ALLOWED.includes(key)) data[key] = patch[key];
  }
  // Defaults razonables si el caller no los manda.
  if (!data.label) throw new Error('label es requerido');
  if (!data.url) throw new Error('url es requerida');
  if (data.variant && !['primary', 'secondary', 'outline'].includes(data.variant)) {
    throw new Error(`variant inválido: ${data.variant}`);
  }

  // 1) INSERT.
  const r = await query(
    `INSERT INTO home_hero_buttons
       (label, url, variant, icono, orden, activo, nueva_pestana)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(data.label).trim().slice(0, 80),
      String(data.url).trim().slice(0, 500),
      data.variant || 'primary',
      data.icono || null,
      Number.isFinite(Number(data.orden)) ? Number(data.orden) : 0,
      data.activo === false ? 0 : 1,
      data.nueva_pestana === false ? 0 : 1,
    ]
  );
  const newId = r.insertId;
  // 2) Si no vino `orden` explícito, lo asignamos al id (estabilidad).
  if (!Number.isFinite(Number(data.orden))) {
    await query(
      `UPDATE home_hero_buttons SET orden = ? WHERE id = ?`,
      [newId, newId]
    );
  }
  const button = await getButtonById(newId);
  return { id: newId, button };
}

/**
 * Actualiza un botón existente. Acepta solo campos whitelisteados.
 * Maneja la coerción de tipos (booleanos a 0/1). Si no se pasan campos,
 * devuelve el botón sin cambios.
 *
 * @returns {Promise<{ok: boolean, button: object|null}>}
 */
export async function updateButton(id, patch) {
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) {
    throw new Error('id debe ser un entero positivo');
  }
  if (!patch || typeof patch !== 'object') {
    throw new Error('patch debe ser un objeto');
  }
  const existing = await getButtonById(numId);
  if (!existing) return { ok: false, button: null };

  const fields = [];
  const values = [];
  for (const key of Object.keys(patch)) {
    if (!BUTTON_ALLOWED.includes(key)) continue;
    let val = patch[key];
    if (key === 'variant' && !['primary', 'secondary', 'outline'].includes(val)) {
      throw new Error(`variant inválido: ${val}`);
    }
    if (key === 'label' || key === 'url' || key === 'icono') {
      val = val === null || val === undefined ? null : String(val).trim().slice(0, key === 'icono' ? 40 : (key === 'label' ? 80 : 500));
    }
    if (['activo', 'nueva_pestana'].includes(key)) {
      val = val ? 1 : 0;
    }
    if (key === 'orden') {
      val = Number.isFinite(Number(val)) ? Number(val) : 0;
    }
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) {
    return { ok: true, button: existing };
  }
  fields.push('actualizado_en = NOW()');
  values.push(numId);

  await query(
    `UPDATE home_hero_buttons SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  const button = await getButtonById(numId);
  return { ok: true, button };
}

/** Borra un botón por id. Devuelve affectedRows (0 o 1). */
export async function deleteButton(id) {
  const r = await query(
    `DELETE FROM home_hero_buttons WHERE id = ?`,
    [Number(id)]
  );
  return r.affectedRows;
}

/**
 * Reordena los botones según el array de ids provisto. El primer id
 * queda con `orden=0`, el segundo con `orden=1`, etc. Atómico: si algo
 * falla, no queda en estado intermedio.
 *
 * Útil para el drag & drop del admin (mismo patrón que los
 * modificadores del POS Fase 10).
 *
 * @param {number[]} ids - array de ids en el orden deseado
 * @returns {Promise<{ok: boolean, count: number}>}
 */
export async function reorderButtons(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids debe ser un array no vacío');
  }
  const numIds = ids.map((i) => Number(i)).filter((n) => Number.isFinite(n) && n > 0);
  if (numIds.length !== ids.length) {
    throw new Error('todos los ids deben ser enteros positivos');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < numIds.length; i++) {
      await connection.query(
        `UPDATE home_hero_buttons SET orden = ?, actualizado_en = NOW() WHERE id = ?`,
        [i, numIds[i]]
      );
    }
    await connection.commit();
    return { ok: true, count: numIds.length };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

// ============ Helper público (home) ============

/**
 * Une settings + buttons activos en una sola respuesta. Es lo que
 * consume `GET /api/home/hero` para evitar 2 round-trips del cliente.
 *
 * @returns {Promise<{settings: object, buttons: object[]}>}
 */
export async function getHeroCompleto() {
  const [settings, buttons] = await Promise.all([
    getSettings(),
    listActiveButtons(),
  ]);
  return {
    settings: settings || { ...SETTINGS_DEFAULTS },
    buttons: buttons || [],
  };
}

export default {
  // settings
  getSettings,
  updateSettings,
  // buttons
  listButtons,
  listActiveButtons,
  getButtonById,
  createButton,
  updateButton,
  deleteButton,
  reorderButtons,
  // helper público
  getHeroCompleto,
};
