/**
 * Rutas de Clientes POS (Fase 3).
 *
 *   POST /api/pos/customers      crea walk-in
 *   GET  /api/pos/customers      busca por teléfono (para reusar walk-ins)
 *
 * El "walk-in" es un `usuarios` con `tipo_usuario='cliente'`,
 * email `walkin_<ts>@local.gigantya` y contraseña random (no se loguea).
 * Si el cliente YA existe (match por teléfono), se devuelve sin duplicar.
 *
 * Autorización: cualquier staff del restaurante puede crear/buscar
 * walk-ins del restaurante.
 */
import express from 'express';
import { verifyToken, requireStaff } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/posCustomerController.js';

const router = express.Router();
router.use(verifyToken, requireStaff);

router.post('/',       ctrl.createPosCustomer);
router.get('/',        ctrl.searchPosCustomers);

export default router;
