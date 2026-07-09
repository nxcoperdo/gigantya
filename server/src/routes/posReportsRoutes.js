/**
 * Rutas de Reportes POS (Fase 7).
 *
 *   GET /api/pos/reports/top-productos
 *   GET /api/pos/reports/revenue
 *   GET /api/pos/reports/metodos-pago
 *   GET /api/pos/reports/estadisticas
 *   GET /api/pos/reports/sesion/:sesionId
 *
 * Autorización: cualquier staff del restaurante. La validación fina
 * (defensa de tenant en sesionId) está en el controller.
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posReportsController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.get('/top-productos',  ctrl.getTopProductos);
router.get('/revenue',        ctrl.getRevenue);
router.get('/metodos-pago',   ctrl.getMetodosPago);
router.get('/estadisticas',   ctrl.getEstadisticas);
router.get('/sesion/:sesionId', ctrl.getSesionDetalle);

export default router;
