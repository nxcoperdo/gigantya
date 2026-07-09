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
  // `restaurante_id` se incluye para que el frontend POS pueda saber a qué
  // local está atado el staff (cajero/mesero/cocina) o el dueño. Para
  // clientes es NULL y se ignora.
  //
  // COALESCE(usuarios.restaurante_id, r.id) cubre los dos casos:
  //   - staff: `usuarios.restaurante_id` lo setea el dueño al crearlos.
  //   - dueño: la columna es NULL; el id del local vive en `restaurantes.usuario_id`.
  // El LEFT JOIN a `restaurantes` siempre es 1 fila a lo sumo (hay UNIQUE
  // sobre `usuario_id` o, en su defecto, usamos LIMIT 1 por seguridad).
  const sql = `
    SELECT u.id, u.nombre, u.email, u.telefono, u.tipo_usuario, u.estado,
           u.documento_identidad, u.creado_en,
           COALESCE(u.restaurante_id, r.id) AS restaurante_id
      FROM usuarios u
      LEFT JOIN restaurantes r ON r.usuario_id = u.id
     WHERE u.id = ?
     LIMIT 1
  `;
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
  const allowedFields = ['nombre', 'email', 'telefono', 'tipo_usuario', 'documento_identidad', 'otros_datos', 'estado'];
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

/**
 * Marcar la última actividad del usuario. Pensado para llamarse como
 * fire-and-forget desde el middleware `verifyToken`: el caller NO debe
 * `await` la promesa, y debe encadenarle un `.catch()` para evitar
 * uncaught rejections si la DB está saturada.
 *
 * Devolver la promesa (en vez de `void`) permite al caller decidir si
 * la espera o no. En la práctica el middleware la descarta.
 */
export function touchLastActivity(userId) {
  return query(
    'UPDATE usuarios SET ultima_actividad = NOW() WHERE id = ?',
    [userId]
  );
}

/**
 * Listar usuarios activos en los últimos N minutos. Usado por el endpoint
 * admin `/admin/users/online` para mostrar el panel de "Usuarios Online".
 *
 * Devuelve `hace_segundos` como BIGINT crudo de MySQL — el controller es
 * responsable de aplicar `Number(...)` antes de serializar a JSON para
 * evitar concatenación de strings en el cliente.
 *
 * @param {number} minutesWindow  Ventana de actividad. Default 5 min.
 *                                El controller clampea entre 1 y 60.
 */
export async function getOnlineUsers(minutesWindow = 5) {
  return query(
    `SELECT id,
            nombre,
            email,
            tipo_usuario,
            estado,
            ultima_actividad,
            TIMESTAMPDIFF(SECOND, ultima_actividad, NOW()) AS hace_segundos
       FROM usuarios
      WHERE ultima_actividad IS NOT NULL
        AND ultima_actividad > (NOW() - INTERVAL ? MINUTE)
        AND estado = 'activo'
      ORDER BY ultima_actividad DESC`,
    [minutesWindow]
  );
}

export default {
  createUser,
  createUserWithConnection,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateUser,
  changePassword,
  getUserProfile,
  touchLastActivity,
  getOnlineUsers
};

