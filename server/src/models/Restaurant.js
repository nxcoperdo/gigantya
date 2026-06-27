import { query, queryOne } from '../config/database.js';

/**
 * Crear nuevo restaurante
 */
export async function createRestaurant(restaurantData) {
  const {
    usuario_id,
    nombre,
    descripcion,
    direccion,
    telefono,
    horario_apertura,
    horario_cierre,
    imagen_url,
    // FIX: la migración inicial define la ciudad con tilde ('Gigante, Huila').
    // Unificamos para evitar inconsistencias al filtrar por ciudad.
    ciudad = 'Gigante, Huila',
    ofrece_domicilio = true,
  } = restaurantData;

  const sql = `
    INSERT INTO restaurantes (
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      estado,
      aprobado,
      ofrece_domicilio,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      ofrece_domicilio ? 1 : 0
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando restaurante: ${error.message}`);
  }
}

/**
 * Crear nuevo restaurante con una conexión específica (para transacciones)
 */
export async function createRestaurantWithConnection(restaurantData, connection) {
  const {
    usuario_id,
    nombre,
    descripcion,
    direccion,
    telefono,
    horario_apertura,
    horario_cierre,
    imagen_url,
    ciudad = 'Gigante, Huila',
    // Default `true` para mantener compatibilidad con la migración previa
    // (los restaurantes existentes en BD quedan con `ofrece_domicilio = 1`).
    // Al crear uno nuevo desde el admin se respeta lo que el admin haya elegido.
    ofrece_domicilio = true,
  } = restaurantData;

  const sql = `
    INSERT INTO restaurantes (
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      estado,
      aprobado,
      ofrece_domicilio,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, ?, NOW())
  `;

  try {
    const [result] = await connection.query(sql, [
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      // MySQL TINYINT(1): pasamos 1/0 directamente. Boolean() ya nos da un
      // boolean nativo; la coerción a 1/0 la hace el driver en el INSERT.
      ofrece_domicilio ? 1 : 0
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando restaurante: ${error.message}`);
  }
}

/**
 * Obtener todos los restaurantes aprobados
 */
export async function getRestaurants(filtros = {}) {
  // Detectar nombre real de la columna de puntaje en `calificaciones`
  // (la BD puede llamarse `calificacion` o `puntuacion` según la migración).
  const cols = await query("SHOW COLUMNS FROM calificaciones");
  const ratingCol =
    cols.find(c => c.Field === 'calificacion') ? 'calificacion' :
    cols.find(c => c.Field === 'puntuacion') ? 'puntuacion' : null;

  let sql = `
    SELECT r.*,
           COALESCE(AVG(c.${ratingCol ?? 'calificacion'}), 0) AS calificacion_promedio,
           COUNT(c.id) AS total_calificaciones
    FROM restaurantes r
    JOIN usuarios u ON r.usuario_id = u.id
    LEFT JOIN calificaciones c ON c.restaurante_id = r.id
    WHERE r.estado = 'activo'
      AND r.aprobado = 1
      AND u.estado = 'activo'
      AND (r.plan = 'basico' OR r.fecha_vencimiento_plan IS NULL OR r.fecha_vencimiento_plan >= NOW())
  `;
  const params = [];

  if (filtros.ciudad) {
    sql += ' AND ciudad LIKE ?';
    params.push(`%${filtros.ciudad}%`);
  }

  if (filtros.nombre) {
    sql += ' AND nombre LIKE ?';
    params.push(`%${filtros.nombre}%`);
  }

  // Filtro por categoría de producto: el restaurante debe tener al menos
  // un producto activo en una categoría con ese nombre. Mantiene el orden
  // premium → profesional → basico definido más abajo.
  if (filtros.categoria) {
    sql += ` AND EXISTS (
      SELECT 1 FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      WHERE p.restaurante_id = r.id
        AND p.estado = 'activo'
        AND c.nombre = ?
    )`;
    params.push(filtros.categoria);
  }

  // Filtro por modalidad de servicio:
  //   - true  → solo restaurantes con `ofrece_domicilio = 1` (Con domicilios)
  //   - false → solo restaurantes con `ofrece_domicilio = 0` (Solo recoge en local)
  //   - undefined/null → no se filtra (compatibilidad con llamadas existentes).
  // Como la columna tiene DEFAULT 1, MySQL la rellena automáticamente para
  // filas anteriores a esta migración, así que el filtro siempre es seguro.
  if (filtros.ofrece_domicilio === true) {
    sql += ' AND r.ofrece_domicilio = 1';
  } else if (filtros.ofrece_domicilio === false) {
    sql += ' AND r.ofrece_domicilio = 0';
  }

  sql += ' GROUP BY r.id ORDER BY FIELD(plan, "premium", "profesional", "basico"), creado_en DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo restaurantes: ${error.message}`);
  }
}

/**
 * Obtener restaurante por ID con sus productos
 */
export async function getRestaurantById(id) {
  const sql = `
    SELECT r.*
    FROM restaurantes r
    JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.id = ? AND r.estado = 'activo' AND u.estado = 'activo'
  `;

  const restaurante = await queryOne(sql, [id]);
  
  if (!restaurante) return null;

  // Parsear campos JSON
  if (restaurante.configuracion_impuestos) {
    try {
      restaurante.configuracion_impuestos = JSON.parse(restaurante.configuracion_impuestos);
    } catch (e) {
      console.error('Error parsing configuracion_impuestos:', e);
      restaurante.configuracion_impuestos = { activo: true, porcentaje: 8 };
    }
  } else {
    restaurante.configuracion_impuestos = { activo: true, porcentaje: 8 };
  }

  if (restaurante.configuracion_envios) {
    try {
      restaurante.configuracion_envios = JSON.parse(restaurante.configuracion_envios);
    } catch (e) {
      console.error('Error parsing configuracion_envios:', e);
      restaurante.configuracion_envios = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };
    }
  } else {
    restaurante.configuracion_envios = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };
  }

  // Obtener categorías y productos
  const productos = await query(`
    SELECT 
      p.id,
      p.nombre,
      p.descripcion,
      p.precio,
      p.imagen_url,
      p.disponible,
      c.id as categoria_id,
      c.nombre as categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.restaurante_id = ? AND p.estado = 'activo'
    ORDER BY c.nombre, p.nombre
  `, [id]);

  // Agrupar por categoría
  restaurante.productos = {};
  productos.forEach(p => {
    const categoria = p.categoria_nombre || 'Sin categoría';
    if (!restaurante.productos[categoria]) {
      restaurante.productos[categoria] = [];
    }
    restaurante.productos[categoria].push({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      imagen_url: p.imagen_url,
      disponible: p.disponible === 1
    });
  });

  return restaurante;
}

