import * as ProductModel from '../models/Product.js';
import * as RestaurantModel from '../models/Restaurant.js';
import { canAccessPlan, getPlanLimit } from '../utils/planFeatures.js';

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
 * Listar productos de todos los restaurantes (feed público de la home).
 * Acepta `?categoria=<nombre>` para filtrar.
 */
export async function listProducts(req, res) {
  try {
    const { categoria } = req.query;
    const filtros = {};
    if (categoria) filtros.categoria = categoria;

    const productos = await ProductModel.getAllProducts(filtros);

    res.json({
      total: productos.length,
      productos
    });
  } catch (error) {
    console.error('Error listando productos:', error);
    res.status(500).json({
      error: 'Error listando productos',
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

    // Validar que sea el dueño y el plan permita destacar el producto
    if (updateData.destacado === 1 || updateData.destacado === true) {
      if (restaurante.plan === 'basico') {
        return res.status(403).json({
          error: 'La función de destacar productos solo está disponible para planes Profesional y Premium'
        });
      }
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
 * Subir imagen de producto (foto principal — funciona para todos los planes).
 * Para galería de fotos adicionales usar `addProductGallery`.
 */
export async function uploadProductImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se ha proporcionado ninguna imagen'
      });
    }

    const relativeUrl = `uploads/${req.file.filename}`;
    res.json({ mensaje: 'Imagen subida exitosamente', url: relativeUrl });
  } catch (error) {
    console.error('Error subiendo imagen de producto:', error);
    res.status(500).json({
      error: 'Error al subir la imagen',
      detalles: error.message
    });
  }
}

/**
 * Subir varias imágenes a la galería de un producto.
 * Requiere plan Profesional o Premium (`multiples_fotos: true`).
 *
 * El frontend debe hacer POST a este endpoint con `multipart/form-data`
 * y campo `images` (múltiples archivos). El servidor valida que la
 * cantidad total no supere el límite del plan.
 */
export async function addProductGallery(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron imágenes' });
    }

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden subir imágenes' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'No tienes un restaurante asociado' });
    }

    if (!canAccessPlan(restaurante.plan, 'multiples_fotos')) {
      return res.status(403).json({
        error: 'La galería de fotos está disponible en planes Profesional y Premium',
        currentPlan: restaurante.plan,
        code: 'FEATURE_NOT_IN_PLAN',
      });
    }

    const { producto_id } = req.body;
    if (!producto_id) {
      return res.status(400).json({ error: 'Falta producto_id' });
    }

    const producto = await ProductModel.getProductById(producto_id);
    if (!producto || producto.restaurante_id !== restaurante.id) {
      return res.status(403).json({ error: 'Producto no encontrado o sin permiso' });
    }

    const limite = getPlanLimit(restaurante.plan, 'fotos_por_producto');
    const existentes = await ProductModel.countProductImages(producto_id);
    const disponibles = Math.max(0, limite - existentes);

    if (req.files.length > disponibles) {
      return res.status(400).json({
        error: `Tu plan permite hasta ${limite} fotos por producto. Ya tienes ${existentes}, puedes agregar ${disponibles} más.`,
        limite,
        existentes,
      });
    }

    // La primera imagen subida también actualiza `imagen_url` del producto
    // (foto principal legacy). El resto se inserta en producto_imagenes.
    const urls = req.files.map((f) => `uploads/${f.filename}`);
    const insertedIds = [];
    for (let i = 0; i < req.files.length; i++) {
      const newId = await ProductModel.addProductImage(producto_id, urls[i], existentes + i);
      insertedIds.push(newId);
    }

    // Si el producto aún no tiene foto principal, usar la primera
    if (!producto.imagen_url) {
      await ProductModel.updateProduct(producto_id, { imagen_url: urls[0] });
    }

    res.status(201).json({
      mensaje: 'Imágenes agregadas a la galería',
      imagenes: req.files.map((f, i) => ({ id: insertedIds[i], url: urls[i] })),
      total: existentes + req.files.length,
      limite,
    });
  } catch (error) {
    console.error('Error subiendo galería:', error);
    res.status(500).json({ error: 'Error al subir imágenes', detalles: error.message });
  }
}

/**
 * Listar galería completa de un producto.
 */
export async function getProductGallery(req, res) {
  try {
    const { producto_id } = req.params;
    const imagenes = await ProductModel.getProductImages(producto_id);
    res.json({ total: imagenes.length, imagenes });
  } catch (error) {
    res.status(500).json({ error: 'Error listando galería', detalles: error.message });
  }
}

/**
 * Eliminar una imagen de la galería.
 */
export async function deleteProductGalleryImage(req, res) {
  try {
    const { producto_id, imagen_id } = req.params;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden eliminar imágenes' });
    }
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'Restaurante no encontrado' });

    const producto = await ProductModel.getProductById(producto_id);
    if (!producto || producto.restaurante_id !== restaurante.id) {
      return res.status(403).json({ error: 'Producto no encontrado o sin permiso' });
    }

    await ProductModel.deleteProductImage(imagen_id, producto_id);
    res.json({ mensaje: 'Imagen eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando imagen', detalles: error.message });
  }
}

export default {
  getProductsByRestaurant,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProduct,
  searchProducts,
  uploadProductImage,
  // Galería (planes Profesional/Premium)
  addProductGallery,
  getProductGallery,
  deleteProductGalleryImage,
};

