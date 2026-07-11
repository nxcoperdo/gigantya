import * as UserModel from '../models/User.js';

/**
 * Obtener perfil del usuario
 */
export async function getProfile(req, res) {
  try {
    const usuario = await UserModel.getUserById(req.user.id);

    if (!usuario) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    res.json({
      usuario
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo perfil',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar perfil del usuario
 */
export async function updateProfile(req, res) {
  try {
    const { nombre, telefono } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (telefono) updateData.telefono = telefono;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'No hay datos para actualizar' 
      });
    }

    await UserModel.updateUser(req.user.id, updateData);

    const usuario = await UserModel.getUserById(req.user.id);

    res.json({
      mensaje: 'Perfil actualizado',
      usuario
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error actualizando perfil',
      detalles: error.message
    });
  }
}

/**
 * Actualiza un flag del JSON `usuarios.otros_datos` del usuario logueado.
 *
 * Body: { key: 'onboarding.tips_dismissed.crear_producto', value: true }
 *
 * Whitelist de keys permitidas: previene que se escriba cualquier cosa
 * en `otros_datos` (que es JSON libre). Si en el futuro hay que agregar
 * más keys, se agregan al array y listo.
 *
 * Devuelve el `usuario` actualizado (con `otros_datos` mergeado) para
 * que el front lo guarde en localStorage sin pedir otro round-trip.
 */
export async function updateOnboarding(req, res) {
  try {
    const { key, value } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Falta el campo "key"' });
    }

    const ALLOWED_KEYS = [
      'onboarding.dashboard_tour_completed',
      'onboarding.dashboard_tour_dismissed_at',
      'onboarding.dashboard_help_banner_state',
      'onboarding.tips_dismissed.crear_producto',
      'onboarding.tips_dismissed.duplicar_producto',
      'onboarding.tips_dismissed.pausar_producto',
      'onboarding.tips_dismissed.subir_comprobante',
      'onboarding.tips_dismissed.crear_cupon',
      'onboarding.tips_dismissed.abrir_caja',
      'onboarding.tips_dismissed.ver_reportes',
      'onboarding.tips_dismissed.tomar_pedido',
      'ultimo_acceso_dashboard',
    ];
    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(400).json({ error: `Key "${key}" no permitida` });
    }

    await UserModel.setOtrosDatosPath(req.user.id, key, value);

    const usuario = await UserModel.getUserById(req.user.id);
    res.json({ mensaje: 'Onboarding actualizado', usuario });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando onboarding', detalles: error.message });
  }
}

export default {
  getProfile,
  updateProfile,
  updateOnboarding,
};

