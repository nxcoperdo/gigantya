import { query, queryOne } from '../config/database.js';

/**
 * Crear nueva categoría
 */
export async function createCategory(restaurante_id, nombre, descripcion = '') {
  const sql = `
    INSERT INTO categorias (restaurante_id, nombre, descripcion)
    VALUES (?, ?, ?)
  `;

  try {
    const result = await query(sql, [restaurante_id, nombre, descripcion]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando categoría: ${error.message}`);
  }
}

/**
 * Crear nuevo producto
 */
export async function createProduct(productData) {
  const {
    restaurante_id,
    categoria_id,
    nombre,
    descripcion,
    precio,
    imagen_url,
    disponible = true
  } = productData;

  const sql = `
    INSERT INTO productos (
      restaurante_id,
      categoria_id,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible,
      estado,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', NOW())
  `;

  try {
    const result = await query(sql, [
      restaurante_id,
      categoria_id,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible ? 1 : 0
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando producto: ${error.message}`);
  }
}

/**
 * Obtener productos por restaurante
 */
export async function getProductsByRestaurant(restaurante_id) {
  const sql = `
    SELECT p.* 
    FROM productos p
    WHERE p.restaurante_id = ? AND p.estado = 'activo'
    ORDER BY p.nombre
  `;

  try {
    return await query(sql, [restaurante_id]);
  } catch (error) {
    throw new Error(`Error obteniendo productos: ${error.message}`);
  }
}

/**
 * Obtener producto por ID
 */
export async function getProductById(id) {
  const sql = 'SELECT * FROM productos WHERE id = ? AND estado = "activo"';
  return queryOne(sql, [id]);
}

/**
 * Actualizar producto
 */
export async function updateProduct(id, updateData) {
  const allowedFields = [
    'categoria_id',
    'nombre',
    'descripcion',
    'precio',
    'imagen_url',
    'disponible'
  ];

  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  let sql = 'UPDATE productos SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;
    
    // Convertir boolean a 0/1 para disponible
    if (field === 'disponible') {
      values.push(updateData[field] ? 1 : 0);
    } else {
      values.push(updateData[field]);
    }
  });

  sql += ', actualizado_en = NOW() WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando producto: ${error.message}`);
  }
}

/**
 * Eliminar producto (soft delete)
 */
export async function deleteProduct(id) {
  const sql = 'UPDATE productos SET estado = "eliminado" WHERE id = ?';

  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error eliminando producto: ${error.message}`);
  }
}

/**
 * Toggle disponibilidad de producto
 */
export async function toggleProductAvailability(id) {
  const product = await getProductById(id);
  if (!product) throw new Error('Producto no encontrado');

  return updateProduct(id, {
    disponible: !product.disponible
  });
}

/**
 * Buscar productos
 */
export async function searchProducts(restaurante_id, query_text) {
  const sql = `
    SELECT * FROM productos
    WHERE restaurante_id = ? 
    AND estado = 'activo'
    AND (nombre LIKE ? OR descripcion LIKE ?)
    ORDER BY nombre
  `;

  try {
    return await query(sql, [
      restaurante_id,
      `%${query_text}%`,
      `%${query_text}%`
    ]);
  } catch (error) {
    throw new Error(`Error buscando productos: ${error.message}`);
  }
}

export default {
  createCategory,
  createProduct,
  getProductsByRestaurant,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  searchProducts
};

