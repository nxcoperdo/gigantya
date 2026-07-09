/**
 * Rutas de caja POS (Fase 5).
 *
 *   POST  /api/pos/cash-sessions                abre caja
 *   GET   /api/pos/cash-sessions/current        sesión abierta del cajero
 *   GET   /api/pos/cash-sessions/:id            detalle de sesión
 *   POST  /api/pos/cash-sessions/:id/close      cierra con arqueo
 *   POST  /api/pos/orders/:id/charge            cobra un pedido
 *   GET   /api/pos/orders/:id/pagos             lista pagos del pedido
 *
 * Autorización: cualquier staff del restaurante puede abrir caja, cobrar
 * y cerrar. El controller valida que el pedido/sesión sea del restaurante
 * del token.
 *
 * Idempotencia: el cierre acepta `Idempotency-Key` header (recomendado
 * para que el cajero pueda hacer doble-click sin miedo).
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posCashController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.post('/cash-sessions',                  ctrl.openCashSession);
router.get('/cash-sessions/current',           ctrl.getCurrentCashSession);
router.get('/cash-sessions/:id/summary',       ctrl.getCashSessionSummary);
router.get('/cash-sessions/:id',               ctrl.getCashSessionById);
router.post('/cash-sessions/:id/close',        ctrl.closeCashSession);
router.post('/orders/:id/charge',              ctrl.chargeOrder);
router.get('/orders/:id/pagos',                ctrl.getOrderPayments);

export default router;
