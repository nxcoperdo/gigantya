import * as RatingModel from '../models/Rating.js';
import * as OrderModel from '../models/Order.js';

export async function rateRestaurant(req, res) {
    try {
        // Extraemos los datos que envía el frontend
        const { restaurante_id, pedido_id, puntuacion, comentario } = req.body;
        const usuario_id = req.user.id; // Suponiendo que tienes un middleware de autenticación

        if (!restaurante_id || !pedido_id || !puntuacion) {
            return res.status(400).json({ error: 'Faltan datos obligatorios: restaurante_id, pedido_id, puntuacion' });
        }

        if (puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({ error: 'La puntuacion debe estar entre 1 y 5' });
        }

        const pedido = await OrderModel.getOrderById(pedido_id);
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        if (pedido.usuario_id !== usuario_id) {
            return res.status(403).json({ error: 'No puedes calificar pedidos de otro usuario' });
        }

        if (pedido.restaurante_id !== Number(restaurante_id)) {
            return res.status(400).json({ error: 'El pedido no pertenece al restaurante indicado' });
        }

        if (pedido.estado !== OrderModel.ORDER_STATES.ENTREGADO) {
            return res.status(400).json({ error: 'Solo puedes calificar pedidos entregados' });
        }


        const success = await RatingModel.createOrUpdateRating(
            usuario_id,
            restaurante_id,
            pedido_id,
            puntuacion,
            comentario || '' // Si no hay comentario, envía un texto vacío
        );

        res.status(200).json({ mensaje: 'Calificación guardada' });
    } catch (error) {
        console.error('Error en rateRestaurant:', error);
        res.status(500).json({ error: 'Error al guardar la calificación' });
    }
}

export async function getMyRatings(req, res) {
  try {
    const ratings = await RatingModel.getUserRatings(req.user.id);
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo tus calificaciones', error: error.message });
  }
}

export async function editRating(req, res) {
  try {
    const { restaurante_id } = req.params;
    const { pedido_id, puntuacion, comentario } = req.body;

    if (!pedido_id) {
      return res.status(400).json({ error: 'pedido_id es requerido para editar la calificacion' });
    }

    if (!puntuacion) {
      return res.status(400).json({ error: 'puntuacion es requerida' });
    }

    if (puntuacion < 1 || puntuacion > 5) {
      return res.status(400).json({ error: 'La puntuacion debe estar entre 1 y 5' });
    }

    const pedido = await OrderModel.getOrderById(pedido_id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (pedido.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes editar una calificacion de otro usuario' });
    }

    if (pedido.restaurante_id !== Number(restaurante_id)) {
      return res.status(400).json({ error: 'El pedido no pertenece al restaurante indicado' });
    }

    await RatingModel.createOrUpdateRating(req.user.id, restaurante_id, pedido_id, puntuacion, comentario || '');
    res.json({ mensaje: 'Calificacion actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando calificacion', error: error.message });
  }
}

export default {
  rateRestaurant,
  getMyRatings,
  editRating
};
