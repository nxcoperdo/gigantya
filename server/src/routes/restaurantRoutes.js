import express from 'express';
import * as restaurantController from '../controllers/restaurantController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/restaurants
 * @desc    Listar todos los restaurantes aprobados
 * @access  Public
 * @query   ciudad, nombre
 */
router.get('/', restaurantController.listRestaurants);

/**
 * @route   GET /api/restaurants/:id
 * @desc    Obtener detalles de un restaurante con su menú
 * @access  Public
 */
router.get('/:id', restaurantController.getRestaurant);

/**
 * @route   POST /api/restaurants
 * @desc    Crear nuevo restaurante (solo restaurante)
 * @access  Private - Restaurant
 */
router.post('/', verifyToken, requireRestaurant, restaurantController.createRestaurant);

/**
 * @route   PUT /api/restaurants/:id
 * @desc    Actualizar restaurante (solo owner)
 * @access  Private - Restaurant
 */
router.put('/:id', verifyToken, requireRestaurant, upload.single('imagen_url'), restaurantController.updateRestaurant);

export default router;

