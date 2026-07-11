/**
 * Controller admin: CMS de banner de Home (Fase 12c).
 *
 * Endpoints (todos protegidos por `requireAdmin` desde `adminRoutes.js`):
 *   - GET    /api/admin/home-media                       → list (lee filesystem + DB)
 *   - POST   /api/admin/home-media                       → upload (multipart 'file')
 *   - PUT    /api/admin/home-media/:archivo/activate     → setActivo (con upsert)
 *   - DELETE /api/admin/home-media/:archivo              → deleteMedia
 *
 * Fase 12c: el admin puede SUBIR banners desde la UI. Los archivos
 * viven en `server/uploads/home-media-uploaded/` (mismo `createUploader`
 * que usa el resto del proyecto: products, comprobantes, etc.) y se
 * sirven por la URL `/media/<archivo>` montada en app.js.
 *
 * Decisiones:
 *   - `list` lee el filesystem de `server/uploads/home-media-uploaded/`
 *     y cruza con la DB para saber cuál está activo y obtener nombre/id.
 *   - `upload` usa multer (vía `createUploader` con subdir). Valida
 *     que el archivo sea de tipo soportado (imagen o video) y un soft
 *     cap de 20 archivos en la carpeta.
 *   - `setActivo` recibe el nombre del archivo (no el id) y hace upsert
 *     transaccional: si la fila no existe, la crea con activo=1.
 *   - `deleteMedia` borra el archivo físico + la fila de la DB. Solo
 *     permite borrar archivos NO activos (400 con `CANNOT_DELETE_ACTIVE`
 *     si es el activo).
 *   - Los tipos de archivo se derivan por extensión, no por magic bytes.
 *     Es suficiente para este caso (jpg/png/webp/mp4/webm) y evita una
 *     dep extra.
 */
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../middleware/uploadMiddleware.js';
import * as HomeMedia from '../models/HomeMedia.js';

const HOME_MEDIA_DIR = path.join(UPLOADS_DIR, 'home-media-uploaded');
const MAX_FILES = 20;

/** Mapa de extensión → { tipo, mime }. Coincide con los filtros del
 *  frontend (accept="image/*,video/mp4,video/webm") y del
 *  createUploader. */
const EXT_TO_TYPE = {
  jpg:  { tipo: 'imagen', mime: 'image/jpeg' },
  jpeg: { tipo: 'imagen', mime: 'image/jpeg' },
  png:  { tipo: 'imagen', mime: 'image/png' },
  webp: { tipo: 'imagen', mime: 'image/webp' },
  gif:  { tipo: 'imagen', mime: 'image/gif' },
  avif: { tipo: 'imagen', mime: 'image/avif' },
  mp4:  { tipo: 'video', mime: 'video/mp4' },
  webm: { tipo: 'video', mime: 'video/webm' },
  mov:  { tipo: 'video', mime: 'video/quicktime' },
};

/** Cuenta cuántos archivos de media hay en la carpeta (sin contar
 *  .gitkeep ni archivos que no sean de tipo soportado). Se usa para
 *  el soft cap del upload. */
function countFilesInDir() {
  if (!fs.existsSync(HOME_MEDIA_DIR)) return 0;
  const all = fs.readdirSync(HOME_MEDIA_DIR);
  return all.filter((f) => {
    if (f.startsWith('.')) return false;
    const ext = path.extname(f).slice(1).toLowerCase();
    return EXT_TO_TYPE[ext] !== undefined;
  }).length;
}

/**
 * GET /api/admin/home-media
 *
 * Lee los archivos de server/uploads/home-media-uploaded/ y los
 * cruza con la DB. Devuelve un array con info de cada archivo. Los
 * que NO están en la DB aparecen con `activo: 0` y `id: null`
 * (todavía no se "activaron" nunca). Los que están en la DB pero
 * NO en disco NO aparecen (huérfanos).
 */
export async function list(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver banners' });
    }

    if (!fs.existsSync(HOME_MEDIA_DIR)) {
      console.warn(`[adminHomeMedia] Directorio no existe: ${HOME_MEDIA_DIR}`);
      return res.json({ total: 0, items: [] });
    }

    const allFiles = fs.readdirSync(HOME_MEDIA_DIR);
    const mediaFiles = allFiles.filter((f) => {
      if (f.startsWith('.')) return false;
      const ext = path.extname(f).slice(1).toLowerCase();
      return EXT_TO_TYPE[ext] !== undefined;
    });

    if (mediaFiles.length === 0) {
      return res.json({ total: 0, items: [] });
    }

    const dbRows = await HomeMedia.listAll();
    const dbByArchivo = new Map();
    for (const row of dbRows) {
      if (row.archivo) dbByArchivo.set(row.archivo, row);
    }

    const items = mediaFiles.map((archivo) => {
      const ext = path.extname(archivo).slice(1).toLowerCase();
      const { tipo, mime } = EXT_TO_TYPE[ext];
      let size_bytes = 0;
      try {
        const stat = fs.statSync(path.join(HOME_MEDIA_DIR, archivo));
        size_bytes = stat.size;
      } catch (statErr) {
        console.warn(`[adminHomeMedia] stat falló para ${archivo}:`, statErr.message);
      }
      const dbRow = dbByArchivo.get(archivo);
      return {
        id: dbRow?.id ?? null,
        nombre: dbRow?.nombre ?? path.basename(archivo, path.extname(archivo)),
        archivo,
        tipo,
        mime,
        size_bytes,
        activo: Number(dbRow?.activo || 0),
      };
    });

    items.sort((a, b) => {
      if (a.activo !== b.activo) return b.activo - a.activo;
      return a.archivo.localeCompare(b.archivo);
    });

    res.json({ total: items.length, items });
  } catch (error) {
    console.error('[adminHomeMedia] list error:', error);
    res.status(500).json({ error: 'Error listando banners', detalles: error.message });
  }
}

