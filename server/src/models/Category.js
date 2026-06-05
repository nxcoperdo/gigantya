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

export default {
  getAllCategories,
  getCategoryById
};
