import express from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { createUploader } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/payments/config/:restaurante_id
 * @desc    Obtener configuración de pagos (Nequi/Daviplata) de un restaurante
 * @access  Public
 */
router.get('/config/:restaurante_id', paymentController.getPaymentConfig);

/**
 * @route   PUT /api/payments/config
 * @desc    Actualizar configuración de pagos del restaurante
 * @access  Private - Restaurant
 */
router.put('/config', verifyToken, paymentController.updatePaymentConfig);

/**
 * @route   POST /api/payments/proof
 * @desc    Subir comprobante de pago (Nequi/Daviplata)
 * @access  Private - Client
 */
// Comprobantes van a uploads/payment-proofs/ para mantener backups separados.
const uploadPaymentProof = createUploader({
  subdir: 'payment-proofs',
  allowedTypes: /jpeg|jpg|png|webp|svg/,
  maxSize: 5 * 1024 * 1024,
});
router.post('/proof', verifyToken, uploadPaymentProof.single('comprobante'), paymentController.uploadPaymentProof);

/**
 * @route   GET /api/payments/proof/:pedido_id
 * @desc    Obtener comprobante de pago de un pedido
 * @access  Private
 */
router.get('/proof/:pedido_id', verifyToken, paymentController.getPaymentProof);

/**
 * @route   GET /api/payments/pending
 * @desc    Obtener comprobantes pendientes de validación (Restaurante)
 * @access  Private - Restaurant
 */
router.get('/pending', verifyToken, paymentController.getPendingProofs);

/**
 * @route   GET /api/payments/history
 * @desc    Obtener historial de comprobantes del restaurante
 * @access  Private - Restaurant
 */
router.get('/history', verifyToken, paymentController.getProofsByRestaurant);

/**
 * @route   POST /api/payments/proof/:id/approve
 * @desc    Aprobar comprobante de pago
 * @access  Private - Restaurant
 */
router.post('/proof/:id/approve', verifyToken, paymentController.approvePaymentProof);

/**
 * @route   POST /api/payments/proof/:id/reject
 * @desc    Rechazar comprobante de pago
 * @access  Private - Restaurant
 */
router.post('/proof/:id/reject', verifyToken, paymentController.rejectPaymentProof);

export default router;
