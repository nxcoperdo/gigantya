import express from 'express';
import { exportStatsPDF, exportStatsExcel, exportOrdersPDF, exportOrdersExcel } from '../controllers/exportController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Exportar estadísticas
router.get('/stats/pdf', exportStatsPDF);
router.get('/stats/excel', exportStatsExcel);

// Exportar pedidos
router.get('/orders/pdf', exportOrdersPDF);
router.get('/orders/excel', exportOrdersExcel);

export default router;
