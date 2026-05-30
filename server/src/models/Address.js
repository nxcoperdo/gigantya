import { query, queryOne } from '../config/database.js';

/**
 * Obtener todas las direcciones del usuario
 */
export async function getUserAddresses(usuario_id) {
  const sql = `
    SELECT * FROM direcciones 
    WHERE usuario_id = ? 
    ORDER BY es_default DESC, creado_en DESC
  `;
  return query(sql, [usuario_id]);
}

/**
 * Obtener dirección por ID
 */
export async function getAddressById(id, usuario_id) {
  const sql = 'SELECT * FROM direcciones WHERE id = ? AND usuario_id = ?';
  return queryOne(sql, [id, usuario_id]);
}

/**
 * Obtener dirección por defecto
 */
export async function getDefaultAddress(usuario_id) {
  const sql = 'SELECT * FROM direcciones WHERE usuario_id = ? AND es_default = 1 LIMIT 1';
  return queryOne(sql, [usuario_id]);
}

/**
 * Crear nueva dirección
 */
export async function createAddress(addressData) {
  const {
    usuario_id,
    tipo = 'residencia',
    direccion,
    ciudad = 'Giganta, Huila',
    telefono,
    notas,
    es_default = 0
  } = addressData;

  if (!direccion) {
    throw new Error('La dirección es requerida');
  }

  // Si es default, desmarcar otras
  if (es_default) {
    await query(
      'UPDATE direcciones SET es_default = 0 WHERE usuario_id = ?',
      [usuario_id]
    );
  }

  const sql = `
    INSERT INTO direcciones 
    (usuario_id, tipo, direccion, ciudad, telefono, notas, es_default, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      tipo,
      direccion,
      ciudad,
      telefono,
      notas,
      es_default
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando dirección: ${error.message}`);
  }
}

/**
 * Actualizar dirección
 */
export async function updateAddress(id, usuario_id, updateData) {
  const {
    tipo,
    direccion,
    ciudad,
    telefono,
    notas,
    es_default
  } = updateData;

  const allowedFields = ['tipo', 'direccion', 'ciudad', 'telefono', 'notas', 'es_default'];
  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  // Verificar que la dirección pertenece al usuario
  const address = await getAddressById(id, usuario_id);
  if (!address) {
    throw new Error('Dirección no encontrada');
  }

  // Si es default, desmarcar otras
  if (es_default === 1) {
    await query(
      'UPDATE direcciones SET es_default = 0 WHERE usuario_id = ? AND id != ?',
      [usuario_id, id]
    );
  }

  let sql = 'UPDATE direcciones SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;
    values.push(updateData[field]);
  });

  sql += ' WHERE id = ? AND usuario_id = ?';
  values.push(id, usuario_id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando dirección: ${error.message}`);
  }
}

/**
 * Eliminar dirección
 */
export async function deleteAddress(id, usuario_id) {
  // Verificar que la dirección pertenece al usuario
  const address = await getAddressById(id, usuario_id);
  if (!address) {
    throw new Error('Dirección no encontrada');
  }

  const sql = 'DELETE FROM direcciones WHERE id = ? AND usuario_id = ?';

  try {
    await query(sql, [id, usuario_id]);
    return true;
  } catch (error) {
    throw new Error(`Error eliminando dirección: ${error.message}`);
  }
}

/**
 * Establecer dirección por defecto
 */
export async function setDefaultAddress(id, usuario_id) {
  const address = await getAddressById(id, usuario_id);
  if (!address) {
    throw new Error('Dirección no encontrada');
  }

  // Desmarcar todas las demás
  await query(
    'UPDATE direcciones SET es_default = 0 WHERE usuario_id = ?',
    [usuario_id]
  );

  // Marcar como default
  await query(
    'UPDATE direcciones SET es_default = 1 WHERE id = ? AND usuario_id = ?',
    [id, usuario_id]
  );

  return true;
}

export default {
  getUserAddresses,
  getAddressById,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};

