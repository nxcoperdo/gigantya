import * as ChatService from '../services/chatService.js';
import * as Conversacion from '../models/Conversacion.js';
import * as Mensaje from '../models/Mensaje.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireVendedor, requireSameRestaurante } from '../middleware/chatMiddleware.js';

/**
 * POST /api/chat/conversaciones
 * Body: { restaurante_id, cliente_nombre, cliente_telefono }
 * Header: Authorization: Bearer <jwt> (opcional — si no hay, requiere cliente_nombre+telefono)
 *
 * Crea o devuelve la conversación ABIERTA del cliente con ese local.
 */
export async function ensureConversation(req, res) {
  try {
    const { restaurante_id, cliente_nombre, cliente_telefono } = req.body || {};
    if (!restaurante_id) return res.status(400).json({ error: 'restaurante_id es obligatorio' });

    const user = req.user; // puede ser undefined si no pasó verifyToken
    const conv = await ChatService.ensureConversation({
      restaurante_id,
      cliente_user_id: user?.id,
      cliente_nombre,
      cliente_telefono,
    });
    res.json(conv);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * GET /api/chat/conversaciones/:id/mensajes?before_id=&limit=50
 * Auth: verifyToken (cliente dueño o staff del local).
 */
export async function listMensajes(req, res) {
  try {
    const { id } = req.params;
    const before_id = req.query.before_id ? Number(req.query.before_id) : null;
    const limit = Math.min(100, Number(req.query.limit) || 50);
    // Anónimo manda el anon_identifier por query o body (lo mandamos en
    // query porque es GET — el body se ignora en GET).
    const anonIdentifier = req.query.anon_identifier || req.body?.anon_identifier;

    const conv = await Conversacion.getById(id);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    // Authz: si es cliente, debe ser su conversación; si es staff, debe
    // pertenecer a su local. Admin del sistema pasa. Anónimo: su
    // identificador debe coincidir con el de la conversación.
    if (req.user?.tipo_usuario === 'admin') {
      // ok
    } else if (req.user?.tipo_usuario === 'cliente') {
      const expected = `user:${req.user.id}`;
      if (conv.cliente_identificador !== expected) {
        return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
      }
    } else if (req.user && ['restaurante', 'cajero', 'mesero', 'cocina'].includes(req.user.tipo_usuario)) {
      // staff del local
      if (!req.user.restaurante_id || Number(req.user.restaurante_id) !== Number(conv.restaurante_id)) {
        return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
      }
    } else if (anonIdentifier) {
      if (conv.cliente_identificador !== anonIdentifier) {
        return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
      }
    } else {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const mensajes = await Mensaje.listByConversacion(id, { before_id, limit, direction: 'asc' });
    res.json({ conversacion: conv, mensajes });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * POST /api/chat/conversaciones/:id/mensajes
 * Auth: verifyToken (cliente dueño o staff del local).
 * Body: { contenido, adjuntos? }
 */
export async function postMensaje(req, res) {
  try {
    const { id } = req.params;
    const { contenido, adjuntos, anon_identifier } = req.body || {};

    const conv = await Conversacion.getById(id);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    // Determinar emisor_tipo según el user (logueado o anónimo)
    let emisor_tipo, emisor_usuario_id = null;
    if (req.user) {
      if (req.user.tipo_usuario === 'cliente') {
        const expected = `user:${req.user.id}`;
        if (conv.cliente_identificador !== expected) {
          return res.status(403).json({ error: 'No puedes escribir en esta conversación' });
        }
        emisor_tipo = 'cliente';
      } else if (['restaurante', 'cajero', 'mesero', 'cocina', 'admin'].includes(req.user.tipo_usuario)) {
        if (req.user.tipo_usuario !== 'admin' &&
            (!req.user.restaurante_id || Number(req.user.restaurante_id) !== Number(conv.restaurante_id))) {
          return res.status(403).json({ error: 'No puedes escribir en esta conversación' });
        }
        emisor_tipo = 'vendedor';
        emisor_usuario_id = req.user.id;
      } else {
        return res.status(403).json({ error: 'Tipo de usuario no permitido' });
      }
    } else {
      // Anónimo: el body debe traer anon_identifier que matchee el
      // cliente_identificador de la conversación (formato `anon:<tel>`).
      if (!anon_identifier) {
        return res.status(401).json({ error: 'Identificador anónimo requerido' });
      }
      if (conv.cliente_identificador !== anon_identifier) {
        return res.status(403).json({ error: 'No puedes escribir en esta conversación' });
      }
      emisor_tipo = 'cliente';
    }

    const msg = await ChatService.appendMensaje({
      conversacion_id: Number(id),
      emisor_tipo,
      emisor_usuario_id,
      contenido,
      adjuntos,
    });
    res.status(201).json({ mensaje: msg });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * POST /api/chat/conversaciones/:id/leido
 * Auth: verifyToken. Marca como leídos los del emisor opuesto.
 */
export async function markRead(req, res) {
  try {
    const { id } = req.params;
    const anonIdentifier = req.query.anon_identifier || req.body?.anon_identifier;
    const conv = await Conversacion.getById(id);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    let lector;
    if (req.user?.tipo_usuario === 'cliente') lector = 'cliente';
    else if (req.user && ['restaurante', 'cajero', 'mesero', 'cocina', 'admin'].includes(req.user.tipo_usuario)) lector = 'vendedor';
    else if (anonIdentifier) {
      if (conv.cliente_identificador !== anonIdentifier) {
        return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
      }
      lector = 'cliente';
    } else {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    await ChatService.markRead({ conversacion_id: Number(id), emisor_tipo_lector: lector });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ============ Endpoints ADMIN (vendedor) ============

/**
 * GET /api/chat/admin/conversaciones
 * Auth: verifyToken + requireVendedor. Lista conversaciones del local del
 *       staff autenticado. Admin sin restaurante_id ve TODAS.
 * Query: ?estado=abierta (default) | cerrada | convertida | todas
 */
export async function adminListConversaciones(req, res) {
  try {
    const estado = req.query.estado || 'abierta';
    const restauranteId = req.user.restaurante_id;

    // Admin del sistema puede listar de cualquier local (?restaurante_id=)
    if (req.user.tipo_usuario === 'admin' && req.query.restaurante_id) {
      return res.json(await Conversacion.listByRestaurante(Number(req.query.restaurante_id), { estado }));
    }
    if (!restauranteId) {
      return res.status(400).json({ error: 'No estás asociado a un local' });
    }
    const conversaciones = await Conversacion.listByRestaurante(restauranteId, { estado });
    const noLeidos = await Conversacion.countUnreadForVendedor(restauranteId);
    res.json({ conversaciones, no_leidos_total: noLeidos });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * POST /api/chat/admin/conversaciones/:id/draft-pedido
 * Auth: verifyToken + requireVendedor + requireSameRestaurante('resolveByConv').
 *
 * Body: {
 *   items: [{producto_id, cantidad, precio_unitario, adiciones?, removidos?, nota?}],
 *   notas, direccion_entrega, telefono_contacto, metodo_pago, esRetiroLocal, costo_envio
 *   usuario_id  (opcional — id del cliente si está logueado)
 * }
 *
 * Convierte la conversación en pedido vía createOrderCore (origen='web_asistido').
 */
export async function adminConvertToOrder(req, res) {
  try {
    const { id } = req.params;
    const conv = await Conversacion.getById(id);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    // Verificar que el user pertenece al local de la conversación.
    if (req.user.tipo_usuario !== 'admin') {
      if (!req.user.restaurante_id || Number(req.user.restaurante_id) !== Number(conv.restaurante_id)) {
        return res.status(403).json({ error: 'No puedes operar sobre conversaciones de otro local' });
      }
    }

    const result = await ChatService.convertToOrder({
      conversacion_id: Number(id),
      pedidoDraft: req.body || {},
      creado_por_usuario_id: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

/**
 * GET /api/chat/admin/conversaciones/:id/draft
 * Auth: verifyToken + requireVendedor. Devuelve los items sugeridos a partir
 * de los adjuntos de la conversación. El vendedor edita y luego confirma.
 */
export async function adminBuildDraft(req, res) {
  try {
    const { id } = req.params;
    const conv = await Conversacion.getById(id);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    if (req.user.tipo_usuario !== 'admin' &&
        (!req.user.restaurante_id || Number(req.user.restaurante_id) !== Number(conv.restaurante_id))) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await ChatService.buildDraftFromConversation(Number(id));
    res.json({
      conversacion: conv,
      items_sugeridos: items,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}
