import jwt from 'jsonwebtoken';
import * as UserModel from '../models/User.js';

/**
 * Middleware para verificar token JWT
 */
export async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Token no proporcionado',
        requiresAuth: true 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar si el usuario sigue activo en la base de datos.
    // Tratamos `suspendido` e `inactivo` igual: el token ya no es válido.
    // Devolvemos 401 (no 403) para que el interceptor del frontend limpie
    // localStorage y redirija a /login de forma consistente.
    const usuario = await UserModel.getUserById(decoded.id);
    if (!usuario || ['suspendido', 'inactivo'].includes(usuario.estado)) {
      return res.status(401).json({
        error: 'Tu sesión ha expirado o tu cuenta ha sido suspendida',
        requiresAuth: true
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        requiresRefresh: true 
      });
    }

    return res.status(401).json({ 
      error: 'Token inválido' 
    });
  }
}

/**
 * Middleware para verificar rol
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.tipo_usuario)) {
      return res.status(403).json({ 
        error: 'No tienes permiso para acceder a este recurso',
        requiredRole: allowedRoles
      });
    }

    next();
  };
}

/**
 * Middleware para verificar token y rol de cliente
 */
export function requireClient(req, res, next) {
  return requireRole('cliente')(req, res, () => {
    next();
  });
}

/**
 * Middleware para verificar token y rol de restaurante
 */
export function requireRestaurant(req, res, next) {
  return requireRole('restaurante')(req, res, () => {
    next();
  });
}

/**
 * Middleware para verificar token y rol de admin
 */
export function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, () => {
    next();
  });
}

/**
 * Generar JWT
 */
export function generateToken(userData, expiresIn = process.env.JWT_EXPIRE || '7d') {
  return jwt.sign(
    {
      id: userData.id,
      email: userData.email,
      tipo_usuario: userData.tipo_usuario
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Generar refresh token
 */
export function generateRefreshToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export default {
  verifyToken,
  requireRole,
  requireClient,
  requireRestaurant,
  requireAdmin,
  generateToken,
  generateRefreshToken
};

