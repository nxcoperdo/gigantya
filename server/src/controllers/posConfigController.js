/**
 * Controller de Configuración POS (Fase 8).
 *
 * Endpoints:
 *   GET /api/pos/config      — cualquier staff
 *   PUT /api/pos/config      — solo dueño del restaurante
 */
import * as posConfigService from '../services/posConfigService.js';

/** GET /api/pos/config */
export async function getConfig(req, res) {
  try {
    const rid = req.user.restaurante_id;
    if (!rid) return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    const cfg = await posConfigService.getConfig(rid);
    res.json({ configuracion_pos: cfg });
  } catch (e) {
    console.error('[posConfig] getConfig error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error leyendo configuración POS' });
  }
}

/** PUT /api/pos/config */
export async function updateConfig(req, res) {
  try {
    const rid = req.user.restaurante_id;
    if (!rid) return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    const cfg = await posConfigService.updateConfig(rid, req.body || {}, req.user.id);
    res.json({ configuracion_pos: cfg });
  } catch (e) {
    console.error('[posConfig] updateConfig error:', e);
    res.status(e.statusCode || 500).json({ error: e.message || 'Error actualizando configuración POS' });
  }
}

export default { getConfig, updateConfig };
