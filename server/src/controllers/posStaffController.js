/**
 * Controller de personal del POS (Fase 1).
 *
 * Endpoints (todas requieren `requireRestaurantOwner` excepto las
 * internas que se montan en `posStaffRoutes`):
 *   GET    /api/pos/staff
 *   POST   /api/pos/staff
 *   PATCH  /api/pos/staff/:id/status
 */
import * as posStaffService from '../services/posStaffService.js';

/**
 * GET /api/pos/staff
 * Devuelve la lista de staff del restaurante del dueño.
 */
export async function listStaff(req, res) {
  try {
    const restauranteId = req.user.restaurante_id;
    if (!restauranteId) {
      return res.status(400).json({ error: 'No tienes un restaurante asociado' });
    }
    const staff = await posStaffService.listStaffByRestaurante(restauranteId);
    res.json({ staff });
  } catch (err) {
    console.error('[posStaff] listStaff error:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Error listando personal',
    });
  }
}

/**
 * POST /api/pos/staff
 * Crea un usuario staff (cajero/mesero/cocina) atado al restaurante del
 * dueño. Devuelve la contraseña temporal en texto plano.
 */
export async function createStaff(req, res) {
  try {
    const restauranteId = req.user.restaurante_id;
    if (!restauranteId) {
      return res.status(400).json({ error: 'No tienes un restaurante asociado' });
    }
    const { nombre, email, telefono, tipo_usuario, documento_identidad } = req.body;
    const nuevo = await posStaffService.createStaff({
      restauranteId,
      nombre,
      email,
      telefono,
      tipo_usuario,
      documento_identidad,
      creado_por: req.user.id,
    });
    res.status(201).json({
      mensaje: 'Personal creado exitosamente',
      staff: nuevo,
    });
  } catch (err) {
    console.error('[posStaff] createStaff error:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Error creando personal',
    });
  }
}

/**
 * PATCH /api/pos/staff/:id/status
 * Activa o desactiva un staff. Body: { estado: 'activo' | 'inactivo' }
 */
export async function setStaffStatus(req, res) {
  try {
    const restauranteId = req.user.restaurante_id;
    if (!restauranteId) {
      return res.status(400).json({ error: 'No tienes un restaurante asociado' });
    }
    const userId = Number(req.params.id);
    const { estado } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'id de usuario inválido' });
    }
    const ok = await posStaffService.setStaffStatus(userId, restauranteId, estado);
    if (!ok) {
      return res.status(404).json({ error: 'Staff no encontrado en este restaurante' });
    }
    res.json({ mensaje: 'Estado actualizado', estado });
  } catch (err) {
    console.error('[posStaff] setStaffStatus error:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Error actualizando estado',
    });
  }
}

export default {
  listStaff,
  createStaff,
  setStaffStatus,
};
