import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireVendedor } from '../middleware/chatMiddleware.js';
import {
  ensureConversation,
  listMensajes,
  postMensaje,
  markRead,
  adminListConversaciones,
  adminConvertToOrder,
  adminBuildDraft,
} from '../controllers/chatController.js';

const router = Router();

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

router.post('/conversaciones/:id/leido', (req, res, next) => {
  const hasAuth = !!req.headers.authorization;
  if (hasAuth) return verifyToken(req, res, next);
  return anonChatLimiter(req, res, next);
}, markRead);

// ============ Admin (vendedor) ============

router.get('/admin/conversaciones', verifyToken, requireVendedor, adminListConversaciones);
router.get('/admin/conversaciones/:id/draft', verifyToken, requireVendedor, adminBuildDraft);
router.post('/admin/conversaciones/:id/draft-pedido', verifyToken, requireVendedor, adminConvertToOrder);

export default router;
