import express from 'express';
import ratingController from '../controllers/ratingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', verifyToken, ratingController.rateRestaurant);
router.get('/me', verifyToken, ratingController.getMyRatings);
router.put('/:restaurante_id', verifyToken, ratingController.editRating);

export default router;
