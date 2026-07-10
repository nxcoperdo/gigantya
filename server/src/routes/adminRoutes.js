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
import { createUploader } from '../middleware/uploadMiddleware.js';
import * as adminHomeMediaController from '../controllers/adminHomeMediaController.js';

// Uploader dedicado para CMS de banner de Home. Whitelist: imágenes y
// videos cortos. 20MB max (los videos del hero no necesitan más). La
// subcarpeta 'home-media' se crea automáticamente si no existe.
const homeMediaUpload = createUploader({
  subdir: 'home-media',
  allowedTypes: /jpeg|jpg|png|webp|mp4|webm/,
  maxSize: 20 * 1024 * 1024,
});

const router = express.Router();

/**
 * IMPORTANTE: este router requiere autenticación de admin para TODO
 * endpoint, sin excepción. Se aplica con `router.use(...)` arriba para
 * no repetir `verifyToken, requireAdmin` en cada línea.
 *
 * Si en el futuro se agrega un endpoint público bajo /api/admin (ej: un
 * healthcheck), MONTARLO EN UN ROUTER APARTE y registrarlo antes en
 * app.js — nunca豁 esta regla agregando un `router.get('/public', ...)`
 * acá, porque Express respeta el orden de los `use` y quedaría un hueco
 * de seguridad.
 */
router.use(verifyToken, requireAdmin);

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
// IMPORTANTE: la ruta específica '/users/online' debe ir ANTES de '/users/:id'
// porque Express matchea por orden. Si se pone después, req.params.id = "online"
// y `adminController.updateUser` recibe un id no numérico.
// Misma lógica para '/users/:id/orders' vs '/users/:id'.
router.get('/users', adminController.getAllUsers);
router.get('/users/online', adminController.getOnlineUsers);
router.post('/users', adminController.adminCreateUser);
router.get('/users/:id', adminController.getUserByIdAdmin);
router.get('/users/:id/orders', adminController.getUserOrdersAdmin);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

/**
 * Rutas de Restaurantes
 */
router.get('/restaurants', adminController.getAllRestaurants);
router.get('/restaurants/pending', adminController.getPendingRestaurants);
router.put('/restaurants/:id/approve', adminController.approveRestaurant);
router.put('/restaurants/:id/reject', adminController.rejectRestaurant);
router.put('/restaurants/:id/plan', adminController.updateRestaurantPlan);
router.get('/restaurants/:id/subscriptions', adminController.getRestaurantSubscriptionHistory);
router.put('/restaurants/:id/config', adminController.updateRestaurantConfig);
router.put('/restaurants/:id/ofrece-domicilio', adminController.updateRestaurantDomicilio);
router.put('/restaurants/:id/ofrece-consumo-en-local', adminController.updateRestaurantConsumoEnLocal);
router.put('/restaurants/:id/es-mercado-abarrotes', adminController.updateRestaurantEsMercado);
router.put('/restaurants/:id/es-comida-rapida', adminController.updateRestaurantEsComidaRapida);
router.put('/restaurants/:id/es-restaurante', adminController.updateRestaurantEsRestaurante);
router.put('/restaurants/:id/es-panaderia-pasteleria', adminController.updateRestaurantEsPanaderiaPasteleria);

/**
 * Rutas de Costos de Envío por Sector (por restaurante)
 */
router.get('/restaurants/:id/envios-sectores', restaurantShippingController.getEnviosSectores);
router.put('/restaurants/:id/envios-sectores', restaurantShippingController.replaceEnviosSectores);

/**
 * Rutas de Gestión de Sectores y Barrios
 */
router.get('/sectores', zonaController.getSectores);
router.post('/sectores', _createSector);
router.put('/sectores/:id', _updateSector);
router.delete('/sectores/:id', _deleteSector);

router.get('/barrios', zonaController.getBarrios);
router.post('/barrios', _createBarrio);
router.put('/barrios/:id', _updateBarrio);
router.delete('/barrios/:id', _deleteBarrio);

/**
 * Rutas de Pedidos Globales
 */
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/status', adminController.updateOrderStatus);

/**
 * Comprobantes de pago (vista global del admin, no filtrada por local).
 *
 * El admin puede ver, aprobar y rechazar comprobantes de CUALQUIER
 * local — útil cuando un local está inactivo y nadie valida los
 * comprobantes de sus pedidos. Las rutas `/api/payments/...` (sin
 * /admin) siguen siendo para el flujo local/cliente.
 */
router.get('/comprobantes', adminController.getAllPaymentProofsAdmin);
router.post('/comprobantes/:id/approve', adminController.approvePaymentProofAdmin);
router.post('/comprobantes/:id/reject', adminController.rejectPaymentProofAdmin);

/**
 * Auditoría: log de acciones del admin (aprobar/rechazar locales,
 * cambiar planes, suspender usuarios, validar comprobantes, etc.).
 */
router.get('/audit', adminController.getAuditLogs);

/**
 * Comunicación y Notificaciones
 */
router.post('/notifications/global', adminController.sendGlobalNotification);

/**
 * Rutas de Estadísticas y Analytics
 */
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAdvancedAnalytics);

/**
 * Rutas de Gestión de Categorías (Admin)
 */
router.get('/categorias', categoryController.getCategories);
router.post('/categorias', categoryController.createCategory);
router.put('/categorias/:id', categoryController.updateCategory);
router.delete('/categorias/:id', categoryController.deleteCategory);

/**
 * Rutas de Gestión de Cupones (Admin)
 *
 * El admin puede crear cupones globales (es_global=true, sin local
 * asociado) o cupones en nombre de un local específico. También puede
 * editar o borrar cualquier cupón de la plataforma, sean propios del
 * local o globales. Los handlers están en `couponController` con el
 * prefijo `admin*`.
 */
router.get('/coupons', couponController.adminListCoupons);
router.post('/coupons', couponController.adminCreateCoupon);
// IMPORTANTE: esta ruta debe ir ANTES de /coupons/:id para que Express
// no capture "usages" como un id. Si se pone después, adminGetCoupon
// recibe req.params.id = "usages" y devuelve 404.
router.get('/coupons/usages', couponController.adminGetCouponUsages);
router.get('/coupons/:id', couponController.adminGetCoupon);
router.put('/coupons/:id', couponController.adminUpdateCoupon);
router.delete('/coupons/:id', couponController.adminDeleteCoupon);

// ========== CMS Banner de Home (Fase 12) ==========
// Permite al super-admin subir varios archivos de media (imagen o video)
// y elegir UNO como activo. La home pública (`/`) lo lee y lo renderiza.
router.get('/home-media', adminHomeMediaController.list);
router.post('/home-media', homeMediaUpload.single('file'), adminHomeMediaController.upload);
router.put('/home-media/:id/activate', adminHomeMediaController.setActivo);
router.delete('/home-media/:id', adminHomeMediaController.deleteMedia);

export default router;
