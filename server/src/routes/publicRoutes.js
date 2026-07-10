/**
 * Rutas públicas del sitio (sin auth).
 *
 * Por convención del proyecto, las rutas que no requieren login viven
 * en routers específicos (restaurantRoutes tiene los GETs públicos de
 * restaurantes, etc). Este archivo es para endpoints públicos que NO
 * pertenecen al dominio de restaurantes.
 *
 * Por ahora solo expone el banner activo de la home (Fase 12).
 */
import { Router } from 'express';
import * as publicHomeMediaController from '../controllers/publicHomeMediaController.js';

const router = Router();

/**
 * GET /api/home/media
 * Devuelve el banner activo de la home pública, o `{ media: null }` si
 * no hay ninguno (en ese caso el cliente renderiza el fallback
 * banner.mp4 hardcodeado en client/public).
 */
router.get('/media', publicHomeMediaController.getActivo);

export default router;
