import express from 'express';
import ratingController from '../controllers/ratingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rutas públicas (no requieren autenticación)
router.get('/restaurant/:restaurante_id', ratingController.getRestaurantRatings);

// Rutas protegidas (requieren autenticación)
router.post('/', verifyToken, ratingController.rateRestaurant);
router.get('/me', verifyToken, ratingController.getMyRatings);
router.get('/my-rating/:restaurante_id', verifyToken, ratingController.getUserRating);
router.put('/:restaurante_id', verifyToken, ratingController.editRating);

export default router;
