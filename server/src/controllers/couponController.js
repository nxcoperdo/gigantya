import * as CouponModel from '../models/Coupon.js';
import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Crear cupón (Solo Profesional y Premium)
 */
export async function createCoupon(req, res) {
  try {
    const { codigo, descuento, tipo_descuento, fecha_expiracion, min_compra, max_compra, usos_maximos } = req.body;

    // Verificar que sea restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden crear cupones' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    // Validación de Plan
    if (restaurante.plan === 'basico') {
      return res.status(403).json({
        error: 'La creación de cupones solo está disponible para los planes Profesional y Premium'
      });
    }

    if (!codigo || !descuento || !tipo_descuento) {
      return res.status(400).json({ error: 'Campos requeridos: codigo, descuento, tipo_descuento' });
    }

    // Validar rango min/max coherente: si ambos vienen, max debe ser >= min.
    if (min_compra !== undefined && min_compra !== null
        && max_compra !== undefined && max_compra !== null
        && Number(max_compra) < Number(min_compra)) {
      return res.status(400).json({
        error: 'El monto máximo debe ser mayor o igual al monto mínimo'
      });
    }

    const couponId = await CouponModel.createCoupon({
      restaurante_id: restaurante.id,
      codigo,
      descuento,
      tipo_descuento,
      // FIX: el código tenía un typo (`fecha_expirsacion`) que enviaba
      // undefined a la query. Ahora la fecha de expiración se guarda
      // correctamente y el cupón puede ser limitado en el tiempo.
      fecha_expiracion,
      min_compra: min_compra ?? null,
      max_compra: max_compra ?? null,
      usos_maximos
    });

    res.status(201).json({
      mensaje: 'Cupón creado exitosamente',
      couponId
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creando cupón', detalles: error.message });
  }
}

/**
 * Obtener cupones del restaurante
 */
export async function getMyCoupons(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'Restaurante no encontrado' });

    const cupones = await CouponModel.getCouponsByRestaurant(restaurante.id);
    res.json({ total: cupones.length, cupones });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cupones', detalles: error.message });
  }
}

/**
 * Actualizar cupón
 */
export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    await CouponModel.updateCoupon(id, updateData);
    res.json({ mensaje: 'Cupón actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando cupón', detalles: error.message });
  }
}

/**
 * Eliminar cupón
 */
export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    await CouponModel.deleteCoupon(id);
    res.json({ mensaje: 'Cupón eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando cupón', detalles: error.message });
  }
}

export default {
  createCoupon,
  getMyCoupons,
  updateCoupon,
  deleteCoupon
};
