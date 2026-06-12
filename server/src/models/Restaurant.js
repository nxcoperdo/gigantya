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
    // FIX: la migración inicial define la ciudad sin tilde ('Giganta, Huila').
    // Unificamos para evitar inconsistencias al filtrar por ciudad.
    ciudad = 'Giganta, Huila'
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
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, NOW())
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
      ciudad
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
  let sql = `
    SELECT * FROM restaurantes
    WHERE estado = 'activo' AND aprobado = 1
      AND (plan = 'basico' OR fecha_vencimiento_plan IS NULL OR fecha_vencimiento_plan >= NOW())
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

  sql += ' ORDER BY FIELD(plan, "premium", "profesional", "basico"), creado_en DESC';

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
    WHERE r.id = ? AND r.estado = 'activo'
  `;

  const restaurante = await queryOne(sql, [id]);
  
  if (!restaurante) return null;

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
    'fecha_vencimiento_plan',
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

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;

    let value = updateData[field];
    // Stringify objects for JSON columns
    if ((field === 'custom_config' || field === 'configuracion_pagos') && typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
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
  getRestaurants,
  getRestaurantById,
  getRestaurantByUserId,
  updateRestaurant,
  approveRestaurant,
  rejectRestaurant
};

