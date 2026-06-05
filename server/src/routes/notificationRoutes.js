import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, notificationController.getNotifications);
router.patch('/:id/read', verifyToken, notificationController.markRead);
router.patch('/read-all', verifyToken, notificationController.markAllRead);

export default router;
