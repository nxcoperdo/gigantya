/**
 * Rutas de Split / Transfer / Merge POS (Fase 8).
 *
 *   POST /api/pos/orders/:id/charge-partial
 *   POST /api/pos/orders/:id/split
 *   POST /api/pos/orders/:id/transfer
 *   POST /api/pos/tables/merge
 *
 * Auth: cualquier staff (la validación fina de tenant la hace el
 * service con `SELECT ... FOR UPDATE` + chequeo de restaurante_id).
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posSplitTransferController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.post('/orders/:id/charge-partial', ctrl.chargePartial);
router.post('/orders/:id/split',          ctrl.splitByItems);
router.post('/orders/:id/transfer',       ctrl.transferOrder);
router.post('/tables/merge',              ctrl.mergeTables);

export default router;
