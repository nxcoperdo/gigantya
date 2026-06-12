import * as CategoryModel from '../models/Category.js';

/**
 * Obtener lista de categorías globales con nombre de restaurante (para admin)
 */
export async function getCategories(req, res) {
  try {
    const categorias = await CategoryModel.getAllCategoriesWithRestaurantName();
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

/**
 * Crear una nueva categoría
 */
export async function createCategory(req, res) {
  try {
    const { restaurante_id, nombre, descripcion, orden } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre es requerido'
      });
    }

    // Convertir restaurante_id vacío o falsy en null para evitar errores de SQL
    const restauranteIdFinal = (restaurante_id && String(restaurante_id).trim() !== '')
      ? restaurante_id
      : null;

    const categoryId = await CategoryModel.createCategory({
      restaurante_id: restauranteIdFinal,
      nombre,
      descripcion: descripcion || '',
      orden: orden || 0
    });

    res.status(201).json({
      mensaje: 'Categoría creada exitosamente',
      categoryId
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      error: 'Error creando categoría',
      detalles: error.message
    });
  }
}

/**
 * Actualizar una categoría existente
 */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { restaurante_id, nombre, descripcion, orden } = req.body;

    // Convertir restaurante_id vacío o falsy en null para evitar errores de SQL
    const restauranteIdFinal = (restaurante_id !== undefined && (restaurante_id && String(restaurante_id).trim() !== ''))
      ? restaurante_id
      : (restaurante_id === '' ? null : restaurante_id);

    // Verificar que la categoría existe
    const existingCategory = await CategoryModel.getCategoryById(id);
    if (!existingCategory) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }

    await CategoryModel.updateCategory(id, {
      restaurante_id: restauranteIdFinal,
      nombre,
      descripcion,
      orden
    });

    res.json({
      mensaje: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({
      error: 'Error actualizando categoría',
      detalles: error.message
    });
  }
}

/**
 * Eliminar una categoría
 */
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    // Verificar que la categoría existe
    const existingCategory = await CategoryModel.getCategoryById(id);
    if (!existingCategory) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }

    await CategoryModel.deleteCategory(id);

    res.json({
      mensaje: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      error: 'Error eliminando categoría',
      detalles: error.message
    });
  }
}

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
