/**
 * Rutas de impresión (Fase 4).
 *
 *   GET /api/print/kitchen-ticket/:pedidoId   comanda de cocina
 *   GET /api/print/receipt/:pedidoId          recibo del cliente
 *
 * Autorización: `requireStaff` (cualquiera de los roles POS) — el controller
 * después valida que el pedido sea del restaurante del token.
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/printController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.get('/kitchen-ticket/:pedidoId', ctrl.getKitchenTicket);
router.get('/receipt/:pedidoId',        ctrl.getReceipt);

export default router;
