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

export default {
  getProfile,
  updateProfile
};

