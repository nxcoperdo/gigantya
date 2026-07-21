import * as CouponModel from '../models/Coupon.js';
import * as RestaurantModel from '../models/Restaurant.js';
import { canAccessPlan } from '../utils/planFeatures.js';

// =============================================================
// Helpers internos
// =============================================================

/**
 * Lee un cupón por id y resuelve el restaurante del caller (si es
 * local). Usado por update/delete para check de ownership.
 *
 * Devuelve { cupon, restaurante } o lanza un 404-like si el cupón
 * no existe. El controller decide si responde 403 o 404 según el
 * caller.
 */
async function loadCouponForCaller(couponId, reqUser) {
  const cupon = await CouponModel.getCouponById(couponId);
  if (!cupon) return { cupon: null, restaurante: null };

  let restaurante = null;
  if (reqUser.tipo_usuario === 'restaurante') {
    restaurante = await RestaurantModel.getRestaurantByUserId(reqUser.id);
  }
  return { cupon, restaurante };
}

/**
 * Verifica que el caller (restaurante) sea dueño del cupón. Si el
 * cupón es global, devuelve false (el local no puede tocarlo). Si
 * el caller es admin, devuelve true (siempre).
 */
function canMutateCoupon(cupon, restaurante) {
  if (!cupon) return false;
  // Admin puede tocar cualquier cupón (chequeado antes en el controller).
  if (cupon.es_global === 1 || cupon.es_global === true) {
    // El cupón es global: solo admin puede mutarlo. Esta función es
    // para la rama del local, así que devolvemos false.
    return false;
  }
  if (!restaurante) return false;
  return Number(cupon.restaurante_id) === Number(restaurante.id);
}

// =============================================================
// Handlers — cupones del LOCAL (ruta /api/coupons)
// =============================================================

/**
 * Crear cupón del local.
 * Reglas:
 *   - Caller debe ser tipo_usuario='restaurante'.
 *   - Plan debe ser 'profesional' o 'premium' (gateado en el route
 *     por requirePlanFeature y reforzado aquí por seguridad).
 *   - El cupón SIEMPRE es de local (es_global forzado a false aunque
 *     llegue true en el body — los locales no pueden crear cupones
 *     globales, eso es solo del admin).
 */
export async function createCoupon(req, res) {
  try {
    const {
      codigo, descuento, tipo_descuento,
      fecha_expiracion, min_compra, max_compra, usos_maximos
    } = req.body;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo locales pueden crear cupones' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Doble check del plan (el middleware ya lo hace, pero por si
    // alguien llama al controller desde otra ruta). Usamos canAccessPlan
    // para que tanto el plan Básico como el Free queden bloqueados.
    if (!canAccessPlan(restaurante.plan, 'cupones')) {
      return res.status(403).json({
        error: 'La creación de cupones solo está disponible para los planes Profesional, Premium y Golden Plus',
        code: 'FEATURE_NOT_IN_PLAN',
      });
    }

    if (!codigo || !descuento || !tipo_descuento) {
      return res.status(400).json({ error: 'Campos requeridos: codigo, descuento, tipo_descuento' });
    }

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
      fecha_expiracion,
      min_compra: min_compra ?? null,
      max_compra: max_compra ?? null,
      usos_maximos,
      es_global: false
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
 * Obtener cupones del local + globales (read-only para los globales).
 * En modo "panel del local" el dueño ve lo que ofrece la plataforma
 * para entender qué promociones ya están corriendo.
 */
export async function getMyCoupons(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'Local no encontrado' });

    const cupones = await CouponModel.getCouponsByRestaurant(restaurante.id, { includeGlobal: true });
    res.json({ total: cupones.length, cupones });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cupones', detalles: error.message });
  }
}

/**
 * Actualizar cupón (ruta local). Solo el dueño puede.
 */
export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { cupon, restaurante } = await loadCouponForCaller(id, req.user);
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    if (!canMutateCoupon(cupon, restaurante)) {
      // El cupón existe pero no le pertenece al caller. El cliente
      // genérico recibe 404 para no leakear la existencia; aquí
      // 403 está bien porque es un local autenticado intentando
      // tocar algo que no es suyo (o un global).
      return res.status(403).json({ error: 'No tienes permiso para editar este cupón' });
    }

    // Por la ruta local, no permitimos promover a global ni cambiar
    // restaurante_id (esos cambios son del admin).
    delete updateData.es_global;
    delete updateData.restaurante_id;

    await CouponModel.updateCoupon(id, updateData);
    res.json({ mensaje: 'Cupón actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando cupón', detalles: error.message });
  }
}

/**
 * Eliminar cupón (ruta local). Solo el dueño puede.
 */
export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;

    const { cupon, restaurante } = await loadCouponForCaller(id, req.user);
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    if (!canMutateCoupon(cupon, restaurante)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este cupón' });
    }

    await CouponModel.deleteCoupon(id);
    res.json({ mensaje: 'Cupón eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando cupón', detalles: error.message });
  }
}

