import express from 'express';
import preferenceController from '../controllers/preferenceController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/favorites', verifyToken, preferenceController.addFavorite);
router.delete('/favorites', verifyToken, preferenceController.removeFavorite);
router.get('/favorites/:tipo', verifyToken, preferenceController.getFavorites);
// POST /search-history guarda un término confirmado por el usuario
// (Enter, click en sugerencia, o inactividad). La dedup se hace en
// `SearchHistory.upsertSearch` con INSERT ... ON DUPLICATE KEY UPDATE
// (requiere la UNIQUE KEY de la migración 20260915000001_*).
router.post('/search-history', verifyToken, preferenceController.addSearchTerm);
router.get('/search-history', verifyToken, preferenceController.getSearchHistory);
router.delete('/search-history', verifyToken, preferenceController.clearSearchHistory);

export default router;
