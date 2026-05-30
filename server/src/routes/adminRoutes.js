import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/admin/restaurants
 * @desc    Obtener todos los restaurantes
 * @access  Private - Admin
 */
router.get('/restaurants', verifyToken, requireAdmin, adminController.getAllRestaurants);

/**
 * @route   GET /api/admin/restaurants/pending
 * @desc    Obtener restaurantes pendientes de aprobación
 * @access  Private - Admin
 */
router.get('/restaurants/pending', verifyToken, requireAdmin, adminController.getPendingRestaurants);

/**
 * @route   PUT /api/admin/restaurants/:id/approve
 * @desc    Aprobar restaurante
 * @access  Private - Admin
 */
router.put('/restaurants/:id/approve', verifyToken, requireAdmin, adminController.approveRestaurant);

/**
 * @route   PUT /api/admin/restaurants/:id/reject
 * @desc    Rechazar restaurante
 * @access  Private - Admin
 */
router.put('/restaurants/:id/reject', verifyToken, requireAdmin, adminController.rejectRestaurant);

/**
 * @route   GET /api/admin/stats
 * @desc    Obtener estadísticas generales
 * @access  Private - Admin
 */
router.get('/stats', verifyToken, requireAdmin, adminController.getStats);

export default router;

