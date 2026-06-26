import * as RestauranteEnvioSectorModel from '../models/RestauranteEnvioSector.js';
import * as SectorModel from '../models/Sector.js';
import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Resuelve el restaurante y, si la petición viene del dueño (no admin),
 * verifica que `req.user.id` sea el `usuario_id` del restaurante.
 * Retorna `{ restaurante }` o `{ error, status }` si falla.
 */
async function loadRestauranteOrFail(req, res, restauranteId) {
  const restaurante = await RestaurantModel.getRestaurantById(restauranteId);
  if (!restaurante) {
    res.status(404).json({ error: 'Restaurante no encontrado' });
    return { restaurante: null };
  }

  // Si el requester NO es admin, debe ser el dueño del restaurante.
  // (Los handlers admin llegan con requireAdmin; los del dueño, con requireRestaurant.)
  const esAdmin = req.user?.tipo_usuario === 'admin';
  if (!esAdmin && restaurante.usuario_id !== req.user?.id) {
    res.status(403).json({ error: 'No tienes permiso para modificar este restaurante' });
    return { restaurante: null };
  }

  return { restaurante };
}

/**
 * GET /api/admin/restaurants/:id/envios-sectores
 * GET /api/restaurants/:id/envios-sectores   (dueño del restaurante)
 *
 * Devuelve la lista completa de sectores activos con el costo configurado
 * para el restaurante (costo 0 si no se ha configurado).
 */
export async function getEnviosSectores(req, res) {
  try {
    const restauranteId = Number(req.params.id);

    const { restaurante } = await loadRestauranteOrFail(req, res, restauranteId);
    if (!restaurante) return;

    const costos = await RestauranteEnvioSectorModel.getByRestaurante(restauranteId, {
      includeMissing: true
    });
    res.json({ restaurante_id: restauranteId, sectores: costos });
  } catch (error) {
    console.error('Error obteniendo costos de envío por sector:', error);
    res.status(500).json({
      error: 'Error obteniendo costos de envío por sector',
      detalles: error.message
    });
  }
}

/**
 * PUT /api/admin/restaurants/:id/envios-sectores
 * PUT /api/restaurants/:id/envios-sectores   (dueño del restaurante)
 *
 * Body: { sectores: [{ sector_id, costo }, ...] }
 * Reemplaza TODOS los costos configurados del restaurante.
 */
export async function replaceEnviosSectores(req, res) {
  try {
    const restauranteId = Number(req.params.id);
    const { sectores } = req.body;

    if (!Array.isArray(sectores)) {
      return res.status(400).json({
        error: 'El campo "sectores" debe ser un array'
      });
    }

    const { restaurante } = await loadRestauranteOrFail(req, res, restauranteId);
    if (!restaurante) return;

    // Validar que cada sector exista y esté activo.
    const sectoresActivos = await SectorModel.getSectores({ soloActivos: true });
    const sectoresValidos = new Set(sectoresActivos.map(s => Number(s.id)));

    for (const item of sectores) {
      if (!item || item.sector_id === undefined || item.sector_id === null) {
        return res.status(400).json({
          error: 'Cada item debe tener sector_id'
        });
      }
      if (!sectoresValidos.has(Number(item.sector_id))) {
        return res.status(400).json({
          error: `Sector inválido o inactivo: ${item.sector_id}`
        });
      }
      const costo = Number(item.costo);
      if (Number.isNaN(costo) || costo < 0) {
        return res.status(400).json({
          error: `Costo inválido para sector ${item.sector_id}: debe ser un número >= 0`
        });
      }
    }

    await RestauranteEnvioSectorModel.replaceAll(
      restauranteId,
      sectores,
      req.user?.id ?? null
    );
    const costos = await RestauranteEnvioSectorModel.getByRestaurante(restauranteId, {
      includeMissing: true
    });
    res.json({
      mensaje: 'Costos de envío por sector actualizados',
      restaurante_id: restauranteId,
      sectores: costos
    });
  } catch (error) {
    console.error('Error reemplazando costos de envío por sector:', error);
    res.status(error.statusCode || 500).json({
      error: 'Error reemplazando costos de envío por sector',
      detalles: error.message
    });
  }
}

export default { getEnviosSectores, replaceEnviosSectores };
