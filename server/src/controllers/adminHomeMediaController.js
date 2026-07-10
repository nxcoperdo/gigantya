/**
 * Controller admin: CMS de banner de Home (Fase 12).
 *
 * Endpoints (todos protegidos por `requireAdmin` desde `adminRoutes.js`):
 *   - GET    /api/admin/home-media              → list
 *   - POST   /api/admin/home-media              → upload (multipart 'file')
 *   - PUT    /api/admin/home-media/:id/activate → setActivo
 *   - DELETE /api/admin/home-media/:id          → delete
 *
 * Decisiones:
 *   - El controller hace una segunda verificación de rol (`req.user.tipo_usuario`)
 *     aunque el middleware ya filtra. Es defensivo y consistente con el resto
 *     de los controllers de adminController.js.
 *   - `delete` hace `fs.unlink` del archivo físico para no acumular huérfanos
 *     (es el primer controller del proyecto en hacerlo bien — el resto deja
 *     archivos viejos en disco, ver `restaurantController.js:338-347`).
 *   - `upload` tiene un soft cap de 20 archivos para no llenar el disco.
 *   - El `tipo` se deriva del MIME en el server (no se confía en lo que mande
 *     el cliente). El cliente solo manda el archivo.
 */
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../middleware/uploadMiddleware.js';
import * as HomeMedia from '../models/HomeMedia.js';

const MAX_FILES = 20;

/** GET /api/admin/home-media */
export async function list(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden gestionar banners' });
    }
    const items = await HomeMedia.listAll();
    res.json({ total: items.length, items });
  } catch (error) {
    console.error('[adminHomeMedia] list error:', error);
    res.status(500).json({ error: 'Error listando banners', detalles: error.message });
  }
}

/**
 * POST /api/admin/home-media
 * multipart/form-data con field 'file' (multer.single)
 * body: { nombre?: string } — si no viene, se usa el originalname sin extensión.
 */
export async function upload(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden subir banners' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo (field "file")' });
    }

    // Soft cap para no acumular 200 videos en el VPS.
    const total = await HomeMedia.count();
    if (total >= MAX_FILES) {
      // Borrar el archivo que multer acaba de subir (rollback).
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
      return res.status(400).json({
        error: `Máximo ${MAX_FILES} banners. Borrá alguno antes de subir más.`,
        currentCount: total,
        maxAllowed: MAX_FILES,
      });
    }

    // Derivar `tipo` del MIME (no del nombre del archivo ni del body).
    let tipo = null;
    if (req.file.mimetype && req.file.mimetype.startsWith('image/')) {
      tipo = 'imagen';
    } else if (req.file.mimetype && req.file.mimetype.startsWith('video/')) {
      tipo = 'video';
    } else {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
      return res.status(400).json({
        error: `Tipo de archivo no soportado: ${req.file.mimetype}. Solo imágenes o videos.`,
      });
    }

    // `archivo_path` es relativo a /uploads/, no absoluto: mantiene
    // portabilidad entre local y VPS.
    const archivo_path = `home-media/${req.file.filename}`;

    // Nombre humano: si el admin no mandó uno, usar el nombre original
    // sin extensión. Trim y cap a 150 chars (límite de la columna).
    const nombre = (req.body?.nombre || req.file.originalname || 'Banner')
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 150) || 'Banner';

    const id = await HomeMedia.create({
      nombre,
      archivo_path,
      tipo,
      mime: req.file.mimetype,
      size_bytes: req.file.size,
      subido_por: req.user.id,
    });

    res.status(201).json({
      mensaje: 'Banner subido correctamente',
      id,
      nombre,
      archivo_path,
      tipo,
      mime: req.file.mimetype,
      size_bytes: req.file.size,
    });
  } catch (error) {
    console.error('[adminHomeMedia] upload error:', error);
    // Si multer subió el archivo pero falló algo después, intentar
    // borrarlo para no dejar huérfano.
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* best effort */ }
    }
    res.status(500).json({ error: 'Error subiendo banner', detalles: error.message });
  }
}

/** PUT /api/admin/home-media/:id/activate */
export async function setActivo(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden activar banners' });
    }
    const { id } = req.params;
    const result = await HomeMedia.setActivo(id);
    if (!result.ok) {
      return res.status(404).json({ error: 'Banner no encontrado' });
    }
    const activo = await HomeMedia.getActivo();
    res.json({
      mensaje: result.alreadyActive
        ? 'Este banner ya estaba activo'
        : 'Banner activado correctamente',
      activo,
    });
  } catch (error) {
    console.error('[adminHomeMedia] setActivo error:', error);
    res.status(500).json({ error: 'Error activando banner', detalles: error.message });
  }
}

/** DELETE /api/admin/home-media/:id */
export async function deleteMedia(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden borrar banners' });
    }
    const { id } = req.params;

    // Traer el registro antes de borrar (necesitamos el archivo_path para
    // hacer unlink, y necesitamos saber si es el activo para rechazar).
    const media = await HomeMedia.getById(id);
    if (!media) {
      return res.status(404).json({ error: 'Banner no encontrado' });
    }
    if (Number(media.activo) === 1) {
      return res.status(400).json({
        error: 'No se puede borrar el banner activo. Primero activá otro.',
        code: 'CANNOT_DELETE_ACTIVE',
      });
    }

    const affected = await HomeMedia.deleteById(id);
    if (affected !== 1) {
      return res.status(500).json({ error: 'No se pudo borrar (affectedRows=0)' });
    }

    // Limpiar el archivo físico del disco. Si falla (ej: ya no existe)
    // no es bloqueante: la fila ya se borró.
    if (media.archivo_path) {
      const filePath = path.join(UPLOADS_DIR, media.archivo_path);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn(`[adminHomeMedia] No se pudo borrar archivo físico ${filePath}:`, unlinkErr.message);
      }
    }

    res.json({ mensaje: 'Banner borrado', id: Number(id) });
  } catch (error) {
    console.error('[adminHomeMedia] delete error:', error);
    res.status(500).json({ error: 'Error borrando banner', detalles: error.message });
  }
}

export default {
  list,
  upload,
  setActivo,
  delete: deleteMedia,
};
