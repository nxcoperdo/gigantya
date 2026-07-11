import express from 'express';
import * as userController from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Obtener perfil del usuario
 * @access  Private
 */
router.get('/profile', verifyToken, userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Actualizar perfil del usuario
 * @access  Private
 */
router.put('/profile', verifyToken, userController.updateProfile);

/**
 * @route   PUT /api/users/me/onboarding
 * @desc    Actualizar un flag del JSON `usuarios.otros_datos` del usuario
 *          logueado (tour completado, tips dismissed, último acceso).
 *          Body: { key: 'onboarding.tips_dismissed.crear_producto', value: true }
 * @access  Private
 */
router.put('/me/onboarding', verifyToken, userController.updateOnboarding);

export default router;

