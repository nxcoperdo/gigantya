import express from 'express';
import * as couponController from '../controllers/couponController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/planMiddleware.js';

const router = express.Router();

/**
 * Rutas de Gestión de Cupones (Solo Restaurantes)
 *
 * `requirePlanFeature('cupones')` aplica a las mutaciones: lectura de los
 * cupones propios está permitida en cualquier plan (para mostrar el estado
 * "no disponible en tu plan" en la UI).
 */
router.get('/my-coupons', verifyToken, requireRestaurant, couponController.getMyCoupons);
router.post('/', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.createCoupon);
router.put('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.updateCoupon);
router.delete('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.deleteCoupon);

export default router;
