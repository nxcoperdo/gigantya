import { query, queryOne } from '../config/database.js';

/**
 * Radio de la Tierra en km (valor estándar para Haversine).
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Distancia en km entre dos coordenadas (lat/lng en grados decimales)
 * usando la fórmula de Haversine.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distancia en km
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    [lat1, lon1, lat2, lon2].some(
      (v) => v === null || v === undefined || Number.isNaN(Number(v))
    )
  ) {
    return Infinity;
  }

  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Radio máximo (km) dentro del cual un punto cuenta como "perteneciente" al sector.
 * Configurable vía `SECTOR_GEOCODE_RADIUS_KM` (default 5 km). Es una simplificación:
 * un sistema con polígonos reales se deja para una iteración futura.
 */
const SECTOR_RADIUS_KM = Number(process.env.SECTOR_GEOCODE_RADIUS_KM ?? 5);

/**
 * Resuelve el sector más cercano a un punto geográfico (lat/lng).
 * Solo considera sectores activos cuyo centroide (`latitud_centro`/`longitud_centro`)
 * esté configurado y dentro del radio máximo (`SECTOR_GEOCODE_RADIUS_KM`).
 *
 * Devuelve `null` si:
 *   - no se pasa lat/lng,
 *   - ningún sector tiene centroide configurado,
 *   - el sector más cercano está fuera del radio máximo.
 *
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {Promise<{sector_id:number, sector_nombre:string, distancia_km:number}|null>}
 */
export async function resolverSectorPorCoordenadas(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null;

  const sectores = await query(
    `SELECT id, nombre, latitud_centro, longitud_centro
     FROM sectores
     WHERE activo = 1
       AND latitud_centro IS NOT NULL
       AND longitud_centro IS NOT NULL`
  );

  if (!sectores.length) return null;

  let mejor = null;
  for (const s of sectores) {
    const d = haversineDistanceKm(latNum, lngNum, s.latitud_centro, s.longitud_centro);
    if (d > SECTOR_RADIUS_KM) continue;
    if (!mejor || d < mejor.distancia_km) {
      mejor = { sector_id: Number(s.id), sector_nombre: s.nombre, distancia_km: d };
    }
  }

  return mejor;
}

export default {
  haversineDistanceKm,
  resolverSectorPorCoordenadas,
};
