/**
 * Rutas de Mesas (POS Fase 2).
 *
 *   GET    /api/pos/tables              listar mesas activas
 *   GET    /api/pos/tables/:id          detalle
 *   POST   /api/pos/tables              crear (dueño/admin)
 *   PUT    /api/pos/tables/:id          actualizar (dueño/admin)
 *   PUT    /api/pos/tables/:id/status   cambiar estado (cualquier staff)
 *   DELETE /api/pos/tables/:id          soft-delete (dueño/admin)
 *
 * Autorización por endpoint: los chequeos finos de rol se hacen en el
 * controller (no en el middleware) porque la regla varía:
 *   - mutaciones de DATOS (POST/PUT/DELETE) → solo dueño/admin
 *   - cambios de estado (PUT /status) → cualquier staff del restaurante
 *   - lecturas → cualquier staff
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posTableController.js';

const router = express.Router();

router.use(verifyToken, requireStaff);

router.get('/',            ctrl.listTables);
router.get('/:id',         ctrl.getTable);
router.post('/',           ctrl.createTable);
router.put('/:id',         ctrl.updateTable);
router.put('/:id/status',  ctrl.setTableStatus);
router.delete('/:id',      ctrl.deleteTable);

export default router;