/**
 * Obtener restaurante por usuario_id
 */
export async function getRestaurantByUserId(usuario_id) {
  const sql = 'SELECT * FROM restaurantes WHERE usuario_id = ? LIMIT 1';
  return queryOne(sql, [usuario_id]);
}

/**
 * Obtener datos del usuario propietario del restaurante
 */
export async function getRestaurantUser(restaurante_id) {
  const sql = `
    SELECT u.id, u.email, u.nombre, u.telefono
    FROM usuarios u
    INNER JOIN restaurantes r ON u.id = r.usuario_id
    WHERE r.id = ?
    LIMIT 1
  `;
  return queryOne(sql, [restaurante_id]);
}

/**
 * Obtener usuario por ID
 */
export async function getUserById(id) {
  const sql = 'SELECT id, email, nombre, telefono FROM usuarios WHERE id = ? LIMIT 1';
  return queryOne(sql, [id]);
}

/**
 * Actualizar restaurante
 */
export async function updateRestaurant(id, updateData) {
  const allowedFields = [
    'nombre',
    'descripcion',
    'direccion',
    'telefono',
    'horario_apertura',
    'horario_cierre',
    'imagen_url',
    'plan',
    'banner_url',
    'custom_config',
    'configuracion_impuestos',
    'configuracion_envios',
    'fecha_vencimiento_plan',
    // Modalidad de servicio (toggle en el dashboard del restaurante).
    // - true  → "Ofrece servicio a domicilio"
    // - false → "Solo recoge en local"
    'ofrece_domicilio',
  ];

  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Los datos de actualización deben ser un objeto válido');
  }

  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  let sql = 'UPDATE restaurantes SET ';
  const values = [];

  // Campos booleanos que la columna MySQL guarda como INT/TINYINT (0/1).
  // El frontend los manda como boolean JS → al serializar a JSON se vuelven 'true'/'false',
  // lo que MySQL rechaza con ER_TRUNCATED_WRONG_VALUE_FOR_FIELD. Normalizamos a 0/1 antes de bind.
  const booleanIntFields = new Set(['ofrece_domicilio']);

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;

    let value = updateData[field];
    // Stringify objects for JSON columns
    if ((field === 'custom_config' || field === 'configuracion_pagos' || field === 'configuracion_impuestos' || field === 'configuracion_envios') && typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }
    // Normalizar booleanos a 0/1 para columnas INT.
    if (booleanIntFields.has(field)) {
      value = value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    }
    values.push(value);
  });

  sql += ', actualizado_en = NOW() WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando restaurante: ${error.message}`);
  }
}

/**
 * Aprobar restaurante (solo admin)
 */
export async function approveRestaurant(id) {
  const sql = 'UPDATE restaurantes SET aprobado = 1 WHERE id = ?';
  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error aprobando restaurante: ${error.message}`);
  }
}

/**
 * Rechazar restaurante (solo admin)
 */
export async function rejectRestaurant(id) {
  const sql = 'UPDATE restaurantes SET estado = "rechazado" WHERE id = ?';
  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error rechazando restaurante: ${error.message}`);
  }
}

export default {
  createRestaurant,
  createRestaurantWithConnection,
  getRestaurants,
  getRestaurantById,
  getRestaurantByUserId,
  getRestaurantUser,
  getUserById,
  updateRestaurant,
  approveRestaurant,
  rejectRestaurant
};

