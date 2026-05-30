import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as addressController from '../controllers/addressController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

/**
 * GET /api/addresses - Obtener todas las direcciones del usuario
 */
router.get('/', addressController.getUserAddresses);

/**
 * GET /api/addresses/default - Obtener dirección por defecto
 */
router.get('/default', addressController.getDefaultAddress);

/**
 * POST /api/addresses - Crear nueva dirección
 */
router.post('/', addressController.createAddress);

/**
 * PUT /api/addresses/:id - Actualizar dirección
 */
router.put('/:id', addressController.updateAddress);

/**
 * DELETE /api/addresses/:id - Eliminar dirección
 */
router.delete('/:id', addressController.deleteAddress);

/**
 * PUT /api/addresses/:id/default - Establecer como dirección por defecto
 */
router.put('/:id/default', addressController.setDefaultAddress);

export default router;

