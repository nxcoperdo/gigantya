import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let ordersSocket = null;
let restaurantsSocket = null;

export const socketService = {
  // Conectar al namespace de órdenes
  connectOrders: () => {
    if (!ordersSocket) {
      ordersSocket = io(`${SOCKET_URL}/orders`, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      ordersSocket.on('connect', () => {
        console.log('✅ Socket.IO (órdenes) conectado');
      });

      ordersSocket.on('disconnect', () => {
        console.log('❌ Socket.IO (órdenes) desconectado');
      });

      ordersSocket.on('error', (error) => {
        console.error('⚠️ Error Socket.IO (órdenes):', error);
      });
    }

    return ordersSocket;
  },

  // Conectar al namespace de restaurantes
  connectRestaurants: () => {
    if (!restaurantsSocket) {
      restaurantsSocket = io(`${SOCKET_URL}/restaurants`, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      restaurantsSocket.on('connect', () => {
        console.log('✅ Socket.IO (restaurantes) conectado');
      });

      restaurantsSocket.on('disconnect', () => {
        console.log('❌ Socket.IO (restaurantes) desconectado');
      });

      restaurantsSocket.on('error', (error) => {
        console.error('⚠️ Error Socket.IO (restaurantes):', error);
      });
    }

    return restaurantsSocket;
  },

  // Desconectar
  disconnect: () => {
    if (ordersSocket) {
      ordersSocket.disconnect();
      ordersSocket = null;
    }
    if (restaurantsSocket) {
      restaurantsSocket.disconnect();
      restaurantsSocket = null;
    }
  },

  // ========== ÓRDENES ==========

  // Unirse a una sala de restaurante (para recibir nuevas órdenes)
  joinRestaurant: (restaurante_id, usuario_id) => {
    const socket = socketService.connectOrders();
    socket.emit('join_restaurant', restaurante_id, usuario_id);
  },

  // Unirse a una sala de orden (para rastreo)
  joinOrder: (pedido_id, usuario_id) => {
    const socket = socketService.connectOrders();
    socket.emit('join_order', pedido_id, usuario_id);
  },

  // Notificar nueva orden
  notifyOrderCreated: (data) => {
    const socket = socketService.connectOrders();
    socket.emit('order_created', data);
  },

  // Escuchar nuevas órdenes
  onNewOrder: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('new_order', callback);
  },

  // Notificar cambio de estado
  notifyOrderStatusChanged: (data) => {
    const socket = socketService.connectOrders();
    socket.emit('order_status_changed', data);
  },

  // Escuchar actualizaciones de estado
  onStatusUpdate: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('status_update', callback);
  },

  // Escuchar actualizaciones de orden (para restaurante)
  onOrderUpdated: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('order_updated', callback);
  },

  // ========== POS (Fase 2+): mesas, cocina, turnos ==========
  // El backend emite los eventos `pos:*` en el namespace /orders, reusando
  // la conexión existente para no multiplicar sockets en el cliente.

  onTablesUpdated: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:tables_updated', callback);
  },

  onTableStatusChanged: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:table_status_changed', callback);
  },

  onPosOrderCreated: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:order_created', callback);
  },

  onKitchenTicketReady: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:kitchen_ticket_ready', callback);
  },

  // ========== POS (Fase 6): inventario ==========
  // Suscribirse a un evento arbitrario del namespace /orders. Útil para
  // componentes que necesitan escuchar eventos `pos:*` y des-suscribirse
  // en cleanup. El socket se mantiene singleton; múltiples suscriptores
  // del mismo evento son posibles (cada uno con su callback).

  subscribeToEvent: (event, callback) => {
    const socket = socketService.connectOrders();
    socket.on(event, callback);
  },

  unsubscribeFromEvent: (event, callback) => {
    if (ordersSocket) {
      ordersSocket.off(event, callback);
    }
  },

  onStockUpdated: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:stock_updated', callback);
  },

  onInventoryLow: (callback) => {
    const socket = socketService.connectOrders();
    socket.on('pos:inventory_low', callback);
  },

  // ========== RESTAURANTES ==========

  joinRestaurantRoom: (restaurante_id) => {
    const socket = socketService.connectRestaurants();
    socket.emit('join_restaurant_room', restaurante_id);
  },

  notifyRestaurantStatus: (data) => {
    const socket = socketService.connectRestaurants();
    socket.emit('restaurant_status', data);
  },

  onRestaurantStatusChanged: (callback) => {
    const socket = socketService.connectRestaurants();
    socket.on('restaurant_status_changed', callback);
  },

  // ========== ESCUCHADORES GENERALES ==========

  // Remover listener
  off: (namespace, event) => {
    if (namespace === 'orders' && ordersSocket) {
      ordersSocket.off(event);
    } else if (namespace === 'restaurants' && restaurantsSocket) {
      restaurantsSocket.off(event);
    }
  },

  // Remover todos los listeners
  offAll: (namespace) => {
    if (namespace === 'orders' && ordersSocket) {
      ordersSocket.offAny();
    } else if (namespace === 'restaurants' && restaurantsSocket) {
      restaurantsSocket.offAny();
    }
  },
};

// Named exports para componentes que prefieran destructurar (ej.
// useEffect cleanup). Equivalentes a los métodos de socketService.
export const subscribeToEvent = (event, callback) => socketService.subscribeToEvent(event, callback);
export const unsubscribeFromEvent = (event, callback) => socketService.unsubscribeFromEvent(event, callback);

export default socketService;

