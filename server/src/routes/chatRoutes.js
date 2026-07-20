import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireVendedor } from '../middleware/chatMiddleware.js';
import { createUploader } from '../middleware/uploadMiddleware.js';
import {
  ensureConversation,
  listMensajes,
  postMensaje,
  postImagen,
  markRead,
  adminListConversaciones,
  adminConvertToOrder,
  adminBuildDraft,
  clienteListConversaciones,
} from '../controllers/chatController.js';

const router = Router();

// Uploader dedicado para imágenes del chat → uploads/chat/. Límite 8MB
// (fotos de teléfono suelen pesar 2-6MB). Solo imágenes.
const chatImageUpload = createUploader({
  subdir: 'chat',
  allowedTypes: /jpeg|jpg|png|webp/,
  maxSize: 8 * 1024 * 1024,
});

// Corre multer y traduce sus errores (tamaño/tipo) a un 400 con mensaje
// claro en español, en vez de dejar que caigan al error handler global.
function uploadChatImage(req, res, next) {
  chatImageUpload.single('imagen')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el tamaño máximo (8MB)'
        : (err.message || 'No se pudo subir la imagen');
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

// Rate-limit estricto para clientes anónimos: 30 mensajes por IP cada 15 min.
// Aplica solo a POST /api/chat/conversaciones (cuando no hay JWT, el path
// más expuesto a spam). Los POST de mensajes con JWT ya pasan por el
// apiLimiter general (1000/15min por IP).
const anonChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Estás enviando mensajes demasiado rápido. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ Cliente ============

// Asegurar conversación: acepta cliente logueado (verifyToken) o anónimo
// (solo nombre+teléfono). Si no hay token, aplicamos el rate-limit estricto.
router.post('/conversaciones', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, ensureConversation);

// GET mensajes: acepta cliente logueado (verifyToken) o anónimo con
// ?anon_identifier=anon:<tel>. La authz fina la hace el controller
// comparando el identificador contra conv.cliente_identificador.
router.get('/conversaciones/:id/mensajes', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, listMensajes);

// POST mensajes: acepta cliente logueado (verifyToken) O anónimo con
// identificador (anon:<tel>) en el body. Si no hay token, aplicamos el
// rate-limit estricto. El controller valida que el anónimo sea dueño
// de la conversación comparando el identificador con conv.cliente_identificador.
router.post('/conversaciones/:id/mensajes', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, postMensaje);

// POST imagen: mismo esquema de auth que POST mensaje. El auth-branch corre
// PRIMERO (lee solo headers), luego multer parsea el multipart y deja el
// archivo en req.file + los campos (incluido anon_identifier) en req.body.
router.post('/conversaciones/:id/imagen', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, uploadChatImage, postImagen);

router.post('/conversaciones/:id/leido', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, markRead);

// Lista las conversaciones del cliente logueado con todos los locales
// que tengan chat habilitado. Solo para clientes (no anónimos): el anónimo
// siempre chatea desde la página del local, donde el panel se abre
// automáticamente. La authz es `cliente` puro: el vendedor no tiene
// necesidad de listar "sus chats" porque ya tiene /dashboard/chat.
router.get('/cliente/conversaciones', verifyToken, clienteListConversaciones);

// ============ Admin (vendedor) ============

router.get('/admin/conversaciones', verifyToken, requireVendedor, adminListConversaciones);
router.get('/admin/conversaciones/:id/draft', verifyToken, requireVendedor, adminBuildDraft);
router.post('/admin/conversaciones/:id/draft-pedido', verifyToken, requireVendedor, adminConvertToOrder);

export default router;