// =============================================================
// Handlers — cupones ADMIN (ruta /api/admin/coupons)
// =============================================================

/**
 * Listar todos los cupones de la plataforma (admin).
 * Query params: es_global, restaurante_id, activo, codigo, limit, offset.
 */
export async function adminListCoupons(req, res) {
  try {
    const cupones = await CouponModel.getAllCouponsForAdmin(req.query || {});
    res.json({ total: cupones.length, cupones });
  } catch (error) {
    res.status(500).json({ error: 'Error listando cupones', detalles: error.message });
  }
}

/**
 * Listar todos los USOS (redenciones) de cupones (admin).
 * Devuelve una fila por pedido que tuvo cupón, con info del cupón,
 * el cliente, el local (NULL si el cupón era global), el subtotal
 * de los items, el descuento aplicado (recalculado) y el total.
 *
 * Query params:
 *   - cupon_id: filtra por un cupón específico
 *   - restaurante_id: filtra por un local
 *   - es_global: 1/0
 *   - fecha_desde, fecha_hasta: rango (YYYY-MM-DD)
 *   - limit (default 100, max 500), offset: paginación
 */
export async function adminGetCouponUsages(req, res) {
  try {
    const usos = await CouponModel.getCouponUsagesForAdmin(req.query || {});
    res.json({ total: usos.length, usos });
  } catch (error) {
    res.status(500).json({ error: 'Error listando usos de cupones', detalles: error.message });
  }
}

/**
 * Crear cupón como admin. Puede ser:
 *   - es_global: true  → cupón de plataforma (restaurante_id = NULL).
 *   - es_global: false → cupón de un local específico (admin lo crea
 *                       en nombre del local; bypass del plan gate).
 *
 * Decisión: el admin puede crear cupones para locales con plan
 * 'basico' (es una decisión de la plataforma, no del local).
 */
export async function adminCreateCoupon(req, res) {
  try {
    const {
      codigo, descuento, tipo_descuento,
      fecha_expiracion, min_compra, max_compra, usos_maximos,
      es_global = false, restaurante_id = null
    } = req.body;

    if (!codigo || !descuento || !tipo_descuento) {
      return res.status(400).json({ error: 'Campos requeridos: codigo, descuento, tipo_descuento' });
    }

    const esGlobalBool = es_global === true || es_global === 1 || es_global === '1';

    // Si es local, validar que restaurante_id exista.
    if (!esGlobalBool) {
      if (!restaurante_id) {
        return res.status(400).json({
          error: 'Cupón de local requiere restaurante_id'
        });
      }
      const restaurante = await RestaurantModel.getRestaurantById(restaurante_id);
      if (!restaurante) {
        return res.status(404).json({ error: 'Local no encontrado' });
      }
    }

    if (min_compra !== undefined && min_compra !== null
        && max_compra !== undefined && max_compra !== null
        && Number(max_compra) < Number(min_compra)) {
      return res.status(400).json({
        error: 'El monto máximo debe ser mayor o igual al monto mínimo'
      });
    }

    const couponId = await CouponModel.createCoupon({
      restaurante_id: esGlobalBool ? null : restaurante_id,
      codigo,
      descuento,
      tipo_descuento,
      fecha_expiracion,
      min_compra: min_compra ?? null,
      max_compra: max_compra ?? null,
      usos_maximos,
      es_global: esGlobalBool
    });

    res.status(201).json({ mensaje: 'Cupón creado exitosamente', couponId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando cupón', detalles: error.message });
  }
}

/**
 * Ver un cupón (admin). Útil para la UI admin antes de editar.
 */
export async function adminGetCoupon(req, res) {
  try {
    const { id } = req.params;
    const cupon = await CouponModel.getCouponById(id);
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    res.json({ cupon });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cupón', detalles: error.message });
  }
}

/**
 * Actualizar cupón (admin). Sin check de ownership: el admin puede
 * tocar cualquier cupón (incluido cambiar es_global y restaurante_id).
 */
export async function adminUpdateCoupon(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body || {};

    const cupon = await CouponModel.getCouponById(id);
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }

    // Si el admin quiere cambiar de local a global (o vice versa),
    // el modelo se encarga del invariante; aquí solo validamos que
    // restaurante_id, si viene, exista.
    if (updateData.restaurante_id !== undefined && updateData.restaurante_id !== null) {
      const r = await RestaurantModel.getRestaurantById(updateData.restaurante_id);
      if (!r) {
        return res.status(404).json({ error: 'Local no encontrado' });
      }
    }

    await CouponModel.updateCoupon(id, updateData);
    res.json({ mensaje: 'Cupón actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando cupón', detalles: error.message });
  }
}

/**
 * Eliminar cupón (admin). Sin check de ownership.
 */
export async function adminDeleteCoupon(req, res) {
  try {
    const { id } = req.params;
    const cupon = await CouponModel.getCouponById(id);
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
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
  deleteCoupon,
  adminListCoupons,
  adminGetCouponUsages,
  adminCreateCoupon,
  adminGetCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon
};
