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

export default socketService;

