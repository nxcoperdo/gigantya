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
    SELECT p.*, c.nombre as categoria_nombre, c.orden as categoria_orden
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.restaurante_id = ? AND p.estado = 'activo'
    ORDER BY c.orden ASC, p.nombre ASC
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
    'disponible',
    // FIX: el campo `destacado` se validaba por plan en
    // productController pero no estaba en allowedFields → era código muerto.
    // Ahora el toggle de destacado realmente persiste.
    'destacado',
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

    // Convertir boolean a 0/1 para los flags
    if (field === 'disponible' || field === 'destacado') {
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

// =============================================================
// Galería de imágenes (plan Profesional/Premium)
// =============================================================

/**
 * Añadir una imagen a la galería del producto.
 * El campo legacy `imagen_url` de la tabla `productos` se mantiene
 * como "foto principal" (la primera imagen que se subió).
 */
export async function addProductImage(producto_id, imagen_url, orden = 0) {
  const sql = `
    INSERT INTO producto_imagenes (producto_id, imagen_url, orden)
    VALUES (?, ?, ?)
  `;
  const result = await query(sql, [producto_id, imagen_url, orden]);
  return result.insertId;
}

/**
 * Listar todas las imágenes de un producto, ordenadas.
 */
export async function getProductImages(producto_id) {
  const sql = `
    SELECT id, imagen_url, orden, creado_en
    FROM producto_imagenes
    WHERE producto_id = ?
    ORDER BY orden ASC, id ASC
  `;
  return query(sql, [producto_id]);
}

/**
 * Eliminar una imagen de la galería.
 */
export async function deleteProductImage(imagen_id, producto_id) {
  const sql = 'DELETE FROM producto_imagenes WHERE id = ? AND producto_id = ?';
  return query(sql, [imagen_id, producto_id]);
}

/**
 * Cuántas imágenes tiene ya un producto (para validar el límite del plan
 * antes de subir más).
 */
export async function countProductImages(producto_id) {
  const sql = 'SELECT COUNT(*) AS total FROM producto_imagenes WHERE producto_id = ?';
  const row = await queryOne(sql, [producto_id]);
  return row?.total || 0;
}

export default {
  createCategory,
  createProduct,
  getProductsByRestaurant,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  searchProducts,
  // Galería de imágenes (plan Profesional/Premium)
  addProductImage,
  getProductImages,
  deleteProductImage,
  countProductImages,
};

