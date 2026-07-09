/**
 * Rutas de Pedidos POS (Fase 3).
 *
 *   POST  /api/pos/orders              crea pedido
 *   GET   /api/pos/orders              lista
 *   GET   /api/pos/orders/:id          detalle
 *
 * Autorización: cualquier staff del restaurante puede crear/leer.
 * Los chequos finos (mesa reservable, items del propio restaurante) los
 * hace el service, no el middleware.
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posOrderController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.post('/',              ctrl.createPosOrder);
router.get('/',                ctrl.listPosOrders);
router.get('/:id',             ctrl.getPosOrder);
router.patch('/:id/status',    ctrl.updatePosOrderStatus);

export default router;
