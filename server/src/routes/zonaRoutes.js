import express from 'express';
import * as zonaController from '../controllers/zonaController.js';

const router = express.Router();

/**
 * Endpoints públicos: la lista de sectores y barrios no expone información
 * sensible, así que están disponibles sin autenticación para que el formulario
 * de registro pueda cargarlos antes de iniciar sesión.
 */
router.get('/sectores', zonaController.getSectores);
router.get('/barrios', zonaController.getBarrios);

export default router;
