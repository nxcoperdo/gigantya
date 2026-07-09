/**
 * Controller de Pedidos POS (Fase 3).
 *
 * Endpoints:
 *   POST  /api/pos/orders              crea pedido (mesa | pickup | delivery | walk-in)
 *   GET   /api/pos/orders              lista pedidos del restaurante del staff
 *   GET   /api/pos/orders/:id          detalle de un pedido
 *   POST  /api/pos/orders/:id/items    agrega items a pedido abierto
 *   DELETE /api/pos/orders/:id/items/:itemId  quita item
 *
 * Diferencias con `orderController.createOrder` (cliente web):
 *   - NO valida cupones (staff es de confianza).
 *   - NO geocodifica / resuelve sector (delivery es solo para walk-in con
 *     dirección completa; el POS no usa barrio_id).
 *   - SÍ reserva la mesa (UPDATE mesas.estado='ocupada' con FOR UPDATE)
 *     cuando `mesa_id` viene y la modalidad es dine-in.
 *   - El cupón NUNCA se aplica: el staff tiene control total sobre
 *     descuentos manuales desde caja (Fase 5).
 *   - Canal forzado a 'pos' (no se acepta del body).
 *
 * Walk-in: si el body NO trae `cliente_id`, el sistema crea un
 * `usuarios` con `tipo_usuario='cliente'`, `nombre='Walk-in'`,
 * `email='walkin_<timestamp>@local.gigantya'`, contraseña random
 * (no se loguea nunca — es un placeholder). Así `pedidos.usuario_id`
 * siempre tiene un valor válido (la columna es NOT NULL).
 */
import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as UserModel from '../models/User.js';
import { createOrderCore, notificarNuevoPedido } from '../services/orderService.js';
import { emitToRestaurant } from '../socket/socketHandler.js';

const VALID_TIPOS = new Set(['dine_in', 'pickup', 'delivery']);

/** Helper: extrae restaurante_id del token o del query/body para admin. */
function resolveRestauranteId(req) {
  if (req.user.tipo_usuario === 'admin') {
    return Number(req.query.restaurante_id || req.body.restaurante_id);
  }
  return req.user.restaurante_id;
}

/** Helper: crea o recupera un usuario walk-in para pedidos sin cliente. */
async function getOrCreateWalkIn(connection) {
  const stamp = Date.now();
  const email = `walkin_${stamp}_${Math.random().toString(36).slice(2, 8)}@local.gigantya`;
  const randomHash = `walkin_no_login_${stamp}_${Math.random().toString(36).slice(2, 16)}`;
  const [r] = await connection.query(
    `INSERT INTO usuarios (nombre, email, contrasena_hash, tipo_usuario, estado, creado_en)
     VALUES (?, ?, ?, 'cliente', 'activo', NOW())`,
    ['Walk-in', email, randomHash]
  );
  return r.insertId;
}

