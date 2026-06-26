import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database.js';

/**
 * Crear nuevo usuario
 */
export async function createUser(userData) {
  const {
    nombre,
    email,
    telefono,
    contrasena,
    tipo_usuario, // 'cliente', 'restaurante', 'admin'
    documento_identidad,
    otros_datos = {}
  } = userData;

  // Hash de contrasena
  const contrasena_hash = await bcrypt.hash(contrasena, 10);

  const sql = `
    INSERT INTO usuarios (
      nombre,
      email,
      telefono,
      contrasena_hash,
      tipo_usuario,
      documento_identidad,
      otros_datos,
      estado,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', NOW())
  `;

  try {
    const result = await query(sql, [
      nombre,
      email,
      telefono,
      contrasena_hash,
      tipo_usuario,
      documento_identidad,
      JSON.stringify(otros_datos)
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando usuario: ${error.message}`);
  }
}

/**
 * Crear nuevo usuario con una conexión específica (para transacciones)
 */
export async function createUserWithConnection(userData, connection) {
  const {
    nombre,
    email,
    telefono,
    contrasena,
    tipo_usuario, // 'cliente', 'restaurante', 'admin'
    documento_identidad,
    otros_datos = {}
  } = userData;

  // Hash de contrasena
  const contrasena_hash = await bcrypt.hash(contrasena, 10);

  const sql = `
    INSERT INTO usuarios (
      nombre,
      email,
      telefono,
      contrasena_hash,
      tipo_usuario,
      documento_identidad,
      otros_datos,
      estado,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', NOW())
  `;

  try {
    const [result] = await connection.query(sql, [
      nombre,
      email,
      telefono,
      contrasena_hash,
      tipo_usuario,
      documento_identidad,
      JSON.stringify(otros_datos)
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando usuario: ${error.message}`);
  }
}

/**
 * Obtener usuario por email
 */
export async function getUserByEmail(email) {
  const sql = 'SELECT * FROM usuarios WHERE email = ? AND estado = "activo"';
  return queryOne(sql, [email]);
}

export async function getUserByEmailIgnoreStatus(email) {
  const sql = 'SELECT * FROM usuarios WHERE email = ?';
  return queryOne(sql, [email]);
}

/**
 * Obtener usuario por ID
 *
 * Importante: NO filtrar por `estado` aquí. El middleware `verifyToken`
 * ya valida explícitamente que el usuario no esté `suspendido`/`inactivo`,
 * y filtrar en el modelo oculta el estado que el middleware necesita
 * inspeccionar (causa raíz del bug de "loop de login" tras suspensión).
 */
export async function getUserById(id) {
  const sql = 'SELECT id, nombre, email, telefono, tipo_usuario, estado, documento_identidad, creado_en FROM usuarios WHERE id = ?';
  return queryOne(sql, [id]);
}

/**
 * Verificar contrasena
 */
export async function verifyPassword(contrasena, contrasena_hash) {
  return bcrypt.compare(contrasena, contrasena_hash);
}

/**
 * Actualizar usuario
 */
export async function updateUser(id, updateData) {
  const allowedFields = ['nombre', 'email', 'telefono', 'tipo_usuario', 'documento_identidad', 'otros_datos'];
  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  let sql = 'UPDATE usuarios SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += field === 'otros_datos' 
      ? `${field} = JSON_MERGE_PRESERVE(otros_datos, ?)` 
      : `${field} = ?`;
    
    values.push(updateData[field]);
  });

  sql += ' WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando usuario: ${error.message}`);
  }
}

/**
 * Cambiar contrasena
 */
export async function changePassword(id, nueva_contrasena) {
  const contrasena_hash = await bcrypt.hash(nueva_contrasena, 10);
  const sql = 'UPDATE usuarios SET contrasena_hash = ? WHERE id = ?';

  try {
    await query(sql, [contrasena_hash, id]);
    return true;
  } catch (error) {
    throw new Error(`Error cambiando contrasena: ${error.message}`);
  }
}

/**
 * Obtener perfil completo del usuario con sus datos relacionados
 */
export async function getUserProfile(id) {
  const usuario = await getUserById(id);
  
  if (!usuario) return null;

  if (usuario.tipo_usuario === 'restaurante') {
    const restaurante = await query(
      'SELECT * FROM restaurantes WHERE usuario_id = ? LIMIT 1',
      [id]
    );
    usuario.restaurante = restaurante[0] || null;
  }

  return usuario;
}

export default {
  createUser,
  createUserWithConnection,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateUser,
  changePassword,
  getUserProfile
};

