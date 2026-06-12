import express from 'express';
import * as couponController from '../controllers/couponController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/planMiddleware.js';
import * as CouponModel from '../models/Coupon.js';

const router = express.Router();

/**
 * Validar cupón (pública, para checkout)
 */
export async function validateCoupon(req, res) {
  try {
    const { codigo, restaurante_id, total_pedido } = req.query;

    if (!codigo || !restaurante_id || !total_pedido) {
      return res.status(400).json({ error: 'Parámetros requeridos: codigo, restaurante_id, total_pedido' });
    }

    const cupon = await CouponModel.validateCoupon(codigo, restaurante_id, parseFloat(total_pedido));
    res.json({
      valido: true,
      cupon: {
        codigo: cupon.codigo,
        descuento: cupon.descuento,
        tipo_descuento: cupon.tipo_descuento,
        min_compra: cupon.min_compra,
      },
    });
  } catch (error) {
    res.status(400).json({ valido: false, error: error.message });
  }
}

/**
 * Rutas de Gestión de Cupones (Solo Restaurantes)
 *
 * `requirePlanFeature('cupones')` aplica a las mutaciones: lectura de los
 * cupones propios está permitida en cualquier plan (para mostrar el estado
 * "no disponible en tu plan" en la UI).
 */
router.get('/validate', validateCoupon);
router.get('/my-coupons', verifyToken, requireRestaurant, couponController.getMyCoupons);
router.post('/', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.createCoupon);
router.put('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.updateCoupon);
router.delete('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.deleteCoupon);

export default router;
