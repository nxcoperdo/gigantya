import { query, queryOne } from '../config/database.js';

/**
 * Lista blanca de campos actualizables y creables.
 * Incluye los nuevos campos de Google Maps (latitud, longitud, direccion_formateada, place_id).
 */
const ADDRESS_FIELDS = [
  'tipo',
  'direccion',
  'ciudad',
  'telefono',
  'notas',
  'es_default',
  'barrio_id',
  'latitud',
  'longitud',
  'direccion_formateada',
  'place_id',
];

/**
 * Normaliza los valores de los campos de Maps. Acepta strings ('' → null) y rechaza NaN.
 * @param {Object} input
 * @returns {Object}
 */
function normalizeMapFields(input) {
  const out = { ...input };
  if ('latitud' in out) {
    const v = out.latitud;
    out.latitud = v === null || v === undefined || v === '' ? null : Number(v);
    if (out.latitud !== null && Number.isNaN(out.latitud)) out.latitud = null;
  }
  if ('longitud' in out) {
    const v = out.longitud;
    out.longitud = v === null || v === undefined || v === '' ? null : Number(v);
    if (out.longitud !== null && Number.isNaN(out.longitud)) out.longitud = null;
  }
  if ('direccion_formateada' in out && (out.direccion_formateada === '' || out.direccion_formateada === undefined)) {
    out.direccion_formateada = null;
  }
  if ('place_id' in out && (out.place_id === '' || out.place_id === undefined)) {
    out.place_id = null;
  }
  return out;
}

/**
 * Obtener todas las direcciones del usuario.
 * Incluye los datos del barrio y sector (si tiene barrio asignado) y los campos de Google Maps.
 */
export async function getUserAddresses(usuario_id) {
  const sql = `
    SELECT d.*,
           b.nombre AS barrio_nombre,
           b.sector_id,
           s.nombre AS sector_nombre
    FROM direcciones d
    LEFT JOIN barrios b ON d.barrio_id = b.id
    LEFT JOIN sectores s ON b.sector_id = s.id
    WHERE d.usuario_id = ?
    ORDER BY d.es_default DESC, d.creado_en DESC
  `;
  return query(sql, [usuario_id]);
}

/**
 * Obtener dirección por ID
 */
export async function getAddressById(id, usuario_id) {
  const sql = `
    SELECT d.*,
           b.nombre AS barrio_nombre,
           b.sector_id,
           s.nombre AS sector_nombre
    FROM direcciones d
    LEFT JOIN barrios b ON d.barrio_id = b.id
    LEFT JOIN sectores s ON b.sector_id = s.id
    WHERE d.id = ? AND d.usuario_id = ?
  `;
  return queryOne(sql, [id, usuario_id]);
}

/**
 * Obtener dirección por defecto
 */
export async function getDefaultAddress(usuario_id) {
  const sql = `
    SELECT d.*,
           b.nombre AS barrio_nombre,
           b.sector_id,
           s.nombre AS sector_nombre
    FROM direcciones d
    LEFT JOIN barrios b ON d.barrio_id = b.id
    LEFT JOIN sectores s ON b.sector_id = s.id
    WHERE d.usuario_id = ? AND d.es_default = 1
    LIMIT 1
  `;
  return queryOne(sql, [usuario_id]);
}

/**
 * Variante de `createAddress` que acepta una conexión (transacción).
 * Útil para crear el usuario y su primera dirección en la misma tx
 * (ej. registro de nuevos clientes).
 */
export async function createAddressWithConnection(addressData, connection) {
  const data = normalizeMapFields(addressData);
  const {
    usuario_id,
    tipo = 'residencia',
    direccion,
    ciudad = 'Gigante, Huila',
    telefono,
    notas,
    es_default = 0,
    barrio_id = null,
    latitud = null,
    longitud = null,
    direccion_formateada = null,
    place_id = null,
  } = data;

  if (!direccion) {
    throw new Error('La dirección es requerida');
  }

  const sql = `
    INSERT INTO direcciones
    (usuario_id, tipo, direccion, ciudad, telefono, notas, es_default, barrio_id,
     latitud, longitud, direccion_formateada, place_id, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const [result] = await connection.query(sql, [
      usuario_id,
      tipo,
      direccion,
      ciudad,
      telefono,
      notas,
      es_default,
      barrio_id,
      latitud,
      longitud,
      direccion_formateada,
      place_id,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando dirección: ${error.message}`);
  }
}

/**
 * Crear nueva dirección.
 * `barrio_id` es opcional. Si viene, debe existir y pertenecer a un sector activo.
 * Los campos de Google Maps (`latitud`, `longitud`, `direccion_formateada`, `place_id`)
 * también son opcionales.
 */
export async function createAddress(addressData) {
  const data = normalizeMapFields(addressData);
  const {
    usuario_id,
    tipo = 'residencia',
    direccion,
    ciudad = 'Gigante, Huila',
    telefono,
    notas,
    es_default = 0,
    barrio_id = null,
    latitud = null,
    longitud = null,
    direccion_formateada = null,
    place_id = null,
  } = data;

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
    (usuario_id, tipo, direccion, ciudad, telefono, notas, es_default, barrio_id,
     latitud, longitud, direccion_formateada, place_id, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      tipo,
      direccion,
      ciudad,
      telefono,
      notas,
      es_default,
      barrio_id,
      latitud,
      longitud,
      direccion_formateada,
      place_id,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando dirección: ${error.message}`);
  }
}

/**
 * Actualizar dirección.
 * Acepta cualquier campo de `ADDRESS_FIELDS`, incluyendo los nuevos de Google Maps.
 */
export async function updateAddress(id, usuario_id, updateData) {
  const fields = Object.keys(updateData).filter(key => ADDRESS_FIELDS.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  // Verificar que la dirección pertenece al usuario
  const address = await getAddressById(id, usuario_id);
  if (!address) {
    throw new Error('Dirección no encontrada');
  }

  // Si es default, desmarcar otras
  if (updateData.es_default === 1) {
    await query(
      'UPDATE direcciones SET es_default = 0 WHERE usuario_id = ? AND id != ?',
      [usuario_id, id]
    );
  }

  const normalized = normalizeMapFields(updateData);

  let sql = 'UPDATE direcciones SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;
    values.push(normalized[field] !== undefined ? normalized[field] : updateData[field]);
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

  await query(
    'UPDATE direcciones SET es_default = 0 WHERE usuario_id = ?',
    [usuario_id]
  );

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
  createAddressWithConnection,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  ADDRESS_FIELDS,
};
