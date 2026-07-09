/**
 * Manejador de Socket.IO para actualizaciones en tiempo real
 *
 * Namespaces:
 * - /orders: Eventos de pedidos (y del POS en general — el POS reusa este
 *   namespace para no multiplicar conexiones; los eventos del POS se
 *   distinguen por prefijo `pos:*`).
 * - /restaurants: Información de restaurantes
 *
 * Helper público:
 *   - `emitToRestaurant(restaurante_id, event, payload)`: emite un evento
 *     a todos los clientes en la sala `restaurant_<id>` del namespace
 *     `/orders`. Se usa desde controllers POS (mesas, pedidos, KDS) sin
 *     necesidad de importar `io` directamente.
 */

// Referencia al namespace /orders que se setea en `socketHandler(io)`.
// Los controllers importan `emitToRestaurant` y este helper usa `ordersNs`.
let ordersNs = null;
let restaurantsNs = null;

export function emitToRestaurant(restaurante_id, event, payload) {
  if (!ordersNs) {
    console.warn('[socket] emitToRestaurant llamado antes de inicializar Socket.IO');
    return;
  }
  ordersNs.to(`restaurant_${restaurante_id}`).emit(event, payload);
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

