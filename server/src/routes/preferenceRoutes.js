import express from 'express';
import preferenceController from '../controllers/preferenceController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/favorites', verifyToken, preferenceController.addFavorite);
router.delete('/favorites', verifyToken, preferenceController.removeFavorite);
router.get('/favorites/:tipo', verifyToken, preferenceController.getFavorites);
router.get('/search-history', verifyToken, preferenceController.getSearchHistory);
router.delete('/search-history', verifyToken, preferenceController.clearSearchHistory);

export default router;
