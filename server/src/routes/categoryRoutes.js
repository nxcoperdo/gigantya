import express from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = express.Router();

/**
 * @route   GET /api/categorias
 * @desc    Obtener todas las categorías globales
 * @access  Public
 */
router.get('/', categoryController.getCategories);

export default router;
