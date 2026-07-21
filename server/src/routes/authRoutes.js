import express from 'express';
import * as authController from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/google
 * @desc    Login / registro con Google (verifica el ID token de GIS)
 * @access  Public
 */
router.post('/google', authController.googleLogin);

/**
 * @route   GET /api/auth/google/start
 * @desc    Paso 1 del login con Google por redirect (Authorization Code
 *          flow). Usado cuando la app corre como PWA instalada, donde el
 *          botón normal de GIS no puede ver las cuentas ya logueadas.
 * @access  Public
 */
router.get('/google/start', authController.googleOAuthStart);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Paso 2: Google vuelve aquí con el code. Lo canjea, resuelve el
 *          usuario y redirige al frontend con el JWT en el fragment.
 * @access  Public
 */
router.get('/google/callback', authController.googleOAuthCallback);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private
 */
router.get('/me', verifyToken, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil del usuario
 * @access  Private
 */
router.put('/profile', verifyToken, authController.updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.put('/change-password', verifyToken, authController.changePassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar reseteo de contraseña
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resetear contraseña con token
 * @access  Public
 */
router.post('/reset-password', authController.resetPassword);

export default router;

