import express from 'express';
import * as SubscriptionController from '../controllers/subscriptionController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Catálogo público de planes (no requiere auth)
router.get('/plans', SubscriptionController.getPlans);

// Suscripción actual del restaurante autenticado
router.get('/me', verifyToken, requireRestaurant, SubscriptionController.getMySubscription);
router.get('/me/history', verifyToken, requireRestaurant, SubscriptionController.getMySubscriptionHistory);

export default router;
