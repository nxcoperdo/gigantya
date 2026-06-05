import * as CategoryModel from '../models/Category.js';

/**
 * Obtener lista de categorías globales
 */
export async function getCategories(req, res) {
  try {
    const categorias = await CategoryModel.getAllCategories();
    res.json({
      total: categorias.length,
      categorias
    });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      error: 'Error obteniendo categorías',
      detalles: error.message
    });
  }
}

export default {
  getCategories
};
