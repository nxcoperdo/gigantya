import jwt from 'jsonwebtoken';
import * as UserModel from '../models/User.js';
import { query } from '../config/database.js';

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

    // Mezclar datos frescos del usuario (estado, rol) en `req.user` para que
    // cualquier middleware/controller posterior vea cambios de rol/suspensión
    // sin esperar a que el JWT expire (default 7 días). Mantenemos `iat`/`exp`
    // del JWT original porque son la fuente de verdad sobre la sesión.
    req.user = {
      ...decoded,
      estado: usuario.estado,
      // Si el admin cambió el rol del usuario, respetamos el rol fresco de la DB
      // salvo si viene undefined (defensa por si la query devolvió algo raro).
      tipo_usuario: usuario.tipo_usuario || decoded.tipo_usuario,
    };

    // Tracking de "online": actualiza `ultima_actividad` SIN `await` para no
    // bloquear la respuesta. Si la DB está saturada, el `.catch()` evita que
    // un unhandled rejection tumbe el proceso. La query compite por un slot
    // del pool pero como no esperamos, el caller de este middleware no se ve
    // afectado. Si en producción el `processlist` muestra acumulación, agregar
    // throttle en memoria (1 UPDATE por usuario por minuto) — ver
    // `gigantya-pending-improvements.md`.
    query('UPDATE usuarios SET ultima_actividad = NOW() WHERE id = ?', [decoded.id])
      .catch(err => console.error('[online] No se pudo actualizar ultima_actividad:', err.message));

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