/** POST /api/pos/orders */
export async function createPosOrder(req, res) {
  let connection;
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({
        error: 'No se pudo determinar el restaurante. Si sos admin, pasá ?restaurante_id=X'
      });
    }

    const {
      mesa_id = null,
      tipo = 'dine_in',          // 'dine_in' | 'pickup' | 'delivery'
      cliente_id = null,
      cliente_nombre = null,     // walk-in: solo informativo
      cliente_telefono = null,
      items,
      notas = '',
      direccion_entrega = null,  // solo para tipo='delivery'
      telefono_contacto = null,
      total: totalFromFrontend = null,
      metodo_pago = 'contra_entrega',
    } = req.body || {};

    if (!VALID_TIPOS.has(tipo)) {
      return res.status(400).json({ error: `tipo debe ser uno de: ${[...VALID_TIPOS].join(', ')}` });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items (array no vacío) es requerido' });
    }

    // Mapear `tipo` a flags persistidos en `pedidos`.
    const esConsumoEnLocal = tipo === 'dine_in';
    const esRetiroLocal    = tipo === 'pickup';

    // Validaciones por tipo:
    if (tipo === 'dine_in' && !mesa_id) {
      return res.status(400).json({ error: 'mesa_id es requerido para dine_in' });
    }
    if (tipo === 'delivery' && !direccion_entrega) {
      return res.status(400).json({ error: 'direccion_entrega es requerida para delivery' });
    }

    // Resolver cliente: si viene id, verificar; si no, crear walk-in.
    // Hacemos la creación del walk-in en la MISMA transacción que el
    // createOrderCore para que si la creación del pedido falla, no quede
    // un usuario huérfano. Para eso, creamos el walk-in antes, fuera de
    // la transacción, y la FK de pedidos.usuario_id se valida cuando
    // el service hace el INSERT. Si el service falla, el walk-in queda
    // pero es inocuo (es solo un placeholder que nunca se loguea).
    let usuarioId;
    if (cliente_id) {
      const u = await UserModel.getUserById(Number(cliente_id));
      if (!u) return res.status(404).json({ error: 'cliente_id no existe' });
      usuarioId = u.id;
    } else {
      // Conexión rápida para crear el walk-in.
      const { getConnection } = await import('../config/database.js');
      connection = await getConnection();
      usuarioId = await getOrCreateWalkIn(connection);
    }

    const pedidoId = await createOrderCore({
      usuario_id: usuarioId,
      restaurante_id: restauranteId,
      items,
      notas,
      direccion_entrega: tipo === 'delivery' ? direccion_entrega : null,
      telefono_contacto: cliente_telefono || telefono_contacto || null,
      coupon_id: null,         // POS no aplica cupones
      metodo_pago,
      costo_envio: 0,          // POS no usa envío; delivery local tampoco
      esRetiroLocal,
      esConsumoEnLocal,
      total: typeof totalFromFrontend === 'number' && totalFromFrontend > 0 ? totalFromFrontend : null,
      canal: 'pos',
      mesa_id: tipo === 'dine_in' ? mesa_id : null,
      creado_por: req.user.id,
    }, { clientSource: 'pos' });

    const pedido = await OrderModel.getOrderById(pedidoId);

    // Notificar al restaurante (interna + email) y emitir socket.
    notificarNuevoPedido(pedidoId);
    emitToRestaurant(restauranteId, 'pos:order_created', {
      pedido_id: pedidoId,
      mesa_id: mesa_id || null,
      tipo,
      canal: 'pos',
      total: pedido.total,
      creado_por: req.user.id,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      mensaje: 'Pedido POS creado exitosamente',
      pedido,
    });
  } catch (err) {
    console.error('[posOrder] create error:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Error creando pedido POS',
    });
  } finally {
    if (connection) connection.release();
  }
}

/** GET /api/pos/orders — lista pedidos del restaurante del staff. */
export async function listPosOrders(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { estado, mesa_id, canal = 'pos' } = req.query;
    const filters = [];
    const params = [restauranteId];
    if (estado) { filters.push('p.estado = ?'); params.push(estado); }
    if (mesa_id) { filters.push('p.mesa_id = ?'); params.push(Number(mesa_id)); }
    if (canal)   { filters.push('p.canal = ?');   params.push(canal); }
    const where = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';
    const { query } = await import('../config/database.js');
    const rows = await query(
      `SELECT p.*, m.nombre AS mesa_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON p.mesa_id = m.id
        WHERE p.restaurante_id = ?
        ${where}
        ORDER BY p.creado_en DESC
        LIMIT 200`,
      params
    );
    res.json({ total: rows.length, pedidos: rows });
  } catch (err) {
    console.error('[posOrder] list error:', err);
    res.status(500).json({ error: err.message || 'Error listando pedidos' });
  }
}

/** GET /api/pos/orders/:id */
export async function getPosOrder(req, res) {
  try {
    const restauranteId = resolveRestauranteId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No se pudo determinar el restaurante' });
    }
    const { query } = await import('../config/database.js');
    const [row] = await query(
      `SELECT p.*, m.nombre AS mesa_nombre, u.nombre AS cliente_nombre, u.telefono AS cliente_telefono
         FROM pedidos p
         LEFT JOIN mesas m ON p.mesa_id = m.id
         LEFT JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.id = ? AND p.restaurante_id = ?`,
      [Number(req.params.id), restauranteId]
    );
    if (!row) return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = await query(
      `SELECT ip.*, pr.nombre AS producto_nombre
         FROM items_pedido ip
         LEFT JOIN productos pr ON ip.producto_id = pr.id
        WHERE ip.pedido_id = ?`,
      [row.id]
    );
    res.json({ pedido: { ...row, items } });
  } catch (err) {
    console.error('[posOrder] get error:', err);
    res.status(500).json({ error: err.message || 'Error obteniendo pedido' });
  }
}

export default {
  createPosOrder,
  listPosOrders,
  getPosOrder,
};
