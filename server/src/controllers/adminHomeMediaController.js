/**
 * Controller admin: CMS de banner de Home (Fase 12b).
 *
 * Endpoints (todos protegidos por `requireAdmin` desde `adminRoutes.js`):
 *   - GET    /api/admin/home-media              → list (lee filesystem + DB)
 *   - PUT    /api/admin/home-media/:id/activate → setActivo
 *
 * Fase 12b: ya no hay upload ni delete. Los banners son assets
 * estáticos commiteados en `client/public/media/`. El admin solo
 * VE la lista de archivos y marca uno como activo.
 *
 * Decisiones:
 *   - `list` hace `fs.readdir(PUBLIC_MEDIA_DIR)` para listar archivos
 *     en disco, deriva `tipo` y `mime` por extensión, hace `fs.stat`
 *     para `size_bytes`, y cruza con `HomeMedia.listAll()` para
 *     saber cuál está activo y obtener `nombre`/`id` por archivo.
 *   - La derivación de `tipo` y `mime` es por extensión, no por
 *     magic bytes. Es suficiente para este caso (jpg/png/webp/mp4/webm)
 *     y evita una dep extra. Si en el futuro se agregan formatos
 *     exóticos, agregar `file-type` o leer los primeros bytes.
 *   - Si la carpeta `client/public/media/` no existe, devuelve lista
 *     vacía con un warning. No falla con 500 — es estado válido.
 *   - `setActivo` no cambió. Sigue siendo transaccional (lock pesimista
 *     para evitar race conditions entre 2 admins).
 */
import fs from 'fs';
import path from 'path';
import * as HomeMedia from '../models/HomeMedia.js';

// Ruta al directorio de assets estáticos del front. Asumimos que el
// server corre con cwd = `server/`, así que subimos un nivel y
// entramos a `client/public/media/`. Misma convención que `app.js`.
const PUBLIC_MEDIA_DIR = path.resolve(process.cwd(), '../client/public/media');

/** Mapa de extensión → { tipo, mime }. Coincide con los filtros del
 *  frontend (accept="image/*,video/mp4,video/webm"). */
const EXT_TO_TYPE = {
  // Imágenes
  jpg:  { tipo: 'imagen', mime: 'image/jpeg' },
  jpeg: { tipo: 'imagen', mime: 'image/jpeg' },
  png:  { tipo: 'imagen', mime: 'image/png' },
  webp: { tipo: 'imagen', mime: 'image/webp' },
  gif:  { tipo: 'imagen', mime: 'image/gif' },
  avif: { tipo: 'imagen', mime: 'image/avif' },
  // Videos
  mp4:  { tipo: 'video', mime: 'video/mp4' },
  webm: { tipo: 'video', mime: 'video/webm' },
  mov:  { tipo: 'video', mime: 'video/quicktime' },
};

/**
 * GET /api/admin/home-media
 *
 * Lee los archivos de client/public/media/ y los cruza con la DB.
 * Devuelve un array con info de cada archivo. Los que NO están en la
 * DB aparecen con `activo: 0` y `id: null` (todavía no se "activaron"
 * nunca). Los que están en la DB pero NO en disco NO aparecen (huérfanos).
 */
export async function list(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver banners' });
    }

    // 1) Verificar que la carpeta existe.
    if (!fs.existsSync(PUBLIC_MEDIA_DIR)) {
      console.warn(`[adminHomeMedia] Directorio no existe: ${PUBLIC_MEDIA_DIR}`);
      return res.json({ total: 0, items: [] });
    }

    // 2) Leer archivos del filesystem.
    const allFiles = fs.readdirSync(PUBLIC_MEDIA_DIR);
    const mediaFiles = allFiles.filter((f) => {
      // Ignorar .gitkeep, .DS_Store, y archivos sin extensión.
      if (f.startsWith('.')) return false;
      const ext = path.extname(f).slice(1).toLowerCase();
      return EXT_TO_TYPE[ext] !== undefined;
    });

    if (mediaFiles.length === 0) {
      return res.json({ total: 0, items: [] });
    }

    // 3) Leer info de la DB (mapeo archivo → fila).
    const dbRows = await HomeMedia.listAll();
    const dbByArchivo = new Map();
    for (const row of dbRows) {
      if (row.archivo) dbByArchivo.set(row.archivo, row);
    }

    // 4) Construir el array final.
    const items = mediaFiles.map((archivo) => {
      const ext = path.extname(archivo).slice(1).toLowerCase();
      const { tipo, mime } = EXT_TO_TYPE[ext];
      let size_bytes = 0;
      try {
        const stat = fs.statSync(path.join(PUBLIC_MEDIA_DIR, archivo));
        size_bytes = stat.size;
      } catch (statErr) {
        // No bloqueante — devolvemos size=0 si el stat falla.
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

    // 5) Ordenar: activos primero, después alfabético.
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

export default {
  list,
  setActivo,
};
