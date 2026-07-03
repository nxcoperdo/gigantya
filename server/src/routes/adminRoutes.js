import express from 'express';
import * as adminController from '../controllers/adminController.js';
import * as categoryController from '../controllers/categoryController.js';
import * as zonaController from '../controllers/zonaController.js';
import * as restaurantShippingController from '../controllers/restaurantShippingController.js';
import * as couponController from '../controllers/couponController.js';
import * as SectorModel from '../models/Sector.js';
import * as BarrioModel from '../models/Barrio.js';
import { query, queryOne } from '../config/database.js';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Helpers inline para CRUD de sectores y barrios. Se mantienen aquí porque son
 * muy delgados (delegan a los modelos) y solo los usa el admin.
 */
async function _createSector(req, res) {
  try {
    const { nombre, ciudad, orden, activo } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del sector es requerido' });
    }
    const id = await SectorModel.createSector({ nombre, ciudad, orden, activo });
    const sector = await SectorModel.getSectorById(id);
    res.status(201).json({ mensaje: 'Sector creado', sector });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un sector con ese nombre en esa ciudad' });
    }
    res.status(500).json({ error: 'Error creando sector', detalles: error.message });
  }
}

async function _updateSector(req, res) {
  try {
    const { id } = req.params;
    const exists = await SectorModel.getSectorById(Number(id));
    if (!exists) return res.status(404).json({ error: 'Sector no encontrado' });
    await SectorModel.updateSector(Number(id), req.body || {});
    const sector = await SectorModel.getSectorById(Number(id));
    res.json({ mensaje: 'Sector actualizado', sector });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando sector', detalles: error.message });
  }
}

async function _deleteSector(req, res) {
  try {
    const { id } = req.params;
    await SectorModel.deleteSector(Number(id));
    res.json({ mensaje: 'Sector eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando sector', detalles: error.message });
  }
}

async function _createBarrio(req, res) {
  try {
    const { nombre, sector_id, activo } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del barrio es requerido' });
    }
    if (!sector_id) {
      return res.status(400).json({ error: 'El sector es requerido' });
    }
    const id = await BarrioModel.createBarrio({ nombre, sector_id, activo });
    const barrio = await BarrioModel.getBarrioById(id);
    res.status(201).json({ mensaje: 'Barrio creado', barrio });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un barrio con ese nombre en ese sector' });
    }
    res.status(500).json({ error: 'Error creando barrio', detalles: error.message });
  }
}

async function _updateBarrio(req, res) {
  try {
    const { id } = req.params;
    const exists = await BarrioModel.getBarrioById(Number(id));
    if (!exists) return res.status(404).json({ error: 'Barrio no encontrado' });
    await BarrioModel.updateBarrio(Number(id), req.body || {});
    const barrio = await BarrioModel.getBarrioById(Number(id));
    res.json({ mensaje: 'Barrio actualizado', barrio });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando barrio', detalles: error.message });
  }
}

async function _deleteBarrio(req, res) {
  try {
    const { id } = req.params;
    await BarrioModel.deleteBarrio(Number(id));
    res.json({ mensaje: 'Barrio eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando barrio', detalles: error.message });
  }
}

/**
 * Rutas de Usuarios (Gestión Total)
 */
router.get('/users', verifyToken, requireAdmin, adminController.getAllUsers);
router.post('/users', verifyToken, requireAdmin, adminController.adminCreateUser);
router.put('/users/:id/status', verifyToken, requireAdmin, adminController.updateUserStatus);
router.put('/users/:id', verifyToken, requireAdmin, adminController.updateUser);
router.delete('/users/:id', verifyToken, requireAdmin, adminController.deleteUser);

/**
 * Rutas de Restaurantes
 */
