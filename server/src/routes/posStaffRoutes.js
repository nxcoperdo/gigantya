/**
 * Rutas de personal del POS (Fase 1).
 *
 *   GET    /api/pos/staff            Listar staff del restaurante del dueño
 *   POST   /api/pos/staff            Crear staff (cajero/mesero/cocina)
 *   PATCH  /api/pos/staff/:id/status Activar/desactivar
 *
 * Todas las rutas requieren:
 *   1) `verifyToken` (usuario autenticado)
 *   2) `requireRestaurantOwner` (dueño del restaurante o admin)
 */
import express from 'express';
import { verifyToken, requireRestaurantOwner } from '../middleware/authMiddleware.js';
import * as posStaffController from '../controllers/posStaffController.js';

const router = express.Router();

router.use(verifyToken, requireRestaurantOwner);

router.get('/', posStaffController.listStaff);
router.post('/', posStaffController.createStaff);
router.patch('/:id/status', posStaffController.setStaffStatus);

export default router;
