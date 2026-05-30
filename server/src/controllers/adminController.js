import * as RestaurantModel from '../models/Restaurant.js';
import { query } from '../config/database.js';

/**
 * Obtener todos los restaurantes (pendientes de aprobación y aprobados)
 */
export async function getAllRestaurants(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Solo administradores pueden ver esto' 
      });
    }

    const sql = 'SELECT * FROM restaurantes ORDER BY creado_en DESC';
    const restaurantes = await query(sql);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo restaurantes',
      detalles: error.message 
    });
  }
}

/**
 * Obtener restaurantes pendientes de aprobación
 */
export async function getPendingRestaurants(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Solo administradores pueden ver esto' 
      });
    }

    const sql = 'SELECT * FROM restaurantes WHERE aprobado = 0 AND estado = "activo" ORDER BY creado_en DESC';
    const restaurantes = await query(sql);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo restaurantes pendientes',
      detalles: error.message 
    });
  }
}

/**
 * Aprobar restaurante
 */
export async function approveRestaurant(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Solo administradores pueden aprobar' 
      });
    }

    const { id } = req.params;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    await RestaurantModel.approveRestaurant(id);

    res.json({
      mensaje: 'Restaurante aprobado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error aprobando restaurante',
      detalles: error.message 
    });
  }
}

/**
 * Rechazar restaurante
 */
export async function rejectRestaurant(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Solo administradores pueden rechazar' 
      });
    }

    const { id } = req.params;
    const { razon = '' } = req.body;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({ 
        error: 'Restaurante no encontrado' 
      });
    }

    await RestaurantModel.rejectRestaurant(id);

    res.json({
      mensaje: 'Restaurante rechazado'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error rechazando restaurante',
      detalles: error.message 
    });
  }
}

/**
 * Obtener estadísticas generales
 * TODO: Implementar cálculos más complejos
 */
export async function getStats(req, res) {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Solo administradores pueden ver esto' 
      });
    }

    // Contar usuarios
    const usuarios = await query('SELECT COUNT(*) as total FROM usuarios WHERE estado = "activo"');
    
    // Contar restaurantes
    const restaurantes = await query('SELECT COUNT(*) as total FROM restaurantes WHERE aprobado = 1 AND estado = "activo"');
    
    // Contar pedidos
    const pedidos = await query('SELECT COUNT(*) as total FROM pedidos');
    
    // Ingresos totales
    const ingresos = await query('SELECT SUM(total) as total FROM pedidos WHERE estado = "Entregado"');

    res.json({
      estadisticas: {
        usuarios_totales: usuarios[0]?.total || 0,
        restaurantes_aprobados: restaurantes[0]?.total || 0,
        pedidos_totales: pedidos[0]?.total || 0,
        ingresos_totales: ingresos[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas',
      detalles: error.message 
    });
  }
}

export default {
  getAllRestaurants,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getStats
};

