import { generateToken, generateRefreshToken } from '../middleware/authMiddleware.js';
import * as UserModel from '../models/User.js';

/**
 * Registro de nuevo usuario
 */
export async function register(req, res) {
  try {
    const nombre = req.body.nombre;
    const email = req.body.email;
    const telefono = req.body.telefono;
    const contrasena = req.body.contrasena;
    const contrasena_confirmacion = req.body.contrasena_confirmacion;
    const tipo_usuario = 'cliente';
    const documento_identidad = req.body.documento_identidad;

    // Validaciones básicas
    if (!nombre || !email || !telefono || !contrasena || !tipo_usuario) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltando: nombre, email, telefono, contrasena, tipo_usuario' 
      });
    }

    if (contrasena !== contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Las contraseñas no coinciden' 
      });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    if (req.body.tipo_usuario && req.body.tipo_usuario !== 'cliente') {
      return res.status(400).json({ 
        error: 'En esta plataforma solo se permiten registros de clientes. Los restaurantes se gestionan de forma manual con mensualidad.' 
      });
    }

    // Verificar si el email ya existe
    const usuarioExistente = await UserModel.getUserByEmail(email);
    if (usuarioExistente) {
      return res.status(409).json({ 
        error: 'El email ya está registrado' 
      });
    }

    // Crear usuario
    const userId = await UserModel.createUser({
      nombre,
      email,
      telefono,
      contrasena,
      tipo_usuario,
      documento_identidad
    });

    const usuario = await UserModel.getUserById(userId);

    // Generar token
    const token = generateToken(usuario);
    const refreshToken = generateRefreshToken(userId);

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error registrando usuario',
      detalles: error.message 
    });
  }
}

/**
 * Login de usuario
 */
export async function login(req, res) {
  try {
    const email = req.body.email;
    const contrasena = req.body.contrasena;

    if (!email || !contrasena) {
      return res.status(400).json({ 
        error: 'Email y contrasena son requeridos' 
      });
    }

    // Buscar usuario
    const usuario = await UserModel.getUserByEmail(email);
    if (!usuario) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Verificar contraseña
    const contrasenaValida = await UserModel.verifyPassword(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Generar tokens
    const token = generateToken(usuario);
    const refreshToken = generateRefreshToken(usuario.id);

    // Log del login exitoso
    console.log(`✅ Login exitoso: ${usuario.email} (${usuario.tipo_usuario})`);

    res.json({
      mensaje: 'Login exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      error: 'Error en login',
      detalles: error.message 
    });
  }
}

/**
 * Obtener perfil del usuario actual
 */
export async function getProfile(req, res) {
  try {
    const usuario = await UserModel.getUserProfile(req.user.id);

    if (!usuario) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    res.json({
      usuario
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ 
      error: 'Error obteniendo perfil',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar perfil
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
      mensaje: 'Perfil actualizado exitosamente',
      usuario
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ 
      error: 'Error actualizando perfil',
      detalles: error.message 
    });
  }
}

/**
 * Cambiar contraseña
 */
export async function changePassword(req, res) {
  try {
    const contrasena_actual = req.body.contrasena_actual;
    const contrasena_nueva = req.body.contrasena_nueva;
    const contrasena_confirmacion = req.body.contrasena_confirmacion;

    if (!contrasena_actual || !contrasena_nueva || !contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos' 
      });
    }

    if (contrasena_nueva !== contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Las nuevas contraseñas no coinciden' 
      });
    }

    if (contrasena_nueva.length < 6) {
      return res.status(400).json({ 
        error: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar contraseña actual
    const usuario = await UserModel.getUserByEmail(req.user.email);
    const contrasenaValida = await UserModel.verifyPassword(contrasena_actual, usuario.contrasena_hash);

    if (!contrasenaValida) {
      return res.status(401).json({ 
        error: 'La contraseña actual es incorrecta' 
      });
    }

    // Cambiar contraseña
    await UserModel.changePassword(req.user.id, contrasena_nueva);

    res.json({
      mensaje: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ 
      error: 'Error cambiando contraseña',
      detalles: error.message 
    });
  }
}

export default {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};

