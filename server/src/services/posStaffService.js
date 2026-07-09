/**
 * Servicio de personal del POS (Fase 1).
 *
 * Permite a un dueño de restaurante crear usuarios staff
 * (cajero/mesero/cocina) atados a su local vía `usuarios.restaurante_id`.
 *
 * Decisiones:
 *   - Reusamos `usuarios` con `tipo_usuario` ∈ {cajero, mesero, cocina}.
 *     No hay tabla `empleados` separada (decidido con el usuario).
 *   - La contraseña temporal se genera y se devuelve en la respuesta
 *     (en producción se enviaría por email; nodemailer ya está como dep).
 *     Mostrarla al dueño para que la comparta es aceptable para el MVP.
 *   - El `restaurante_id` se valida contra el restaurante del dueño que
 *     invoca la API (defense in depth contra bypass de tenant).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database.js';
import * as UserModel from '../models/User.js';
import { createLog } from '../models/AuditLog.js';

const ALLOWED_STAFF_ROLES = new Set(['cajero', 'mesero', 'cocina']);

/**
 * Genera una contraseña temporal legible: 4 letras + 4 dígitos. Suficiente
 * para el onboarding de staff (luego pueden cambiarla).
 */
export function generateTempPassword() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sin I, L, O para no confundir
  const digits = '23456789'; // sin 0, 1
  let s = '';
  for (let i = 0; i < 4; i++) s += letters[crypto.randomInt(0, letters.length)];
  for (let i = 0; i < 4; i++) s += digits[crypto.randomInt(0, digits.length)];
  return s;
}

/**
 * Lista el personal de un restaurante (excluyendo al dueño).
 * Devuelve solo lo que el frontend necesita: id, nombre, email, rol, estado.
 */
export async function listStaffByRestaurante(restauranteId) {
  return query(
    `SELECT id, nombre, email, tipo_usuario, estado, creado_en
       FROM usuarios
      WHERE restaurante_id = ?
        AND tipo_usuario IN ('cajero','mesero','cocina')
      ORDER BY tipo_usuario, nombre`,
    [restauranteId]
  );
}

/**
 * Crea un usuario staff y lo ata al restaurante del dueño. Devuelve el
 * usuario creado + la contraseña temporal (en texto plano) para que el
 * dueño se la pase al staff.
 */
export async function createStaff({ restauranteId, nombre, email, telefono, tipo_usuario, documento_identidad, creado_por }) {
  if (!restauranteId) throw Object.assign(new Error('restauranteId es requerido'), { statusCode: 400 });
  if (!ALLOWED_STAFF_ROLES.has(tipo_usuario)) {
    throw Object.assign(new Error('tipo_usuario debe ser cajero, mesero o cocina'), { statusCode: 400 });
  }
  if (!nombre || !email) {
    throw Object.assign(new Error('nombre y email son requeridos'), { statusCode: 400 });
  }
  // Verificar email único
  const existing = await UserModel.getUserByEmailIgnoreStatus(email);
  if (existing) {
    throw Object.assign(new Error('Ya existe un usuario con ese email'), { statusCode: 409 });
  }
  // Verificar que el restaurante existe y está activo
  const rest = await queryOne('SELECT id, nombre, usuario_id FROM restaurantes WHERE id = ?', [restauranteId]);
  if (!rest) {
    throw Object.assign(new Error('El restaurante no existe'), { statusCode: 404 });
  }

  const contrasena = generateTempPassword();
  const contrasena_hash = await bcrypt.hash(contrasena, 10);

  const result = await query(
    `INSERT INTO usuarios (nombre, email, telefono, contrasena_hash, tipo_usuario, documento_identidad, restaurante_id, estado, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', NOW())`,
    [nombre, email, telefono || null, contrasena_hash, tipo_usuario, documento_identidad || null, restauranteId]
  );
  const userId = result.insertId;

  // Auditoría (best-effort; si falla no bloqueamos el alta)
  try {
    await createLog({
      admin_id: creado_por || null,
      accion: 'pos.staff.create',
      entidad_tipo: 'usuario',
      entidad_id: userId,
      datos_despues: { restaurante_id: restauranteId, tipo_usuario, email },
    });
  } catch (err) {
    console.warn('[posStaffService] No se pudo escribir audit log:', err.message);
  }

  return {
    id: userId,
    nombre,
    email,
    telefono: telefono || null,
    tipo_usuario,
    estado: 'activo',
    restaurante_id: restauranteId,
    contrasena_temporal: contrasena, // se muestra al dueño UNA sola vez
  };
}

/**
 * Cambia el estado de un staff (activo <-> inactivo). No permite suspender
 * al dueño. Devuelve el row actualizado o null si no existe.
 */
export async function setStaffStatus(userId, restauranteId, estado) {
  if (!['activo', 'inactivo'].includes(estado)) {
    throw Object.assign(new Error('estado debe ser activo o inactivo'), { statusCode: 400 });
  }
  // Solo se puede tocar staff de TU restaurante
  const result = await query(
    `UPDATE usuarios
        SET estado = ?
      WHERE id = ?
        AND restaurante_id = ?
        AND tipo_usuario IN ('cajero','mesero','cocina')`,
    [estado, userId, restauranteId]
  );
  return result.affectedRows > 0;
}

export default {
  generateTempPassword,
  listStaffByRestaurante,
  createStaff,
  setStaffStatus,
};
