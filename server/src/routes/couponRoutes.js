import express from 'express';
import * as couponController from '../controllers/couponController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/planMiddleware.js';
import * as CouponModel from '../models/Coupon.js';

const router = express.Router();

/**
 * Validar cupón (pública, para checkout).
 *
 * Query params:
 *   - codigo          (requerido)
 *   - restaurante_id  (requerido para cupones de local; opcional si
 *                      es_carrito_multi_local=true)
 *   - total_pedido    (requerido)
 *   - es_carrito_multi_local (opcional, "1" / "true"): si el carrito
 *                      tiene productos de varios locales. En ese caso
 *                      se buscan cupones GLOBALES (el cupón de local
 *                      no puede aplicar porque no sabés a cuál local
 *                      cobrarle).
 */
export async function validateCoupon(req, res) {
  try {
    const {
      codigo,
      restaurante_id,
      total_pedido,
      es_carrito_multi_local
    } = req.query;

    if (!codigo || !total_pedido) {
      return res.status(400).json({
        error: 'Parámetros requeridos: codigo, total_pedido'
      });
    }

    const esCarritoMulti = es_carrito_multi_local === '1' || es_carrito_multi_local === 'true';

    // restaurante_id es requerido salvo que sea carrito multi-local
    // (donde solo nos interesan cupones globales).
    if (!esCarritoMulti && !restaurante_id) {
      return res.status(400).json({
        error: 'Parámetros requeridos: codigo, restaurante_id, total_pedido'
      });
    }

    const cupon = await CouponModel.validateCoupon(
      codigo,
      esCarritoMulti ? null : restaurante_id,
      parseFloat(total_pedido),
      { es_carrito_multi_local: esCarritoMulti }
    );

    res.json({
      valido: true,
      cupon: {
        codigo: cupon.codigo,
        descuento: cupon.descuento,
        tipo_descuento: cupon.tipo_descuento,
        min_compra: cupon.min_compra,
        es_global: cupon.es_global === 1 || cupon.es_global === true
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
 *
 * El check de ownership (que el cupón sea del local del caller) está
 * dentro de cada controller, no a nivel de middleware — porque depende
 * del campo `restaurante_id` del cupón que se está tocando.
 */
router.get('/validate', validateCoupon);
router.get('/my-coupons', verifyToken, requireRestaurant, couponController.getMyCoupons);
router.post('/', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.createCoupon);
router.put('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.updateCoupon);
router.delete('/:id', verifyToken, requireRestaurant, requirePlanFeature('cupones'), couponController.deleteCoupon);

export default router;
