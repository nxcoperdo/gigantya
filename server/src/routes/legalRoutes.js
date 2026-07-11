/**
 * Rutas de documentos legales.
 *
 * Endpoints públicos:
 *   GET /api/legal/version → versiones vigentes
 *
 * Endpoints autenticados (verifyToken):
 *   GET  /api/legal/mis-aceptaciones
 *   POST /api/legal/aceptar
 *
 * Endpoints admin (verifyToken + requireAdmin):
 *   GET /api/legal/restaurante/:id/aceptaciones
 *
 * Por qué `GET /version` es público: las páginas /terminos, /privacidad
 * y /cookies las ve cualquiera, y el frontend necesita saber qué versión
 * mostrar en el header ("v1.0 — 10 de julio de 2026") sin pedir login.
 *
 * Por qué `POST /aceptar` permite visitante anónimo (sin auth): el banner
 * de cookies de la home aparece para todos, incluso antes de registrarse.
 * En ese caso guardamos la aceptación con usuario_id=null, restaurante_id=null.
 * Sirve como auditoría legal ("este IP aceptó cookies en tal momento") y
 * el gating real de las cookies opcionales sigue siendo client-side
 * (localStorage + react state).
 */
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import * as legalController from '../controllers/legalController.js';

const router = express.Router();

// Público: versión vigente de cada documento
router.get('/version', legalController.getVersion);

// Autenticado: mis aceptaciones
router.get('/mis-aceptaciones', verifyToken, legalController.getMisAceptaciones);

// Autenticado: estado de qué falta aceptar (motor del modal bloqueante)
router.get('/estado', verifyToken, legalController.getEstado);

// Aceptación: acepta con o sin auth (visitantes anónimos para cookies).
// verifyToken corre cuando hay token, pero el controller ya maneja el
// caso userId=null para visitantes anónimos.
router.post('/aceptar', (req, res, next) => {
  // Si hay Authorization header, lo validamos. Si no, sigue.
  const auth = req.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return verifyToken(req, res, () => legalController.aceptar(req, res));
  }
  return legalController.aceptar(req, res);
});

// Admin: aceptaciones de un restaurante
router.get('/restaurante/:id/aceptaciones', verifyToken, requireAdmin, legalController.getAceptacionesRestaurante);

export default router;
