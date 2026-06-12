import express from 'express';
import * as adminController from '../controllers/adminController.js';
import * as categoryController from '../controllers/categoryController.js';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Rutas de Usuarios (Gestión Total)
 */
router.get('/users', verifyToken, requireAdmin, adminController.getAllUsers);
router.post('/users', verifyToken, requireAdmin, adminController.adminCreateUser);
router.put('/users/:id/status', verifyToken, requireAdmin, adminController.updateUserStatus);
router.put('/users/:id', verifyToken, requireAdmin, adminController.updateUser);
router.delete('/users/:id', verifyToken, requireAdmin, adminController.deleteUser);

/**
 * Rutas de Restaurantes
 */
router.get('/restaurants', verifyToken, requireAdmin, adminController.getAllRestaurants);
router.get('/restaurants/pending', verifyToken, requireAdmin, adminController.getPendingRestaurants);
router.put('/restaurants/:id/approve', verifyToken, requireAdmin, adminController.approveRestaurant);
router.put('/restaurants/:id/reject', verifyToken, requireAdmin, adminController.rejectRestaurant);
router.put('/restaurants/:id/plan', verifyToken, requireAdmin, adminController.updateRestaurantPlan);
router.get('/restaurants/:id/subscriptions', verifyToken, requireAdmin, adminController.getRestaurantSubscriptionHistory);

/**
 * Rutas de Pedidos Globales
 */
router.get('/orders', verifyToken, requireAdmin, adminController.getAllOrders);
router.put('/orders/:id/status', verifyToken, requireAdmin, adminController.updateOrderStatus);

/**
 * Comunicación y Notificaciones
 */
router.post('/notifications/global', verifyToken, requireAdmin, adminController.sendGlobalNotification);

/**
 * Rutas de Estadísticas y Analytics
 */
router.get('/stats', verifyToken, requireAdmin, adminController.getStats);
router.get('/analytics', verifyToken, requireAdmin, adminController.getAdvancedAnalytics);

/**
 * Rutas de Gestión de Categorías (Admin)
 */
router.get('/categorias', verifyToken, requireAdmin, categoryController.getCategories);
router.post('/categorias', verifyToken, requireAdmin, categoryController.createCategory);
router.put('/categorias/:id', verifyToken, requireAdmin, categoryController.updateCategory);
router.delete('/categorias/:id', verifyToken, requireAdmin, categoryController.deleteCategory);

export default router;
