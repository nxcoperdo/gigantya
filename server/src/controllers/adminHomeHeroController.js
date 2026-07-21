/**
 * Controller admin: CMS de configuración del Hero de la Home (Fase 12d).
 *
 * Endpoints (todos protegidos por `requireAdmin` desde `adminRoutes.js`):
 *   - GET    /api/admin/home-hero/settings          → getSettings
 *   - PUT    /api/admin/home-hero/settings          → updateSettings
 *   - GET    /api/admin/home-hero/buttons           → listButtons
 *   - POST   /api/admin/home-hero/buttons           → createButton
 *   - PUT    /api/admin/home-hero/buttons/:id       → updateButton
 *   - DELETE /api/admin/home-hero/buttons/:id       → deleteButton
 *   - POST   /api/admin/home-hero/buttons/reorder   → reorderButtons
 *
 * Fase 12d: el super-admin puede editar los 4 textos del hero (con
 * toggle ON/OFF cada uno) y agregar N botones custom (label + URL +
 * variant + icono + orden + activo) que aparecen sobre el banner.
 *
 * Decisiones:
 *   - Whitelist de iconos (9 nombres de lucide-react) y de variants
 *     (3 valores) aplicada en el controller. Esto previene que el admin
 *     inyecte strings raros y mantiene el bundle chico.
 *   - Whitelist de campos en `patch` (BUTTON_ALLOWED) se delega al
 *     modelo, no se duplica aquí.
 *   - Validación de URL: regex simple `^(https?:\/\/|\/[^/]|\/\/[^/])`
 *     que acepta http(s) absoluto, path interno (ej: /admin) y
 *     protocol-relative (//cdn.example.com/...). Rechaza `javascript:`
 *     y `data:` (riesgos XSS).
 *   - Validación de `label`: 1-80 chars, trim. Si el admin manda solo
 *     espacios, 400 EMPTY_LABEL.
 *   - `reorderButtons` valida que todos los ids existan antes de
 *     reordenar (evita huecos si mandan ids fantasma).
 */
import * as HomeHero from '../models/HomeHero.js';

/** Whitelist de iconos de lucide-react soportados por el cliente.
 *  Si admin manda otro, error 400 INVALID_ICON. */
const ALLOWED_ICONS = Object.freeze([
  'MessageCircle', 'MapPin', 'Store', 'Phone', 'ExternalLink',
  'ShoppingBag', 'Coffee', 'ChevronRight', 'Send',
]);

/** Whitelist de variants. */
const ALLOWED_VARIANTS = Object.freeze(['primary', 'secondary', 'outline']);

/** Regex simple para URL: acepta http(s), path interno y protocol-rel. */
const URL_RE = /^(https?:\/\/|\/[^/]|\/\/[^/])/;

/** Helper: valida que el usuario sea admin. 403 si no. */
function ensureAdmin(req, res) {
  if (req.user?.tipo_usuario !== 'admin') {
    res.status(403).json({ error: 'Solo administradores pueden gestionar el hero' });
    return false;
  }
  return true;
}

/** Helper: valida una URL según la whitelist. */
function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.length > 500) return false;
  // Rechaza javascript:, data:, vbscript: (defensivo).
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  return URL_RE.test(trimmed);
}

// ============ SETTINGS ============

/** GET /api/admin/home-hero/settings */
export async function getSettings(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const settings = await HomeHero.getSettings();
    res.json({ settings });
  } catch (error) {
    console.error('[adminHomeHero] getSettings error:', error);
    res.status(500).json({ error: 'Error obteniendo configuración del hero', detalles: error.message });
  }
}

/**
 * PUT /api/admin/home-hero/settings
 * Body: objeto con las columnas permitidas. Cualquier campo desconocido
 * se ignora silenciosamente (whitelist defensivo en el modelo).
 */
export async function updateSettings(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const patch = req.body || {};
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }
    const settings = await HomeHero.updateSettings(patch, req.user.id);
    res.json({ mensaje: 'Configuración del hero actualizada', settings });
  } catch (error) {
    console.error('[adminHomeHero] updateSettings error:', error);
    res.status(500).json({ error: 'Error actualizando configuración del hero', detalles: error.message });
  }
}

// ============ BUTTONS ============

/** GET /api/admin/home-hero/buttons — todos, orden estable. */
export async function listButtons(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const buttons = await HomeHero.listButtons();
    res.json({ total: buttons.length, buttons });
  } catch (error) {
    console.error('[adminHomeHero] listButtons error:', error);
    res.status(500).json({ error: 'Error listando botones del hero', detalles: error.message });
  }
}

/**
 * POST /api/admin/home-hero/buttons
 * Body: { label, url, variant?, icono?, nueva_pestana? }
 * `orden` y `activo` se asignan automáticamente.
 */
