/**
 * Controller público: GET del banner activo de la home (Fase 12).
 *
 * Endpoint:
 *   - GET /api/home/media → devuelve el banner activo o { media: null }
 *
 * Sin auth: la home es pública. No hay info sensible (solo nombre del
 * archivo y path público que se sirve por `/uploads/...`).
 */
import * as HomeMedia from '../models/HomeMedia.js';

/** GET /api/home/media */
export async function getActivo(_req, res) {
  try {
    const activo = await HomeMedia.getActivo();
    if (!activo) {
      // Sin banner activo → el cliente renderiza el fallback
      // (banner.mp4 hardcodeado en client/public).
      return res.json({ media: null });
    }
    // Devolvemos solo lo que el cliente necesita para renderizar
    // (omitimos `subido_por` y `size_bytes` que no se usan en la UI).
    // El cliente arma la URL como `/media/${archivo}` (servido por
    // app.use('/media', ...) en app.js).
    res.json({
      media: {
        id: activo.id,
        nombre: activo.nombre,
        archivo: activo.archivo,
        tipo: activo.tipo,
        mime: activo.mime,
      },
    });
  } catch (error) {
    console.error('[publicHomeMedia] getActivo error:', error);
    res.status(500).json({
      error: 'Error obteniendo el banner activo',
      detalles: error.message,
    });
  }
}

export default { getActivo };
