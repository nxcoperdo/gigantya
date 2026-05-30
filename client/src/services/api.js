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
  update: (id, data) => api.put(`/restaurants/${id}`, data),
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
  search: (restaurante_id, query) => 
    api.get(`/products/search/${restaurante_id}`, { params: { q: query } }),
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
};

export default api;

