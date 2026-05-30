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

export default router;

