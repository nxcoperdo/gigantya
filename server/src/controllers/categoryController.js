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
    const { restaurante_id, nombre, descripcion, orden, tipo_negocio } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre es requerido'
      });
    }

    // Normalizar tipo_negocio. Default 'restaurante'. Si llega 'mercado' o
    // 'comida_rapida', forzamos restaurante_id = null (las categorías
    // catálogo son transversales y no pertenecen a ningún restaurante).
    let tipoFinal = 'restaurante';
    if (tipo_negocio !== undefined && tipo_negocio !== null && String(tipo_negocio).trim() !== '') {
      const t = String(tipo_negocio).toLowerCase();
      if (!['restaurante', 'mercado', 'comida_rapida'].includes(t)) {
        return res.status(400).json({
          error: 'tipo_negocio inválido. Valores permitidos: restaurante, mercado, comida_rapida'
        });
      }
      tipoFinal = t;
    }

    let restauranteIdFinal;
    if (tipoFinal === 'mercado' || tipoFinal === 'comida_rapida') {
      // Las categorías catálogo (mercado o comida rápida) son transversales:
      // restaurante_id SIEMPRE null.
      restauranteIdFinal = null;
    } else {
      // Categoría de restaurante: restaurante_id es obligatorio (validación histórica).
      if (restaurante_id === undefined || restaurante_id === null || String(restaurante_id).trim() === '') {
        return res.status(400).json({
          error: 'restaurante_id es requerido para categorías de tipo restaurante'
        });
      }
      restauranteIdFinal = restaurante_id;
    }

    const categoryId = await CategoryModel.createCategory({
      restaurante_id: restauranteIdFinal,
      nombre,
      descripcion: descripcion || '',
      orden: orden || 0,
      tipo_negocio: tipoFinal,
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
    const { restaurante_id, nombre, descripcion, orden, tipo_negocio } = req.body;

    // Verificar que la categoría existe
    const existingCategory = await CategoryModel.getCategoryById(id);
    if (!existingCategory) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }

    // Resolver tipo_negocio efectivo (el actual o el que viene en el body).
    const tipoEfectivo = (tipo_negocio !== undefined && tipo_negocio !== null && String(tipo_negocio).trim() !== '')
      ? String(tipo_negocio).toLowerCase()
      : (existingCategory.tipo_negocio || 'restaurante');

    if (!['restaurante', 'mercado', 'comida_rapida'].includes(tipoEfectivo)) {
      return res.status(400).json({
        error: 'tipo_negocio inválido. Valores permitidos: restaurante, mercado, comida_rapida'
      });
    }

    // Convertir restaurante_id vacío o falsy en null para evitar errores de SQL.
    let restauranteIdFinal;
    if (tipoEfectivo === 'mercado' || tipoEfectivo === 'comida_rapida') {
      // Forzamos null: las categorías catálogo no pertenecen a ningún restaurante.
      restauranteIdFinal = null;
    } else {
      // Restaurante: mantener el valor que llega o el actual si no viene en el body.
      if (restaurante_id === '' || restaurante_id === null) {
        return res.status(400).json({
          error: 'restaurante_id es requerido para categorías de tipo restaurante'
        });
      }
      restauranteIdFinal = (restaurante_id !== undefined) ? restaurante_id : existingCategory.restaurante_id;
    }

    await CategoryModel.updateCategory(id, {
      restaurante_id: restauranteIdFinal,
      nombre,
      descripcion,
      orden,
      tipo_negocio: tipoEfectivo,
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