/**
 * POST /api/admin/home-media
 * multipart/form-data con field 'file' (multer.single, vía createUploader)
 * body: { nombre?: string } — si no viene, se usa el basename del archivo.
 */
export async function upload(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden subir banners' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo (field "file")' });
    }

    // Soft cap.
    const total = countFilesInDir();
    if (total >= MAX_FILES) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
      return res.status(400).json({
        error: `Máximo ${MAX_FILES} banners. Borra alguno antes de subir más.`,
        currentCount: total,
        maxAllowed: MAX_FILES,
      });
    }

    // Validar tipo por extensión (el createUploader ya filtra MIME/ext,
    // pero validamos de nuevo para mensajes de error claros).
    const archivo = req.file.filename;
    const ext = path.extname(archivo).slice(1).toLowerCase();
    const typeInfo = EXT_TO_TYPE[ext];
    if (!typeInfo) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
      return res.status(400).json({
        error: `Tipo de archivo no soportado: .${ext}. Solo imágenes o videos.`,
      });
    }
    const { tipo, mime } = typeInfo;

    // Nombre humano.
    const nombre = (req.body?.nombre || path.basename(archivo, path.extname(archivo)))
      .toString()
      .slice(0, 150) || 'Banner';

    res.status(201).json({
      mensaje: 'Banner subido correctamente',
      nombre,
      archivo,
      tipo,
      mime,
      size_bytes: req.file.size,
    });
  } catch (error) {
    console.error('[adminHomeMedia] upload error:', error);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
    }
    res.status(500).json({ error: 'Error subiendo banner', detalles: error.message });
  }
}

/**
 * PUT /api/admin/home-media/:archivo/activate
 *
 * Marca el banner identificado por `archivo` (nombre del archivo en
 * server/uploads/home-media-uploaded/) como activo. Si la fila no
 * existe en la DB, la crea con activo=1 (upsert transaccional).
 */
export async function setActivo(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden activar banners' });
    }
    const { archivo } = req.params;
    if (!archivo) {
      return res.status(400).json({ error: 'Falta el parámetro archivo' });
    }

    // Validar que el archivo existe en disco.
    const filePath = path.join(HOME_MEDIA_DIR, archivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: `El archivo "${archivo}" no existe en server/uploads/home-media-uploaded/`,
      });
    }
    const ext = path.extname(archivo).slice(1).toLowerCase();
    const typeInfo = EXT_TO_TYPE[ext];
    if (!typeInfo) {
      return res.status(400).json({
        error: `Tipo de archivo no soportado: .${ext}.`,
      });
    }

    let size_bytes = 0;
    try {
      const stat = fs.statSync(filePath);
      size_bytes = stat.size;
    } catch (_) { /* no bloqueante */ }
    const { tipo, mime } = typeInfo;
    const nombre = path.basename(archivo, path.extname(archivo));

    const result = await HomeMedia.upsertAndActivate({
      archivo,
      nombre,
      tipo,
      mime,
      size_bytes,
      subido_por: req.user.id,
    });

    if (!result.ok) {
      return res.status(500).json({ error: 'Error activando banner' });
    }

    const activo = await HomeMedia.getActivo();
    res.json({
      mensaje: result.alreadyActive
        ? 'Este banner ya estaba activo'
        : (result.created
            ? 'Banner creado y activado correctamente'
            : 'Banner activado correctamente'),
      activo,
    });
  } catch (error) {
    console.error('[adminHomeMedia] setActivo error:', error);
    res.status(500).json({ error: 'Error activando banner', detalles: error.message });
  }
}

/**
 * DELETE /api/admin/home-media/:archivo
 *
 * Borra el archivo del disco y la fila de la DB. Solo permite
 * borrar archivos NO activos (400 con `CANNOT_DELETE_ACTIVE` si
 * es el activo).
 */
export async function deleteMedia(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden borrar banners' });
    }
    const { archivo } = req.params;
    if (!archivo) {
      return res.status(400).json({ error: 'Falta el parámetro archivo' });
    }

    // 1) Verificar que la fila existe y NO es el activo.
    const dbRow = await HomeMedia.getByArchivo(archivo);
    if (dbRow && Number(dbRow.activo) === 1) {
      return res.status(400).json({
        error: 'No se puede borrar el banner activo. Primero activá otro.',
        code: 'CANNOT_DELETE_ACTIVE',
      });
    }

    // 2) Borrar el archivo físico.
    const filePath = path.join(HOME_MEDIA_DIR, archivo);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn(`[adminHomeMedia] No se pudo borrar archivo físico ${filePath}:`, unlinkErr.message);
      }
    }

    // 3) Borrar la fila de la DB (si existe).
    if (dbRow) {
      await HomeMedia.deleteById(dbRow.id);
    }

    res.json({ mensaje: 'Banner borrado', archivo });
  } catch (error) {
    console.error('[adminHomeMedia] delete error:', error);
    res.status(500).json({ error: 'Error borrando banner', detalles: error.message });
  }
}

export default {
  list,
  upload,
  setActivo,
  deleteMedia,
};
