import * as RestaurantModel from '../models/Restaurant.js';
import { query } from '../config/database.js';

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

    // req.files es un objeto con arrays: { imagen_url: [...], banner_url: [...] }
    const files = req.files || {};
    const imagenFile = files.imagen_url?.[0];
    const bannerFile = files.banner_url?.[0];

    if ((!updateData || Object.keys(updateData).length === 0) && !imagenFile && !bannerFile) {
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

    // Si se ha subido un archivo de imagen del restaurante, actualizar la imagen_url en la DB
    if (imagenFile) {
      const filePath = `/uploads/${imagenFile.filename}`;
      await RestaurantModel.updateRestaurant(id, { imagen_url: filePath });
    }

    // Si se ha subido un archivo de banner, actualizar la banner_url en la DB
    if (bannerFile) {
      const filePath = `/uploads/${bannerFile.filename}`;
      await RestaurantModel.updateRestaurant(id, { banner_url: filePath });
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

/**
 * Obtener estadísticas de ventas para el restaurante
 * Solo disponible para planes Profesional y Premium
 */
export async function getRestaurantStats(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    // Control de acceso por plan
    if (restaurante.plan === 'basico') {
      return res.status(403).json({
        error: 'Esta funcionalidad solo está disponible para los planes Profesional y Premium'
      });
    }

    const restauranteId = restaurante.id;

    // Total ingresos
    const ingresos = await query(
      'SELECT SUM(total) as total FROM pedidos WHERE restaurante_id = ? AND estado = "Entregado"',
      [restauranteId]
    );

    // Total pedidos
    const pedidos = await query(
      'SELECT COUNT(*) as total FROM pedidos WHERE restaurante_id = ?',
      [restauranteId]
    );

    // Ventas por día (últimos 30 días)
    const ventasDiarias = await query(
      'SELECT DATE(creado_en) as fecha, SUM(total) as total FROM pedidos WHERE restaurante_id = ? AND estado = "Entregado" GROUP BY fecha ORDER BY fecha DESC LIMIT 30',
      [restauranteId]
    );

    res.json({
      estadisticas: {
        ingresos_totales: ingresos[0]?.total || 0,
        pedidos_totales: pedidos[0]?.total || 0,
        ventas_diarias: ventasDiarias
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      detalles: error.message
    });
  }
}

export default {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  getRestaurantStats
};

