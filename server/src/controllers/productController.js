import * as ProductModel from '../models/Product.js';
import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Obtener productos por restaurante
 */
export async function getProductsByRestaurant(req, res) {
  try {
    const { restaurante_id } = req.params;

    const productos = await ProductModel.getProductsByRestaurant(restaurante_id);

    res.json({
      total: productos.length,
      productos
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ 
      error: 'Error obteniendo productos',
      detalles: error.message 
    });
  }
}

/**
 * Obtener un producto específico
 */
export async function getProduct(req, res) {
  try {
    const { id } = req.params;

    const producto = await ProductModel.getProductById(id);

    if (!producto) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    res.json({
      producto
    });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ 
      error: 'Error obteniendo producto',
      detalles: error.message 
    });
  }
}

/**
 * Crear nuevo producto (solo restaurante owner)
 */
export async function createProduct(req, res) {
  try {
    const { nombre, descripcion, precio, categoria_id, imagen_url } = req.body;

    // Validar que sea restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo restaurantes pueden crear productos' 
      });
    }

    // Obtener restaurante del usuario
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'No tienes un restaurante asociado' 
      });
    }

    // Validaciones
    if (!nombre || !precio) {
      return res.status(400).json({ 
        error: 'Campos requeridos: nombre, precio' 
      });
    }

    if (isNaN(precio) || precio <= 0) {
      return res.status(400).json({ 
        error: 'El precio debe ser un número positivo' 
      });
    }

    // Crear producto
    const productoId = await ProductModel.createProduct({
      restaurante_id: restaurante.id,
      categoria_id,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible: true
    });

    res.status(201).json({
      mensaje: 'Producto creado exitosamente',
      producto_id: productoId
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ 
      error: 'Error creando producto',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar producto (solo restaurante owner)
 */
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validar que sea restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo restaurantes pueden editar productos' 
      });
    }

    // Obtener producto
    const producto = await ProductModel.getProductById(id);

    if (!producto) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Obtener restaurante del usuario
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante || restaurante.id !== producto.restaurante_id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para editar este producto' 
      });
    }

    // Validar precio si se actualiza
    if (updateData.precio && (isNaN(updateData.precio) || updateData.precio <= 0)) {
      return res.status(400).json({ 
        error: 'El precio debe ser un número positivo' 
      });
    }

    await ProductModel.updateProduct(id, updateData);

    res.json({
      mensaje: 'Producto actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ 
      error: 'Error actualizando producto',
      detalles: error.message 
    });
  }
}

/**
 * Eliminar producto (solo restaurante owner)
 */
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    // Validar que sea restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo restaurantes pueden eliminar productos' 
      });
    }

    // Obtener producto
    const producto = await ProductModel.getProductById(id);

    if (!producto) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Obtener restaurante del usuario
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante || restaurante.id !== producto.restaurante_id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para eliminar este producto' 
      });
    }

    await ProductModel.deleteProduct(id);

    res.json({
      mensaje: 'Producto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ 
      error: 'Error eliminando producto',
      detalles: error.message 
    });
  }
}

/**
 * Toggle disponibilidad del producto
 */
export async function toggleProduct(req, res) {
  try {
    const { id } = req.params;

    // Validar que sea restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo restaurantes pueden cambiar disponibilidad' 
      });
    }

    // Obtener producto
    const producto = await ProductModel.getProductById(id);

    if (!producto) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Obtener restaurante del usuario
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante || restaurante.id !== producto.restaurante_id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para cambiar este producto' 
      });
    }

    await ProductModel.toggleProductAvailability(id);

    const nuevoEstado = !producto.disponible;

    res.json({
      mensaje: 'Disponibilidad actualizada',
      disponible: nuevoEstado
    });
  } catch (error) {
    console.error('Error toggling producto:', error);
    res.status(500).json({ 
      error: 'Error toggleando producto',
      detalles: error.message 
    });
  }
}

/**
 * Buscar productos
 */
export async function searchProducts(req, res) {
  try {
    const { restaurante_id } = req.params;
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ 
        error: 'La búsqueda debe tener al menos 2 caracteres' 
      });
    }

    const productos = await ProductModel.searchProducts(restaurante_id, q);

    res.json({
      query: q,
      total: productos.length,
      productos
    });
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({ 
      error: 'Error buscando productos',
      detalles: error.message 
    });
  }
}

/**
 * Subir imagen de producto
 */
export async function uploadProductImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se ha proporcionado ninguna imagen'
      });
    }

    // Guardamos la ruta relativa para que sea consistente con el helper del frontend
    const relativeUrl = `uploads/${req.file.filename}`;

    res.json({
      mensaje: 'Imagen subida exitosamente',
      url: relativeUrl
    });
  } catch (error) {
    console.error('Error subiendo imagen de producto:', error);
    res.status(500).json({
      error: 'Error al subir la imagen',
      detalles: error.message
    });
  }
}

export default {
  getProductsByRestaurant,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProduct,
  searchProducts,
  uploadProductImage // Add this
};

