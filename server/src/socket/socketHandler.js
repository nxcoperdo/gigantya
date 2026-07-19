/**
 * Manejador de Socket.IO para actualizaciones en tiempo real
 *
 * Namespaces:
 * - /orders: Eventos de pedidos (y del POS en general — el POS reusa este
 *   namespace para no multiplicar conexiones; los eventos del POS se
 *   distinguen por prefijo `pos:*`).
 *   - Chat: eventos `chat:join`, `chat:typing`. El handshake NO requiere
 *     token (back-compat con POS que conecta sin auth). Los eventos `chat:*`
 *     validan JWT o identificador anónimo desde `socket.handshake.auth` /
 *     `socket.data`.
 * - /restaurants: Información de restaurantes
 *
 * Helper público:
 *   - `emitToRestaurant(restaurante_id, event, payload)`: emite un evento
 *     a todos los clientes en la sala `restaurant_<id>` del namespace
 *     `/orders`. Se usa desde controllers POS (mesas, pedidos, KDS) sin
 *     necesidad de importar `io` directamente.
 *   - `emitToConversation(conversacion_id, event, payload)`: emite a la
 *     sala `conv_<id>` del namespace `/orders`. Usado por chatService.
 *   - `emitToOrder(pedido_id, event, payload)`: emite a la sala `order_<id>`.
 */

// Referencia al namespace /orders que se setea en `socketHandler(io)`.
// Los controllers importan `emitToRestaurant` y este helper usa `ordersNs`.
let ordersNs = null;
let restaurantsNs = null;

// Set de socket ids actualmente conectados y autenticados como un
// cliente/vendedor del chat. Permite saber si el cliente está online para
// mostrar el dot verde en el ChatAdminPage.
const onlineSocketsByConversacion = new Map(); // conversacion_id -> Set<socketId>

export function emitToRestaurant(restaurante_id, event, payload) {
  if (!ordersNs) {
    console.warn('[socket] emitToRestaurant llamado antes de inicializar Socket.IO');
    return;
  }
  ordersNs.to(`restaurant_${restaurante_id}`).emit(event, payload);
}

/**
 * Helper para emitir al room de una conversación (chat).
 * Usado por chatService cuando un mensaje nuevo se persiste.
 * Mismo namespace /orders porque los chats reusan esa conexión.
 */
export function emitToConversation(conversacion_id, event, payload) {
  if (!ordersNs) {
    console.warn('[socket] emitToConversation llamado antes de inicializar Socket.IO');
    return;
  }
  ordersNs.to(`conv_${conversacion_id}`).emit(event, payload);
}

export function emitToOrder(pedido_id, event, payload) {
  if (!ordersNs) return;
  ordersNs.to(`order_${pedido_id}`).emit(event, payload);
}