router.get('/restaurants', verifyToken, requireAdmin, adminController.getAllRestaurants);
router.get('/restaurants/pending', verifyToken, requireAdmin, adminController.getPendingRestaurants);
router.put('/restaurants/:id/approve', verifyToken, requireAdmin, adminController.approveRestaurant);
router.put('/restaurants/:id/reject', verifyToken, requireAdmin, adminController.rejectRestaurant);
router.put('/restaurants/:id/plan', verifyToken, requireAdmin, adminController.updateRestaurantPlan);
router.get('/restaurants/:id/subscriptions', verifyToken, requireAdmin, adminController.getRestaurantSubscriptionHistory);
router.put('/restaurants/:id/config', verifyToken, requireAdmin, adminController.updateRestaurantConfig);
router.put('/restaurants/:id/ofrece-domicilio', verifyToken, requireAdmin, adminController.updateRestaurantDomicilio);
router.put('/restaurants/:id/ofrece-consumo-en-local', verifyToken, requireAdmin, adminController.updateRestaurantConsumoEnLocal);
router.put('/restaurants/:id/es-mercado-abarrotes', verifyToken, requireAdmin, adminController.updateRestaurantEsMercado);
router.put('/restaurants/:id/es-comida-rapida', verifyToken, requireAdmin, adminController.updateRestaurantEsComidaRapida);
router.put('/restaurants/:id/es-restaurante', verifyToken, requireAdmin, adminController.updateRestaurantEsRestaurante);

/**
 * Rutas de Costos de Envío por Sector (por restaurante)
 */
router.get('/restaurants/:id/envios-sectores', verifyToken, requireAdmin, restaurantShippingController.getEnviosSectores);
router.put('/restaurants/:id/envios-sectores', verifyToken, requireAdmin, restaurantShippingController.replaceEnviosSectores);

/**
 * Rutas de Gestión de Sectores y Barrios
 */
router.get('/sectores', verifyToken, requireAdmin, zonaController.getSectores);
router.post('/sectores', verifyToken, requireAdmin, _createSector);
router.put('/sectores/:id', verifyToken, requireAdmin, _updateSector);
router.delete('/sectores/:id', verifyToken, requireAdmin, _deleteSector);

router.get('/barrios', verifyToken, requireAdmin, zonaController.getBarrios);
router.post('/barrios', verifyToken, requireAdmin, _createBarrio);
router.put('/barrios/:id', verifyToken, requireAdmin, _updateBarrio);
router.delete('/barrios/:id', verifyToken, requireAdmin, _deleteBarrio);

/**
 * Rutas de Pedidos Globales
 */
router.get('/orders', verifyToken, requireAdmin, adminController.getAllOrders);
router.put('/orders/:id/status', verifyToken, requireAdmin, adminController.updateOrderStatus);

/**
 * Comunicación y Notificaciones
 */
router.post('/notifications/global', verifyToken, requireAdmin, adminController.sendGlobalNotification);

/**
 * Rutas de Estadísticas y Analytics
 */
router.get('/stats', verifyToken, requireAdmin, adminController.getStats);
router.get('/analytics', verifyToken, requireAdmin, adminController.getAdvancedAnalytics);

/**
 * Rutas de Gestión de Categorías (Admin)
 */
router.get('/categorias', verifyToken, requireAdmin, categoryController.getCategories);
router.post('/categorias', verifyToken, requireAdmin, categoryController.createCategory);
router.put('/categorias/:id', verifyToken, requireAdmin, categoryController.updateCategory);
router.delete('/categorias/:id', verifyToken, requireAdmin, categoryController.deleteCategory);

/**
 * Rutas de Gestión de Cupones (Admin)
 *
 * El admin puede crear cupones globales (es_global=true, sin local
 * asociado) o cupones en nombre de un local específico. También puede
 * editar o borrar cualquier cupón de la plataforma, sean propios del
 * local o globales. Los handlers están en `couponController` con el
 * prefijo `admin*`.
 */
router.get('/coupons', verifyToken, requireAdmin, couponController.adminListCoupons);
router.post('/coupons', verifyToken, requireAdmin, couponController.adminCreateCoupon);
router.get('/coupons/:id', verifyToken, requireAdmin, couponController.adminGetCoupon);
router.put('/coupons/:id', verifyToken, requireAdmin, couponController.adminUpdateCoupon);
router.delete('/coupons/:id', verifyToken, requireAdmin, couponController.adminDeleteCoupon);

export default router;
