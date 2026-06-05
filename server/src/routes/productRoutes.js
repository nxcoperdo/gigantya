import express from 'express';
import * as productController from '../controllers/productController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/products/upload
 * @desc    Subir imagen de producto (solo restaurante)
 * @access  Private - Restaurant
 */
router.post('/upload', verifyToken, requireRestaurant, upload.single('image'), productController.uploadProductImage);

/**
 * @route   GET /api/products/restaurant/:restaurante_id
 * @desc    Obtener productos de un restaurante
 * @access  Public
 */
router.get('/restaurant/:restaurante_id', productController.getProductsByRestaurant);

/**
 * @route   GET /api/products/search/:restaurante_id
 * @desc    Buscar productos
 * @access  Public
 * @query   q (query string)
 */
router.get('/search/:restaurante_id', productController.searchProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Obtener un producto específico
 * @access  Public
 */
router.get('/:id', productController.getProduct);

/**
 * @route   POST /api/products
 * @desc    Crear nuevo producto (solo restaurante)
 * @access  Private - Restaurant
 */
router.post('/', verifyToken, requireRestaurant, productController.createProduct);

/**
 * @route   PUT /api/products/:id
 * @desc    Actualizar producto (solo restaurante owner)
 * @access  Private - Restaurant
 */
router.put('/:id', verifyToken, requireRestaurant, productController.updateProduct);

/**
 * @route   DELETE /api/products/:id
 * @desc    Eliminar producto (solo restaurante owner)
 * @access  Private - Restaurant
 */
router.delete('/:id', verifyToken, requireRestaurant, productController.deleteProduct);

/**
 * @route   PATCH /api/products/:id/toggle
 * @desc    Toggle disponibilidad del producto (solo restaurante owner)
 * @access  Private - Restaurant
 */
router.patch('/:id/toggle', verifyToken, requireRestaurant, productController.toggleProduct);

export default router;

