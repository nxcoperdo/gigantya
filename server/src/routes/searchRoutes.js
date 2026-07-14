import express from 'express';
import searchController from '../controllers/searchController.js';

const router = express.Router();

// Endpoint público. El `apiLimiter` global (1000 req / 15 min) lo cubre.
// Sin `verifyToken` para que visitantes anónimos también puedan usar el
// autocomplete (mismo criterio que GET /api/restaurants).
router.get('/', searchController.suggest);

export default router;
