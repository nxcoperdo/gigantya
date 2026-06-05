import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Listar todos los restaurantes aprobados
 */
export async function listRestaurants(req, res) {
  try {
    const { ciudad, nombre } = req.query;
    const filtros = {};

    if (ciudad) filtros.ciudad = ciudad;
    if (nombre) filtros.nombre = nombre;

    const restaurantes = await RestaurantModel.getRestaurants(filtros);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    console.error('Error listando restaurantes:', error);
    res.status(500).json({ 
      error: 'Error listando restaurantes',
      detalles: error.message 
    });
  }
}

/**
 * Obtener detalles de un restaurante con su menú
 */
export async function getRestaurant(req, res) {
  try {
    const { id } = req.params;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    res.json({
      restaurante
    });
  } catch (error) {
    console.error('Error obteniendo restaurante:', error);
    res.status(500).json({ 
      error: 'Error obteniendo restaurante',
      detalles: error.message 
    });
  }
}

/**
 * Crear nuevo restaurante (solo para usuarios tipo restaurante)
 */
export async function createRestaurant(req, res) {
  try {
    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url
    } = req.body;

    // Validar que sea tipo restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo los usuarios tipo restaurante pueden crear restaurantes' 
      });
    }

    // Validaciones
    if (!nombre || !descripcion || !direccion || !telefono) {
      return res.status(400).json({ 
        error: 'Campos requeridos: nombre, descripcion, direccion, telefono' 
      });
    }

    // Verificar que no tenga otro restaurante
    const restauranteExistente = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (restauranteExistente) {
      return res.status(409).json({ 
        error: 'Ya tienes un restaurante registrado' 
      });
    }

    // Crear restaurante
    const restauranteId = await RestaurantModel.createRestaurant({
      usuario_id: req.user.id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url
    });

    res.status(201).json({
      mensaje: 'Restaurante creado exitosamente. Pendiente de aprobación del administrador.',
      restaurante_id: restauranteId
    });
  } catch (error) {
    console.error('Error creando restaurante:', error);
    res.status(500).json({ 
      error: 'Error creando restaurante',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar restaurante (solo owner)
 */
export async function updateRestaurant(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if ((!updateData || Object.keys(updateData).length === 0) && !req.file) {
      return res.status(400).json({
        error: 'No se proporcionaron datos ni imágenes para actualizar'
      });
    }

    // Verificar que sea el dueño
    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    if (restaurante.usuario_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'No tienes permiso para editar este restaurante' 
      });
    }

    if (updateData && Object.keys(updateData).length > 0) {
      await RestaurantModel.updateRestaurant(id, updateData);
    }

    // Si se ha subido un archivo, actualizar la imagen_url en la DB
    if (req.file) {
      const filePath = `/uploads/${req.file.filename}`;
      await RestaurantModel.updateRestaurant(id, { imagen_url: filePath });
    }

    res.json({
      mensaje: 'Restaurante actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando restaurante:', error);
    res.status(500).json({ 
      error: 'Error actualizando restaurante',
      detalles: error.message 
    });
  }
}

export default {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant
};

