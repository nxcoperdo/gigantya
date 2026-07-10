import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  // NO fijar Content-Type aquí: cuando mandamos FormData el navegador necesita
  // generar `multipart/form-data; boundary=...` por su cuenta, y un Content-Type
  // global aplicado en axios.create bloquea ese comportamiento (resultado: multer 400).
  // Axios añade `application/json` automáticamente cuando enviamos un objeto plano,
  // y omite el header cuando enviamos FormData.
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
      // Evitar redirección cuando el usuario está intentando autenticarse
      // o cuando navega en rutas públicas. Solo redirigir a /login si
      // realmente está navegando en una ruta autenticada.
      const path = window.location.pathname || '';
      const publicAuthPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      if (!publicAuthPaths.some(p => path.startsWith(p))) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
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
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, nueva_contrasena) => api.post('/auth/reset-password', { token, nueva_contrasena }),
};

// ========== RESTAURANTES ==========

export const restaurantService = {
  getAll: (filtros = {}) => api.get('/restaurants', { params: filtros }),
  getById: (id, params = {}) => api.get(`/restaurants/${id}`, { params }),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => {
    // Si `data` es FormData, NO fijar Content-Type manualmente:
    // el navegador/XHR debe generar `multipart/form-data; boundary=...` por su cuenta,
    // y un Content-Type "multipart/form-data" sin boundary hace que multer falle con 400.
    if (data instanceof FormData) {
      return api.put(`/restaurants/${id}`, data);
    }
    return api.put(`/restaurants/${id}`, data);
  },
  getStats: () => api.get('/restaurants/me/stats'),
};

// ========== PRODUCTOS ==========

