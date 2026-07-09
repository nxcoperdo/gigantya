/**
 * Rutas de Configuración POS (Fase 8).
 *
 *   GET /api/pos/config   — cualquier staff
 *   PUT /api/pos/config   — solo dueño (verificado en el router con
 *                           `requireRestaurantOwner`)
 *
 * El router se monta como `/api/pos/config` (ver `app.js`). Decisión:
 * 2 middlewares distintos (GET con requireStaff, PUT con
 * requireRestaurantOwner) requieren encadenar a nivel de método, no
 * a nivel de router — por eso cada handler se monta con su propio
 * middleware chain.
 */
import express from 'express';
import { verifyToken, requireStaff, requireRestaurantOwner } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posConfigController.js';

const router = express.Router();

router.get('/',    verifyToken, requireStaff,           ctrl.getConfig);
router.put('/',    verifyToken, requireRestaurantOwner,  ctrl.updateConfig);

export default router;
