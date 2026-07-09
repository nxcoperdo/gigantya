/**
 * Rutas de Inventario (POS Fase 6).
 *
 *   GET    /api/pos/inventory/ingredientes              listar
 *   GET    /api/pos/inventory/ingredientes/:id          detalle
 *   POST   /api/pos/inventory/ingredientes              crear (dueño/admin)
 *   PUT    /api/pos/inventory/ingredientes/:id          actualizar (dueño/admin)
 *   DELETE /api/pos/inventory/ingredientes/:id          soft-delete (dueño/admin)
 *   GET    /api/pos/inventory/bom/producto/:productoId  obtener receta
 *   PUT    /api/pos/inventory/bom/producto/:productoId  reemplazar receta (dueño/admin)
 *   GET    /api/pos/inventory/kardex                    listar movimientos
 *   POST   /api/pos/inventory/movimientos               compra/merma/ajuste
 *   GET    /api/pos/inventory/alertas                   ingredientes bajo mínimo
 *
 * Autorización: cualquier staff del restaurante puede leer y registrar
 * movimientos manuales; los chequeos finos (dueño/admin) están en el
 * controller.
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posInventoryController.js';

const router = express.Router();

router.use(verifyToken, requireStaff);

router.get('/ingredientes',             ctrl.listIngredientes);
router.get('/ingredientes/:id',         ctrl.getIngrediente);
router.post('/ingredientes',            ctrl.createIngrediente);
router.put('/ingredientes/:id',         ctrl.updateIngrediente);
router.delete('/ingredientes/:id',      ctrl.deleteIngrediente);

router.get('/bom/producto/:productoId', ctrl.getBOM);
router.put('/bom/producto/:productoId', ctrl.setBOM);

router.get('/kardex',                   ctrl.listKardex);
router.post('/movimientos',             ctrl.crearMovimiento);

router.get('/alertas',                  ctrl.listAlertas);

export default router;