export default function socketHandler(io) {
  // Namespace de pedidos
  const ordersNamespace = io.of('/orders');
  ordersNs = ordersNamespace;

  ordersNamespace.on('connection', (socket) => {
    console.log(`📱 Cliente conectado: ${socket.id}`);

    /**
     * Evento: El usuario se une a una sala de restaurante
     * Esto permite que los restaurantes reciban actualizaciones de sus pedidos
     */
    socket.on('join_restaurant', (restaurante_id, usuario_id) => {
      socket.join(`restaurant_${restaurante_id}`);
      console.log(`✅ Usuario ${usuario_id} se unió a sala restaurant_${restaurante_id}`);
    });

    /**
     * Evento: El cliente se une a una sala de pedido
     * Esto permite que los clientes reciban actualizaciones de su pedido
     */
    socket.on('join_order', (pedido_id, usuario_id) => {
      socket.join(`order_${pedido_id}`);
      console.log(`✅ Usuario ${usuario_id} se unió a sala order_${pedido_id}`);
    });

    /**
     * Evento: Se crea un nuevo pedido
     * Se notifica al restaurante
     */
    socket.on('order_created', (data) => {
      const { pedido_id, restaurante_id, cliente_nombre } = data;

      // Notificar al restaurante
      ordersNamespace.to(`restaurant_${restaurante_id}`).emit('new_order', {
        pedido_id,
        cliente_nombre,
        timestamp: new Date().toISOString(),
        mensaje: `Nuevo pedido de ${cliente_nombre}`
      });

      console.log(`🔔 Nuevo pedido ${pedido_id} para restaurante ${restaurante_id}`);
    });

    /**
     * Evento: El estado del pedido cambió
     * Se notifica al cliente y al restaurante
     */
    socket.on('order_status_changed', (data) => {
      const { pedido_id, restaurante_id, nuevo_estado, cliente_id } = data;

      // Notificar al cliente
      ordersNamespace.to(`order_${pedido_id}`).emit('status_update', {
        estado: nuevo_estado,
        timestamp: new Date().toISOString(),
        mensaje: `Tu pedido está ${nuevo_estado.toLowerCase()}`
      });

      // Notificar al restaurante
      ordersNamespace.to(`restaurant_${restaurante_id}`).emit('order_updated', {
        pedido_id,
        estado: nuevo_estado,
        timestamp: new Date().toISOString()
      });

      console.log(`📝 Pedido ${pedido_id} cambiado a estado: ${nuevo_estado}`);
    });

    /**
     * Evento: El cliente se une a una sala de seguimiento
     */
    socket.on('track_order', (pedido_id) => {
      socket.join(`order_${pedido_id}`);
      console.log(`👁️ Cliente rastreando pedido: ${pedido_id}`);
    });

    /**
     * Evento: Desconexión
     */
    socket.on('disconnect', () => {
      console.log(`📴 Cliente desconectado: ${socket.id}`);
      // Limpiar tracking de conversaciones
      if (socket.data?.joinedConversations) {
        for (const convId of socket.data.joinedConversations) {
          const set = onlineSocketsByConversacion.get(convId);
          if (set) {
            set.delete(socket.id);
            if (set.size === 0) onlineSocketsByConversacion.delete(convId);
            // Avisar al room que el socket se fue (para dot verde)
            ordersNamespace.to(`conv_${convId}`).emit('chat:presence', {
              conversacion_id: convId,
              online: set?.size ?? 0,
            });
          }
        }
      }
    });

    // ========== CHAT (piloto local 4) ==========
    //
    // El handshake es libre (cualquiera puede conectar, igual que el POS).
    // PERO los eventos `chat:join` y `chat:typing` validan identidad:
    //  - Si `socket.handshake.auth.token` está presente, se verifica con
    //    JWT_SECRET y se extrae el user (cliente o staff del local).
    //  - Si no hay token, se acepta solo para conversaciones anónimas
    //    (las que tienen `cliente_identificador LIKE 'anon:%'`). El cliente
    //    envía su `cliente_identificador` en el payload del `chat:join`
    //    para que el server valide que el identificador coincide con la
    //    conversación.
    //
    // Decisión: NO usar `io.use((socket, next) => ...)` porque eso
    // rechazaría TODA conexión al namespace, incluyendo los sockets del
    // POS que ya no pasan token. Validamos por evento en su lugar.

    socket.on('chat:join', async ({ conversacion_id, anon_identifier } = {}, ack) => {
      try {
        if (!conversacion_id) {
          return ackError(ack, 'conversacion_id es obligatorio');
        }
        const { getById: getConv } = await import('../models/Conversacion.js');
        const conv = await getConv(conversacion_id);
        if (!conv) return ackError(ack, 'Conversación no encontrada');

        const auth = socket.handshake.auth || {};
        let isAuthorized = false;

        if (auth.token) {
          // Cliente logueado o staff: verificar JWT.
          try {
            const jwt = (await import('jsonwebtoken')).default;
            const decoded = jwt.verify(auth.token, process.env.JWT_SECRET);
            socket.data.user = decoded;

            if (decoded.tipo_usuario === 'admin') {
              isAuthorized = true;
            } else if (decoded.tipo_usuario === 'cliente') {
              isAuthorized = conv.cliente_identificador === `user:${decoded.id}`;
            } else {
              // staff: pertenece al local de la conversación?
              // Si decoded.restaurante_id es null y es tipo 'restaurante',
              // buscar fallback (mismo patrón que chatMiddleware).
              let localId = decoded.restaurante_id;
              if (!localId && decoded.tipo_usuario === 'restaurante') {
                const { query } = await import('../config/database.js');
                const rows = await query(
                  'SELECT id FROM restaurantes WHERE usuario_id = ? LIMIT 1',
                  [decoded.id]
                );
                localId = rows?.[0]?.id ?? null;
              }
              isAuthorized = Number(localId) === Number(conv.restaurante_id);
            }
          } catch (e) {
            return ackError(ack, 'Token inválido o expirado');
          }
        } else if (anon_identifier) {
          // Cliente anónimo: validar que el identificador coincide.
          isAuthorized = conv.cliente_identificador === anon_identifier;
        }

        if (!isAuthorized) {
          return ackError(ack, 'No autorizado para unirse a esta conversación');
        }

        // OK: unirse al room.
        socket.join(`conv_${conversacion_id}`);
        if (!socket.data.joinedConversations) socket.data.joinedConversations = new Set();
        socket.data.joinedConversations.add(conversacion_id);
        const set = onlineSocketsByConversacion.get(conversacion_id) || new Set();
        set.add(socket.id);
        onlineSocketsByConversacion.set(conversacion_id, set);

        // Avisar al room cuántos están conectados.
        ordersNamespace.to(`conv_${conversacion_id}`).emit('chat:presence', {
          conversacion_id,
          online: set.size,
        });

        if (typeof ack === 'function') ack({ ok: true, conversacion_id, online: set.size });
      } catch (err) {
        console.error('[socket] chat:join error:', err.message);
        ackError(ack, 'Error interno');
      }
    });

    socket.on('chat:leave', ({ conversacion_id } = {}, ack) => {
      if (!conversacion_id) return ackError(ack, 'conversacion_id es obligatorio');
      socket.leave(`conv_${conversacion_id}`);
      if (socket.data?.joinedConversations) socket.data.joinedConversations.delete(conversacion_id);
      const set = onlineSocketsByConversacion.get(conversacion_id);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineSocketsByConversacion.delete(conversacion_id);
        ordersNamespace.to(`conv_${conversacion_id}`).emit('chat:presence', {
          conversacion_id,
          online: set.size,
        });
      }
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('chat:typing', ({ conversacion_id, typing } = {}) => {
      if (!conversacion_id) return;
      // Solo retransmitir a OTROS sockets en el room; no al que está
      // escribiendo (UX: evita el flash de "escribiendo..." en su propia UI).
      socket.to(`conv_${conversacion_id}`).emit('chat:typing', {
        conversacion_id,
        typing: !!typing,
        user_id: socket.data?.user?.id ?? null,
      });
    });

    /**
     * Evento: Error
     */
    socket.on('error', (error) => {
      console.error(`⚠️ Error en Socket.IO: ${error}`);
    });
  });

  // Namespace de restaurantes
  const restaurantsNamespace = io.of('/restaurants');
  restaurantsNs = restaurantsNamespace;

  restaurantsNamespace.on('connection', (socket) => {
    console.log(`🏪 Restaurante conectado: ${socket.id}`);

    /**
     * Se une a la sala del restaurante
     */
    socket.on('join_restaurant_room', (restaurante_id) => {
      socket.join(`restaurant_${restaurante_id}`);
      console.log(`✅ Restaurante ${restaurante_id} en sala`);
    });

    /**
     * Broadcast: Cambio de estado del restaurante (abierto/cerrado)
     */
    socket.on('restaurant_status', (data) => {
      const { restaurante_id, estado } = data;
      
      restaurantsNamespace.emit('restaurant_status_changed', {
        restaurante_id,
        estado,
        timestamp: new Date().toISOString()
      });

      console.log(`🔄 Estado restaurante ${restaurante_id}: ${estado}`);
    });

    /**
     * Broadcast: Cambio en menú (producto agregado/eliminado)
     */
    socket.on('menu_updated', (data) => {
      const { restaurante_id, producto, tipo } = data;

      restaurantsNamespace.emit('menu_changed', {
        restaurante_id,
        producto,
        tipo,
        timestamp: new Date().toISOString()
      });

      console.log(`📋 Menú actualizado en restaurante ${restaurante_id}`);
    });

    socket.on('disconnect', () => {
      console.log(`📴 Restaurante desconectado: ${socket.id}`);
    });
  });

  console.log('✅ Socket.IO configurado correctamente');
}

/**
 * Helper para enviar ack de error desde un handler de socket.
 * Si el cliente no mandó función de ack, lo logueamos pero no rompemos.
 */
function ackError(ack, message) {
  console.warn('[socket] chat error:', message);
  if (typeof ack === 'function') ack({ ok: false, error: message });
}

