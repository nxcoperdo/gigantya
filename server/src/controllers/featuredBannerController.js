/**
 * Controller admin: descarga ZIP de banners de locales destacados.
 *
 * Endpoint (protegido por `requireAdmin` desde `adminRoutes.js`):
 *   - GET /api/admin/featured-banners/zip   → downloadFeaturedBanners
 *
 * Arma un ZIP on-the-fly (streaming con `archiver`) con los
 * `banner_url` de los locales cuyo plan habilita `banner_home`
 * (premium o golden_plus) y que tienen cuenta activa + plan vigente.
 *
 * El nombre del archivo adentro del ZIP es legible:
 *   `local-{id}-{slugify(nombre)}-{YYYY-MM-DD}.{ext}`
 *
 * Decisiones:
 *   - Si no hay locales destacados, devolvemos 404 con JSON (no un
 *     ZIP vacío) para que el front pueda mostrar un mensaje claro.
 *   - Si el `banner_url` apunta a un archivo que ya no existe en
 *     disco, logueamos warning y seguimos con los demás (no
 *     abortamos el ZIP entero).
 *   - `Cache-Control: no-transform` evita que el middleware de
 *     compression intente gzip-ear el stream de ZIP.
 */
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import * as Restaurant from '../models/Restaurant.js';
import { UPLOADS_DIR } from '../middleware/uploadMiddleware.js';

/** Resuelve una URL relativa tipo `/uploads/foo.jpg` a la ruta absoluta
 *  en disco. Devuelve `null` si la URL no matchea el patrón esperado
 *  (queda en responsabilidad del caller loguear y skipear).
 */
function resolveUploadPath(relativeUrl) {
  if (!relativeUrl || typeof relativeUrl !== 'string') return null;
  const match = relativeUrl.match(/^\/?(?:uploads|media)\/(.+)$/);
  if (!match) return null;
  return path.join(UPLOADS_DIR, match[1]);
}

/** Slug simple: lowercase, no-alphanum → `_`, colapsa repetidos, trim.
 *  No usamos dependencias externas para mantener liviano el controller.
 */
function slugify(nombre) {
  return String(nombre || 'local')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca diacríticos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 60) || 'local';
}

/** GET /api/admin/featured-banners/zip */
export async function downloadFeaturedBanners(req, res) {
  let headersSent = false;

  try {
    const locales = await Restaurant.getFeaturedBannerLocals();

    if (!Array.isArray(locales) || locales.length === 0) {
      return res.status(404).json({
        error: 'No hay locales destacados con banner cargado',
      });
    }

    // Seteamos los headers ANTES de pipear para que el browser sepa
    // que viene un ZIP y dispare la descarga.
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="banners-destacados.zip"');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    headersSent = true;

    const archive = archiver('zip', { zlib: { level: 6 } });

    // Listeners de archiver. NO tiramos `throw` adentro del listener
    // de `error` porque ya mandamos headers 200; en su lugar, tratamos
    // de cortar la respuesta limpio y loguear.
    archive.on('warning', (err) => {
      console.warn('[zip-banners] archiver warning:', err?.message || err);
    });
    archive.on('error', (err) => {
      console.error('[zip-banners] archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error generando ZIP' });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    const today = new Date().toISOString().slice(0, 10);
    let agregados = 0;
    let omitidos = 0;

    for (const local of locales) {
      const absPath = resolveUploadPath(local.banner_url);
      if (!absPath || !fs.existsSync(absPath)) {
        console.warn(
          `[zip-banners] Banner ausente en disco: restaurante=${local.id} ` +
          `nombre="${local.nombre}" url=${local.banner_url}`
        );
        omitidos += 1;
        continue;
      }

      const ext = path.extname(absPath) || '.jpg';
      const entryName = `local-${local.id}-${slugify(local.nombre)}-${today}${ext}`;
      archive.file(absPath, { name: entryName });
      agregados += 1;
    }

    if (agregados === 0) {
      // Todos los locales tenían `banner_url` pero ninguno apuntaba a
      // un archivo real en disco. Cerramos el ZIP y respondemos JSON.
      console.warn('[zip-banners] Cero banners agregados al ZIP (todos ausentes en disco)');
      archive.abort();
      if (!res.headersSent) {
        return res.status(404).json({
          error: 'Los locales destacados tienen banner_url en BD pero ningún archivo existe en disco',
        });
      }
      return res.end();
    }

    console.log(`[zip-banners] ZIP generado: agregados=${agregados} omitidos=${omitidos}`);

    await archive.finalize();
  } catch (err) {
    console.error('[zip-banners] error general:', err);
    if (!headersSent) {
      res.status(500).json({ error: err.message || 'Error generando ZIP' });
    } else {
      res.end();
    }
  }
}
