import * as SectorModel from '../models/Sector.js';
import * as BarrioModel from '../models/Barrio.js';

/**
 * GET /api/zonas/sectores
 * Lista los sectores activos (público, requiere autenticación).
 */
export async function getSectores(req, res) {
  try {
    const sectores = await SectorModel.getSectores({ soloActivos: true });
    res.json({ sectores });
  } catch (error) {
    console.error('Error listando sectores:', error);
    res.status(500).json({
      error: 'Error listando sectores',
      detalles: error.message
    });
  }
}

/**
 * GET /api/zonas/barrios?sector_id=X
 * Lista barrios activos, opcionalmente filtrados por sector.
 */
export async function getBarrios(req, res) {
  try {
    const sectorId = req.query.sector_id
      ? Number(req.query.sector_id)
      : null;
    const barrios = await BarrioModel.getBarrios({
      sector_id: sectorId,
      soloActivos: true
    });
    res.json({ barrios });
  } catch (error) {
    console.error('Error listando barrios:', error);
    res.status(500).json({
      error: 'Error listando barrios',
      detalles: error.message
    });
  }
}

export default { getSectores, getBarrios };
