import { query } from '../config/database.js';

/**
 * Obtener todas las categorías globales ordenadas por el campo 'orden'
 */
export async function getAllCategories() {
  const sql = 'SELECT id, nombre, descripcion, orden FROM categorias ORDER BY orden ASC';

  try {
    return await query(sql);
  } catch (error) {
    throw new Error(`Error obteniendo categorías: ${error.message}`);
  }
}

/**
 * Obtener todas las categorías con el nombre del restaurante (para admin)
 *
 * Ordenamiento:
 *   1) `orden` ASC (prioridad manual que el admin asigna)
 *   2) `nombre` ASC como desempate alfabético (case-insensitive).
 * Esto garantiza que cuando hay empate en `orden`, las categorías aparezcan en
 * orden alfabético A→Z en el admin y en el selector de la home pública.
 */
export async function getAllCategoriesWithRestaurantName() {
  const sql = `
    SELECT c.id, c.nombre, c.descripcion, c.orden, c.tipo_negocio, r.nombre as restaurante_nombre
    FROM categorias c
    LEFT JOIN restaurantes r ON c.restaurante_id = r.id
    ORDER BY c.orden ASC, LOWER(c.nombre) ASC
  `;

  try {
    return await query(sql);
  } catch (error) {
    throw new Error(`Error obteniendo categorías con restaurante: ${error.message}`);
  }
}

/**
 * Obtener una categoría por ID
 */
export async function getCategoryById(id) {
  const sql = 'SELECT * FROM categorias WHERE id = ?';

  try {
    const results = await query(sql, [id]);
    return results[0];
  } catch (error) {
    throw new Error(`Error obteniendo categoría: ${error.message}`);
  }
}

/**
 * Crear una nueva categoría
 */
export async function createCategory(categoryData) {
  const {
    restaurante_id,
    nombre,
    descripcion = '',
    orden = 0,
    // Tipo de negocio: 'restaurante' (default, categoría por restaurante)
    // o 'mercado' (catálogo transversal de los locales marcados como
    // `es_mercado_abarrotes = 1`).
    tipo_negocio = 'restaurante',
  } = categoryData;

  const sql = `
    INSERT INTO categorias (
      restaurante_id,
      nombre,
      descripcion,
      orden,
      tipo_negocio,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      restaurante_id,
      nombre,
      descripcion,
      orden,
      tipo_negocio,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando categoría: ${error.message}`);
  }
}

/**
 * Actualizar una categoría existente
 */
export async function updateCategory(id, categoryData) {
  const {
    restaurante_id,
    nombre,
    descripcion,
    orden
  } = categoryData;

  // Construir la consulta dinámicamente basado en los campos proporcionados
  const updates = [];
  const values = [];

  if (restaurante_id !== undefined) {
    updates.push('restaurante_id = ?');
    values.push(restaurante_id);
  }

  if (nombre !== undefined) {
    updates.push('nombre = ?');
    values.push(nombre);
  }

  if (descripcion !== undefined) {
    updates.push('descripcion = ?');
    values.push(descripcion);
  }

  if (orden !== undefined) {
    updates.push('orden = ?');
    values.push(orden);
  }

  if (tipo_negocio !== undefined) {
    updates.push('tipo_negocio = ?');
    values.push(tipo_negocio);
  }

  if (updates.length === 0) {
    throw new Error('No se proporcionaron campos para actualizar');
  }

  values.push(id); // para el WHERE

  const sql = `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`;

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando categoría: ${error.message}`);
  }
}

/**
 * Eliminar una categoría por ID
 */
export async function deleteCategory(id) {
  const sql = 'DELETE FROM categorias WHERE id = ?';

  try {
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error eliminando categoría: ${error.message}`);
  }
}

export default {
  getAllCategories,
  getAllCategoriesWithRestaurantName,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
