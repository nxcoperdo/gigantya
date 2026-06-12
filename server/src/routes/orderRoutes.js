import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { verifyToken, requireClient, requireRestaurant } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/orders
 * @desc    Crear nuevo pedido (solo cliente)
 * @access  Private - Client
 */
router.post('/', verifyToken, requireClient, orderController.createOrder);

/**
 * @route   GET /api/orders/client/my-orders
 * @desc    Obtener histórico de pedidos del cliente
 * @access  Private - Client
 * @query   estado, limit
 */
router.get('/client/my-orders', verifyToken, requireClient, orderController.getClientOrders);

/**
 * @route   GET /api/orders/restaurant/my-orders
 * @desc    Obtener pedidos del restaurante
 * @access  Private - Restaurant
 * @query   estado (opcional)
 */
router.get('/restaurant/my-orders', verifyToken, requireRestaurant, orderController.getRestaurantOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Obtener detalles de un pedido
 * @access  Private
 */
router.get('/:id', verifyToken, orderController.getOrder);

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Actualizar estado del pedido (solo restaurante o admin)
 * @access  Private
 */
router.put('/:id/status', verifyToken, orderController.updateOrderStatus);

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancelar pedido con motivo (cliente, restaurante o admin)
 * @access  Private
 */
router.put('/:id/cancel', verifyToken, orderController.cancelOrder);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Cancelar pedido (solo cliente dueño del pedido)
 * @access  Private - Client
 */
router.delete('/:id', verifyToken, requireClient, orderController.cancelOrder);

export default router;

