import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejo de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ========== AUTENTICACIÓN ==========

export const authService = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, contrasena: password }),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ========== RESTAURANTES ==========

export const restaurantService = {
  getAll: (filtros = {}) => api.get('/restaurants', { params: filtros }),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => {
    const isFormData = data instanceof FormData;
    return api.put(`/restaurants/${id}`, data, {
      headers: {
        ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : {}),
      },
    });
  },
  getStats: () => api.get('/restaurants/me/stats'),
};

// ========== PRODUCTOS ==========

export const productService = {
  getByRestaurant: (restaurante_id) =>
    api.get(`/products/restaurant/${restaurante_id}`),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  toggle: (id) => api.patch(`/products/${id}/toggle`),
  uploadImage: (formData) => api.post('/products/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  search: (restaurante_id, query) =>
    api.get(`/products/search/${restaurante_id}`, { params: { q: query } }),
  // Galería de fotos (plan Profesional/Premium)
  uploadGallery: (producto_id, formData) => api.post(`/products/gallery`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getGallery: (producto_id) => api.get(`/products/gallery/${producto_id}`),
  deleteGalleryImage: (producto_id, imagen_id) => api.delete(`/products/gallery/${producto_id}/${imagen_id}`),
};

// ========== PEDIDOS ==========

export const orderService = {
  create: (data) => api.post('/orders', data),
  getById: (id) => api.get(`/orders/${id}`),
  getClientOrders: (params = {}) => 
    api.get('/orders/client/my-orders', { params }),
  getRestaurantOrders: (params = {}) => 
    api.get('/orders/restaurant/my-orders', { params }),
  updateStatus: (id, estado) => 
    api.put(`/orders/${id}/status`, { estado }),
  cancel: (id) => api.delete(`/orders/${id}`),
};

// ========== USUARIOS ==========

export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

// ========== DIRECCIONES ==========

export const addressService = {

  getAll: () => api.get('/addresses'),
  getDefault: () => api.get('/addresses/default'),
  create: (data) => api.post('/addresses', data),
  update: (id, data) => api.put(`/addresses/${id}`, data),
  delete: (id) => api.delete(`/addresses/${id}`),
  setDefault: (id) => api.put(`/addresses/${id}/default`),
};

// ========== ADMIN ==========

export const adminService = {
  getRestaurants: () => api.get('/admin/restaurants'),
  getPendingRestaurants: () => api.get('/admin/restaurants/pending'),
  approveRestaurant: (id) => api.put(`/admin/restaurants/${id}/approve`),
  rejectRestaurant: (id) => api.put(`/admin/restaurants/${id}/reject`),
  getStats: () => api.get('/admin/stats'),
  getAnalytics: () => api.get('/admin/analytics'),
  sendGlobalNotification: (data) => api.post('/admin/notifications/global', data),
  getOrders: () => api.get('/admin/orders'),
  updateOrderStatus: (id, status) => api.put(`/admin/orders/${id}/status`, { estado: status }),
  // User management
  getUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  updateUserStatus: (id, status) => api.put(`/admin/users/${id}/status`, { estado: status }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  updateRestaurantPlan: (id, payload) => api.put(`/admin/restaurants/${id}/plan`, payload),
  getRestaurantSubscriptions: (id) => api.get(`/admin/restaurants/${id}/subscriptions`),
};

// ========== NOTIFICACIONES ==========

export const notificationService = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ========== PREFERENCIAS (FAVORITOS Y BÚSQUEDA) ==========

export const preferenceService = {
  addFavorite: (data) => api.post('/preferences/favorites', data),
  removeFavorite: (data) => api.delete('/preferences/favorites', { data }),
  getFavorites: (tipo) => api.get(`/preferences/favorites/${tipo}`),
  getSearchHistory: () => api.get('/preferences/search-history'),
  clearSearchHistory: () => api.delete('/preferences/search-history'),
};

// ========== CALIFICACIONES ==========

export const ratingService = {
  rateRestaurant: (data) => api.post('/ratings', data),
  getMyRatings: () => api.get('/ratings/me'),
  editRating: (restaurante_id, data) => api.put(`/ratings/${restaurante_id}`, data),
};

// ========== CATEGORÍAS ==========

export const categoryService = {
  getAll: () => api.get('/categorias'),
};

// ========== CUPONES ==========

export const couponService = {
  getMyCoupons: () => api.get('/coupons/my-coupons'),
  create: (data) => api.post('/coupons', data),
  update: (id, data) => api.put(`/coupons/${id}`, data),
  delete: (id) => api.delete(`/coupons/${id}`),
};

// ========== SUSCRIPCIONES / PLANES ==========

export const subscriptionService = {
  getCurrent: () => api.get('/subscriptions/me'),
  getHistory: () => api.get('/subscriptions/me/history'),
  getPlans: () => api.get('/subscriptions/plans'),
};

// ========== PAGOS / COMPROBANTES ==========

export const paymentService = {
  getPaymentConfig: (restaurante_id) => api.get(`/payments/config/${restaurante_id}`),
  updatePaymentConfig: (data) => api.put('/payments/config', data),
  uploadProof: (formData) => api.post('/payments/proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getProof: (pedido_id) => api.get(`/payments/proof/${pedido_id}`),
  getPendingProofs: () => api.get('/payments/pending'),
  getProofsHistory: (estado) => api.get('/payments/history', { params: { estado } }),
  approveProof: (id) => api.post(`/payments/proof/${id}/approve`),
  rejectProof: (id, motivo_rechazo) => api.post(`/payments/proof/${id}/reject`, { motivo_rechazo }),
};

export default api;

