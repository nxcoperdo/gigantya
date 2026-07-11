import express from 'express';
import * as restaurantController from '../controllers/restaurantController.js';
import * as restaurantShippingController from '../controllers/restaurantShippingController.js';
import { verifyToken, requireRestaurant } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/restaurants
 * @desc    Listar todos los restaurantes aprobados
 * @access  Public
 * @query   ciudad, nombre
 */
router.get('/', restaurantController.listRestaurants);

/**
 * Rutas /me y /me/stats van ANTES de /:id.
 *
 * En Express las rutas se matchean en orden de declaración. Si declaras
 * `router.get('/:id', ...)` antes que `router.get('/me', ...)`, Express
 * matchea `id="me"` contra el handler genérico y nunca llega a /me.
 * Por eso las rutas estáticas/con prefijos más específicos van primero.
 *
 * Si en el futuro agregas más rutas como /me/..., mantén este bloque
 * agrupado arriba de las rutas con `:id`.
 */
router.get('/me', verifyToken, restaurantController.getMyRestaurant);

/**
 * @route   GET /api/restaurants/me/stats
 * @desc    Obtener estadísticas del restaurante propio
 * @access  Private - Restaurant
 */
router.get('/me/stats', verifyToken, requireRestaurant, restaurantController.getRestaurantStats);

/**
 * @route   GET /api/restaurants/:id
 * @desc    Obtener detalles de un restaurante con su menú
 * @access  Public
 */
router.get('/:id', restaurantController.getRestaurant);

/**
 * @route   POST /api/restaurants
 * @desc    Crear nuevo restaurante (solo restaurante)
 * @access  Private - Restaurant
 */
router.post('/', verifyToken, requireRestaurant, restaurantController.createRestaurant);

/**
 * @route   PUT /api/restaurants/:id
 * @desc    Actualizar restaurante (solo owner)
 * @access  Private - Restaurant
 */
router.put('/:id', verifyToken, requireRestaurant, upload.fields([
  { name: 'imagen_url', maxCount: 1 },
  { name: 'banner_url', maxCount: 1 }
]), restaurantController.updateRestaurant);

/**
 * Costos de envío por sector — accesibles también por el dueño del restaurante.
 * El controller valida que `req.user.id` sea el `usuario_id` del restaurante.
 */
router.get('/:id/envios-sectores', verifyToken, requireRestaurant, restaurantShippingController.getEnviosSectores);
router.put('/:id/envios-sectores', verifyToken, requireRestaurant, restaurantShippingController.replaceEnviosSectores);

export default router;