export const productService = {
  getByRestaurant: (restaurante_id) =>
    api.get(`/products/restaurant/${restaurante_id}`),
  // Feed público de productos de todos los restaurantes (home).
  // Orden: premium → profesional → basico (lo aplica el backend).
  // Acepta filtros, p.ej. { categoria: 'Hamburguesas' }.
  getAll: (filtros = {}) => api.get('/products/all', { params: filtros }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  toggle: (id) => api.patch(`/products/${id}/toggle`),
  uploadImage: (formData) => api.post('/products/upload', formData),
  search: (restaurante_id, query) =>
    api.get(`/products/search/${restaurante_id}`, { params: { q: query } }),
  // Galería de fotos (plan Profesional/Premium)
  uploadGallery: (producto_id, formData) => api.post(`/products/gallery`, formData),
  getGallery: (producto_id) => api.get(`/products/gallery/${producto_id}`),
  deleteGalleryImage: (producto_id, imagen_id) => api.delete(`/products/gallery/${producto_id}/${imagen_id}`),
  // Modificadores de producto (estilo Rappi/PedidosYa) — todos los planes
  getPaqueteModificadores: (id) => api.get(`/products/${id}/paquete-modificadores`),
  replacePaqueteModificadores: (id, data) => api.put(`/products/${id}/paquete-modificadores`, data),
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
  cancelOrder: (id, data) => api.put(`/orders/${id}/cancel`, data),
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
  // Usuarios online (ventana default 5 min). `params.minutos` permite ajustar
  // la ventana entre 1 y 60.
  getOnlineUsers: (params = {}) => api.get('/admin/users/online', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  updateUserStatus: (id, status) => api.put(`/admin/users/${id}/status`, { estado: status }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  // Detalle completo de un usuario para el modal de detalle.
  // Devuelve el usuario con restaurante anidado (si aplica),
  // pedidos_count y ultima_actividad.
  getUserById: (id) => api.get(`/admin/users/${id}`),
  // Pedidos de un usuario (cliente o restaurante).
  // params: { rol: 'cliente' | 'restaurante', limit }
  getUserOrders: (id, params = {}) => api.get(`/admin/users/${id}/orders`, { params }),
  // Comprobantes de pago (vista global del admin, no filtrada por local).
  // filters: { estado, restaurante_id, cliente_id, metodo_pago, desde, hasta, limit, offset }
  getPaymentProofs: (filters = {}) => api.get('/admin/comprobantes', { params: filters }),
  approvePaymentProofAdmin: (id) => api.post(`/admin/comprobantes/${id}/approve`),
  rejectPaymentProofAdmin: (id, motivo_rechazo) =>
    api.post(`/admin/comprobantes/${id}/reject`, { motivo_rechazo }),
  // Auditoría: log de acciones del admin.
  // filters: { admin_id, accion, entidad_tipo, entidad_id, desde, hasta, limit, offset }
  getAuditLogs: (filters = {}) => api.get('/admin/audit', { params: filters }),
  // Category management
  getCategories: () => api.get('/admin/categorias'),
  createCategory: (data) => api.post('/admin/categorias', data),
  updateCategory: (id, data) => api.put(`/admin/categorias/${id}`, data),
  deleteCategory: (id) => api.delete(`/admin/categorias/${id}`),
  // Restaurant management
  updateRestaurantPlan: (id, payload) => api.put(`/admin/restaurants/${id}/plan`, payload),
  updateRestaurantDomicilio: (id, ofrece_domicilio) =>
    api.put(`/admin/restaurants/${id}/ofrece-domicilio`, { ofrece_domicilio }),
  updateRestaurantConsumoEnLocal: (id, ofrece_consumo_en_local) =>
    api.put(`/admin/restaurants/${id}/ofrece-consumo-en-local`, { ofrece_consumo_en_local }),
  updateRestaurantEsMercado: (id, es_mercado_abarrotes) =>
    api.put(`/admin/restaurants/${id}/es-mercado-abarrotes`, { es_mercado_abarrotes }),
  updateRestaurantEsComidaRapida: (id, es_comida_rapida) =>
    api.put(`/admin/restaurants/${id}/es-comida-rapida`, { es_comida_rapida }),
  updateRestaurantEsRestaurante: (id, es_restaurante) =>
    api.put(`/admin/restaurants/${id}/es-restaurante`, { es_restaurante }),
  updateRestaurantEsPanaderiaPasteleria: (id, es_panaderia_pasteleria) =>
    api.put(`/admin/restaurants/${id}/es-panaderia-pasteleria`, { es_panaderia_pasteleria }),
  getRestaurantSubscriptions: (id) => api.get(`/admin/restaurants/${id}/subscriptions`),
  updateRestaurantConfig: (id, payload) => api.put(`/admin/restaurants/${id}/config`, payload),
  // Coupon management (admin) — cupones globales y de cualquier local
  getCoupons: (params = {}) => api.get('/admin/coupons', { params }),
  createCoupon: (data) => api.post('/admin/coupons', data),
  getCoupon: (id) => api.get(`/admin/coupons/${id}`),
  updateCoupon: (id, data) => api.put(`/admin/coupons/${id}`, data),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),
  // Lista cada uso real de un cupón (cada pedido que aplicó un cupón).
  // Filtros: cupon_id, restaurante_id, es_global, fecha_desde, fecha_hasta, limit, offset.
  getCouponUsages: (params = {}) => api.get('/admin/coupons/usages', { params }),
  // CMS Banner de Home (Fase 12b). El super-admin VE la lista de
  // archivos estáticos commiteados en client/public/media/ y marca
  // UNO como activo. Sin uploads ni deletes.
  listHomeMedia: () => api.get('/admin/home-media'),
  // PUT usa el nombre del ARCHIVO (no el id) porque los items pueden
  // tener id=null si nunca se activaron. El backend hace upsert.
  activateHomeMedia: (archivo) => api.put(`/admin/home-media/${encodeURIComponent(archivo)}/activate`),
};

// ========== NOTIFICACIONES ==========

export const notificationService = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  // Marca como leídas todas las notificaciones de un grupo (Hoy/Ayer/Esta semana/Anteriores).
  // El backend recibe el rango de fechas generado en America/Bogota desde el cliente.
  markGroupAsRead: ({ dateKey, from, to }) =>
    api.patch('/notifications/read-by-group', { dateKey, from, to }),
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
  getRestaurantRatings: (restaurante_id) => api.get(`/ratings/restaurant/${restaurante_id}`),
  getUserRating: (restaurante_id) => api.get(`/ratings/my-rating/${restaurante_id}`),
  editRating: (restaurante_id, data) => api.put(`/ratings/${restaurante_id}`, data),
};

// ========== CATEGORÍAS ==========

export const categoryService = {
  getAll: () => api.get('/categorias'),
};

// ========== CUPONES ==========

export const couponService = {
  validate: (codigo, restaurante_id, total_pedido) =>
    api.get('/coupons/validate', { params: { codigo, restaurante_id, total_pedido } }),
  // Búsqueda forzada de cupones globales (ignora restaurante_id).
  // Usado como fallback después de un validate normal que no encontró
  // el cupón en el local actual: si es global, debería matchear acá.
  // Ver `CheckoutPage.handleApplyCoupon` para el flujo completo.
  validateGlobal: (codigo, total_pedido) =>
    api.get('/coupons/validate', {
      params: { codigo, total_pedido, es_carrito_multi_local: 1 },
    }),
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
  uploadProof: (formData) => api.post('/payments/proof', formData),
  getProof: (pedido_id) => api.get(`/payments/proof/${pedido_id}`),
  getPendingProofs: () => api.get('/payments/pending'),
  getProofsHistory: (estado) => api.get('/payments/history', { params: { estado } }),
  approveProof: (id) => api.post(`/payments/proof/${id}/approve`),
  rejectProof: (id, motivo_rechazo) => api.post(`/payments/proof/${id}/reject`, { motivo_rechazo }),
};

// ========== EXPORTAR REPORTES ==========

export const exportService = {
  exportStatsPDF: (days = 30) =>
    api.get('/exports/stats/pdf', { params: { days }, responseType: 'blob' }),
  exportStatsExcel: (days = 30) =>
    api.get('/exports/stats/excel', { params: { days }, responseType: 'blob' }),
  exportOrdersPDF: (estado = 'todos', limit = 100) =>
    api.get('/exports/orders/pdf', { params: { estado, limit }, responseType: 'blob' }),
  exportOrdersExcel: (estado = 'todos', limit = 500) =>
    api.get('/exports/orders/excel', { params: { estado, limit }, responseType: 'blob' }),
};

// ========== ZONAS (sectores / barrios) ==========

export const zonaService = {
  getSectores: () => api.get('/zonas/sectores'),
  getBarrios: (sector_id = null) =>
    api.get('/zonas/barrios', { params: sector_id ? { sector_id } : {} }),
};

// CRUD admin de sectores / barrios (la UI admin usa zonaService para
// lectura y rutas /admin/* para escritura, así que se reusan ambos sets)
export const zonaAdminService = {
  getSectores: () => api.get('/admin/sectores'),
  createSector: (data) => api.post('/admin/sectores', data),
  updateSector: (id, data) => api.put(`/admin/sectores/${id}`, data),
  deleteSector: (id) => api.delete(`/admin/sectores/${id}`),

  getBarrios: (sector_id = null) =>
    api.get('/admin/barrios', { params: sector_id ? { sector_id } : {} }),
  createBarrio: (data) => api.post('/admin/barrios', data),
  updateBarrio: (id, data) => api.put(`/admin/barrios/${id}`, data),
  deleteBarrio: (id) => api.delete(`/admin/barrios/${id}`),
};

// ========== ENVÍOS POR SECTOR (admin / restaurante) ==========

export const restaurantShippingService = {
  getEnviosSectores: (restauranteId) =>
    api.get(`/admin/restaurants/${restauranteId}/envios-sectores`),
  replaceEnviosSectores: (restauranteId, sectores) =>
    api.put(`/admin/restaurants/${restauranteId}/envios-sectores`, { sectores }),
  // Variantes para el dueño del restaurante (rutas bajo /api/restaurants/:id)
  getEnviosSectoresRestaurant: (restauranteId) =>
    api.get(`/restaurants/${restauranteId}/envios-sectores`),
  replaceEnviosSectoresRestaurant: (restauranteId, sectores) =>
    api.put(`/restaurants/${restauranteId}/envios-sectores`, { sectores }),
};

// ========== POS (Fase 1+) ==========
//
// Servicios para el Punto de Venta. Mantener agrupados para no contaminar
// los servicios existentes del cliente (`orderService`, etc.).

/** Staff del restaurante (cajero/mesero/cocina). */
export const posStaffService = {
  list: () => api.get('/pos/staff'),
  create: (data) => api.post('/pos/staff', data),
  setStatus: (id, estado) => api.patch(`/pos/staff/${id}/status`, { estado }),
};

/** Mesas del POS (Fase 2). El backend ya valida que restaurante_id coincida
 *  con el del token, así que no hace falta pasarlo por query. */
export const posTablesService = {
  list:   ()              => api.get('/pos/tables'),
  create: (data)          => api.post('/pos/tables', data),
  update: (id, data)      => api.put(`/pos/tables/${id}`, data),
  setStatus: (id, estado) => api.put(`/pos/tables/${id}/status`, { estado }),
  remove: (id)            => api.delete(`/pos/tables/${id}`),
};

/** Pedidos POS (Fase 3). Reutiliza `pedidos` con `canal='pos'`.
 *  El backend crea walk-in si no viene `cliente_id`. */
export const posOrdersService = {
  list:   (params)     => api.get('/pos/orders', { params }),
  get:    (id)         => api.get(`/pos/orders/${id}`),
  create: (data)       => api.post('/pos/orders', data),
  updateStatus: (id, estado) => api.patch(`/pos/orders/${id}/status`, { estado }),
};

/** Impresión (Fase 4). Devuelve blob PDF que el caller puede embeber
 *  en un iframe / object URL. */
export const printService = {
  kitchenTicket: (id) => api.get(`/print/kitchen-ticket/${id}`, { responseType: 'blob' }),
  receipt:       (id) => api.get(`/print/receipt/${id}`,        { responseType: 'blob' }),
};

/** Caja POS (Fase 5). Sesiones de caja + cobros de pedidos. */
export const posCashService = {
  openSession:    (data) => api.post('/pos/cash-sessions', data),
  currentSession: () => api.get('/pos/cash-sessions/current'),
  sessionById:    (id) => api.get(`/pos/cash-sessions/${id}`),
  sessionSummary: (id) => api.get(`/pos/cash-sessions/${id}/summary`),
  // closeSession acepta opcionalmente `idempotencyKey` que se manda como
  // header Idempotency-Key. axios v1 lo permite vía `headers`.
  closeSession:   (id, data, idempotencyKey) => {
    const cfg = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
    return api.post(`/pos/cash-sessions/${id}/close`, data, cfg);
  },
  chargeOrder:    (id, data) => api.post(`/pos/orders/${id}/charge`, data),
  orderPayments:  (id) => api.get(`/pos/orders/${id}/pagos`),
};

/**
 * Inventario POS (Fase 6). Ingredientes, BOM, kardex y movimientos.
 *  - listIngredientes():                GET    /pos/inventory/ingredientes
 *  - getIngrediente(id):                GET    /pos/inventory/ingredientes/:id
 *  - createIngrediente(data):           POST   /pos/inventory/ingredientes
 *  - updateIngrediente(id, data):       PUT    /pos/inventory/ingredientes/:id
 *  - deleteIngrediente(id):             DELETE /pos/inventory/ingredientes/:id
 *  - getBOM(productoId):                GET    /pos/inventory/bom/producto/:id
 *  - setBOM(productoId, items):         PUT    /pos/inventory/bom/producto/:id
 *  - listKardex(filters):               GET    /pos/inventory/kardex
 *  - crearMovimiento(data):             POST   /pos/inventory/movimientos
 *  - listAlertas():                     GET    /pos/inventory/alertas
 */
export const posInventoryService = {
  // Ingredientes
  listIngredientes:  () => api.get('/pos/inventory/ingredientes'),
  getIngrediente:    (id) => api.get(`/pos/inventory/ingredientes/${id}`),
  createIngrediente: (data) => api.post('/pos/inventory/ingredientes', data),
  updateIngrediente: (id, data) => api.put(`/pos/inventory/ingredientes/${id}`, data),
  deleteIngrediente: (id) => api.delete(`/pos/inventory/ingredientes/${id}`),
  // BOM
  getBOM:            (productoId) => api.get(`/pos/inventory/bom/producto/${productoId}`),
  setBOM:            (productoId, items) => api.put(`/pos/inventory/bom/producto/${productoId}`, { items }),
  // Kardex
  listKardex:        (params) => api.get('/pos/inventory/kardex', { params }),
  // Movimientos manuales
  crearMovimiento:   (data) => api.post('/pos/inventory/movimientos', data),
  // Alertas
  listAlertas:       () => api.get('/pos/inventory/alertas'),
};

/**
 * Servicio de Reportes POS (Fase 7).
 *  - topProductos({ desde, hasta, limite }):    GET    /pos/reports/top-productos
 *  - revenue({ desde, hasta, agrupadoPor }):    GET    /pos/reports/revenue
 *  - metodosPago({ desde, hasta }):             GET    /pos/reports/metodos-pago
 *  - estadisticas({ desde, hasta }):            GET    /pos/reports/estadisticas
 *  - sesion(id):                                GET    /pos/reports/sesion/:id
 */
export const posReportsService = {
  topProductos:  (params) => api.get('/pos/reports/top-productos', { params }).then((r) => r.data),
  revenue:       (params) => api.get('/pos/reports/revenue',       { params }).then((r) => r.data),
  metodosPago:   (params) => api.get('/pos/reports/metodos-pago',  { params }).then((r) => r.data),
  estadisticas:  (params) => api.get('/pos/reports/estadisticas',  { params }).then((r) => r.data),
  sesion:        (id)     => api.get(`/pos/reports/sesion/${id}`).then((r) => r.data),
};

/**
 * Servicio de Split / Transfer / Merge POS (Fase 8).
 *  - chargePartial(pedidoId, body):  POST /pos/orders/:id/charge-partial
 *  - splitByItems(pedidoId, body):   POST /pos/orders/:id/split
 *  - transferOrder(pedidoId, body):  POST /pos/orders/:id/transfer
 *  - mergeTables(body):              POST /pos/tables/merge
 */
export const posSplitTransferService = {
  chargePartial: (pedidoId, body) => api.post(`/pos/orders/${pedidoId}/charge-partial`, body).then((r) => r.data),
  splitByItems:  (pedidoId, body) => api.post(`/pos/orders/${pedidoId}/split`, body).then((r) => r.data),
  transferOrder: (pedidoId, body) => api.post(`/pos/orders/${pedidoId}/transfer`, body).then((r) => r.data),
  mergeTables:   (body)           => api.post('/pos/tables/merge', body).then((r) => r.data),
};

/**
 * Servicio de Configuración POS (Fase 8).
 *  - get():      GET  /pos/config
 *  - update(patch): PUT /pos/config (solo dueño)
 */
export const posConfigService = {
  get:    ()        => api.get('/pos/config').then((r) => r.data),
  update: (patch)   => api.put('/pos/config', patch).then((r) => r.data),
};

// ========== HOME (Fase 12) ==========
// Servicio público (sin auth) para la home del sitio. La HomePage
// consume el banner activo desde acá. El admin del sistema lo
// gestiona con `adminService.uploadHomeMedia` / `activateHomeMedia`.
export const homeService = {
  // Devuelve { media: null } si no hay banner activo, o
  // { media: { id, nombre, archivo_path, tipo, mime } } si hay.
  getActiveHomeMedia: () => api.get('/home/media').then((r) => r.data),
};

export default api;