export async function createButton(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const { label, url, variant, icono, nueva_pestana, orden } = req.body || {};

    // Validación de label.
    if (typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'El label del botón es requerido', code: 'EMPTY_LABEL' });
    }
    if (label.trim().length > 80) {
      return res.status(400).json({ error: 'El label no puede tener más de 80 caracteres' });
    }

    // Validación de URL.
    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: 'URL inválida. Aceptamos http(s)://, /ruta-interna o //cdn.example.com/',
        code: 'INVALID_URL',
      });
    }

    // Validación de variant.
    if (variant && !ALLOWED_VARIANTS.includes(variant)) {
      return res.status(400).json({
        error: `Variant inválido. Valores permitidos: ${ALLOWED_VARIANTS.join(', ')}`,
        code: 'INVALID_VARIANT',
      });
    }

    // Validación de icono.
    if (icono !== undefined && icono !== null && icono !== '') {
      if (typeof icono !== 'string' || !ALLOWED_ICONS.includes(icono)) {
        return res.status(400).json({
          error: `Icono no soportado. Valores permitidos: ${ALLOWED_ICONS.join(', ')}`,
          code: 'INVALID_ICON',
        });
      }
    }

    const { id, button } = await HomeHero.createButton({
      label: label.trim(),
      url: url.trim(),
      variant: variant || 'primary',
      icono: icono || null,
      nueva_pestana: nueva_pestana !== false, // default true
      orden: Number.isFinite(Number(orden)) ? Number(orden) : undefined,
    });

    res.status(201).json({ mensaje: 'Botón creado', id, button });
  } catch (error) {
    console.error('[adminHomeHero] createButton error:', error);
    res.status(500).json({ error: 'Error creando botón del hero', detalles: error.message });
  }
}

/**
 * PUT /api/admin/home-hero/buttons/:id
 * Body: cualquier subset de { label, url, variant, icono, orden, activo, nueva_pestana }
 */
export async function updateButton(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      return res.status(400).json({ error: 'id inválido' });
    }
    const patch = req.body || {};
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    // Validaciones (solo si vienen los campos en el patch).
    if (patch.label !== undefined) {
      if (typeof patch.label !== 'string' || !patch.label.trim()) {
        return res.status(400).json({ error: 'El label no puede estar vacío', code: 'EMPTY_LABEL' });
      }
      if (patch.label.trim().length > 80) {
        return res.status(400).json({ error: 'El label no puede tener más de 80 caracteres' });
      }
    }
    if (patch.url !== undefined && !isValidUrl(patch.url)) {
      return res.status(400).json({
        error: 'URL inválida. Aceptamos http(s)://, /ruta-interna o //cdn.example.com/',
        code: 'INVALID_URL',
      });
    }
    if (patch.variant !== undefined && !ALLOWED_VARIANTS.includes(patch.variant)) {
      return res.status(400).json({
        error: `Variant inválido. Valores permitidos: ${ALLOWED_VARIANTS.join(', ')}`,
        code: 'INVALID_VARIANT',
      });
    }
    if (patch.icono !== undefined && patch.icono !== null && patch.icono !== '') {
      if (typeof patch.icono !== 'string' || !ALLOWED_ICONS.includes(patch.icono)) {
        return res.status(400).json({
          error: `Icono no soportado. Valores permitidos: ${ALLOWED_ICONS.join(', ')}`,
          code: 'INVALID_ICON',
        });
      }
    }

    // Normalizar valores antes de pasar al modelo.
    const normalized = { ...patch };
    if (normalized.label) normalized.label = normalized.label.trim();
    if (normalized.url) normalized.url = normalized.url.trim();

    const { ok, button } = await HomeHero.updateButton(numId, normalized);
    if (!ok) {
      return res.status(404).json({ error: 'Botón no encontrado' });
    }
    res.json({ mensaje: 'Botón actualizado', button });
  } catch (error) {
    console.error('[adminHomeHero] updateButton error:', error);
    res.status(500).json({ error: 'Error actualizando botón del hero', detalles: error.message });
  }
}

/** DELETE /api/admin/home-hero/buttons/:id */
export async function deleteButton(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      return res.status(400).json({ error: 'id inválido' });
    }
    const existing = await HomeHero.getButtonById(numId);
    if (!existing) {
      return res.status(404).json({ error: 'Botón no encontrado' });
    }
    await HomeHero.deleteButton(numId);
    res.json({ mensaje: 'Botón eliminado', id: numId });
  } catch (error) {
    console.error('[adminHomeHero] deleteButton error:', error);
    res.status(500).json({ error: 'Error eliminando botón del hero', detalles: error.message });
  }
}

/**
 * POST /api/admin/home-hero/buttons/reorder
 * Body: { ids: number[] } — array de ids en el orden deseado.
 * El primer id queda con orden=0, etc.
 */
export async function reorderButtons(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids debe ser un array no vacío' });
    }
    // Validar que todos los ids existan (evita huecos).
    const existing = await HomeHero.listButtons();
    const existingIds = new Set(existing.map((b) => Number(b.id)));
    const unknown = ids.filter((i) => !existingIds.has(Number(i)));
    if (unknown.length > 0) {
      return res.status(400).json({
        error: `Hay ids que no existen: ${unknown.join(', ')}`,
        code: 'UNKNOWN_IDS',
      });
    }
    const { count } = await HomeHero.reorderButtons(ids);
    res.json({ mensaje: 'Botones reordenados', count });
  } catch (error) {
    console.error('[adminHomeHero] reorderButtons error:', error);
    res.status(500).json({ error: 'Error reordenando botones del hero', detalles: error.message });
  }
}

export default {
  getSettings,
  updateSettings,
  listButtons,
  createButton,
  updateButton,
  deleteButton,
  reorderButtons,
};
