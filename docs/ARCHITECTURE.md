# 🏗️ Arquitectura del Proyecto

## Visión General

```
┌─────────────────────────────────────────────────────────────┐
│                          CLIENTE (BROWSER)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     React App @ localhost:5173                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ Pages: Home, Login, Register, etc            │    │   │
│  │  │ Components: Header, Card, Loading, etc       │    │   │
│  │  │ Context: AuthContext (estado global)         │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│         HTTP REST │ WebSocket                                 │
│                   │ (Socket.IO)                               │
│                   ▼                                            │
└─────────────────────────────────────────────────────────────┘
                       │
      ┌────────────────┴────────────────┐
      ▼                                  ▼
  ┌──────────────────────┐      ┌──────────────────────┐
  │  EXPRESS API         │      │  SOCKET.IO SERVER   │
  │ @ localhost:5000/api │      │ @ localhost:5000    │
  └──────────────────────┘      └──────────────────────┘
      │                                  │
      │         ┌───────────────────────┘
      │         │
      └─────────┴─────────────────────┐
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
          ┌──────────────────────┐          ┌──────────────────────┐
          │   MYSQL DATABASE     │          │  REDIS (opcional)    │
          │  restaurante_pedidos │          │  para sesiones       │
          │     _gigantya        │          │  y caché             │
          └──────────────────────┘          └──────────────────────┘
```

## Frontend (React + Vite + Tailwind)

### Estructura de Carpetas

```
client/src/
├── components/
│   ├── Header.jsx          # Navegación y branding
│   ├── Footer.jsx          # Pie de página
│   ├── Loading.jsx         # Loader
│   └── ProtectedRoute.jsx  # HOC para rutas protegidas
│
├── pages/
│   ├── HomePage.jsx        # Lista de restaurantes
│   ├── LoginPage.jsx       # Autenticación
│   ├── RegisterPage.jsx    # Registro
│   ├── ProfilePage.jsx     # (TODO) Perfil usuario
│   ├── RestaurantPage.jsx  # (TODO) Detalles + carrito
│   ├── OrdersPage.jsx      # (TODO) Mis pedidos
│   └── DashboardPage.jsx   # (TODO) Panel admin/restaurante
│
├── services/
│   ├── api.js              # Cliente HTTP (Axios)
│   └── socket.js           # Cliente Socket.IO
│
├── context/
│   └── AuthContext.jsx     # Estado de autenticación
│
├── App.jsx                 # Router y layout principal
├── main.jsx                # Entry point
└── index.css               # Tailwind + estilos globales
```

### Flujo de Datos Frontend

```
User Input (Form)
      │
      ▼
Component State
      │
      ▼
authService.login() o register()
      │
      ▼
API Request (axios)
      │
      ▼
Response
      │
      ▼
AuthContext.login() / register()
      │
      ▼
localStorage.setItem('token', 'user')
      │
      ▼
Re-render + Navigate
```

### Context API

**AuthContext**: Gestiona el estado global de autenticación

```javascript
{
  user: { id, nombre, email, tipo_usuario },
  token: "jwt_token...",
  isAuthenticated: true/false,
  loading: true/false,
  error: "error_message",
  login: async (email, password) => {},
  register: async (userData) => {},
  logout: () => {}
}
```

## Backend (Node.js + Express)

### Estructura de Carpetas

```
server/src/
├── config/
│   └── database.js         # Pool MySQL con funciones helper
│
├── models/
│   ├── User.js             # Operaciones de usuarios
│   ├── Restaurant.js       # Operaciones de restaurantes
│   ├── Product.js          # Operaciones de productos
│   └── Order.js            # Operaciones de pedidos
│
├── controllers/
│   ├── authController.js   # Lógica de auth
│   ├── restaurantController.js
│   ├── productController.js
│   ├── orderController.js
│   ├── userController.js
│   └── adminController.js
│
├── routes/
│   ├── authRoutes.js       # POST /auth/login, register
│   ├── restaurantRoutes.js # GET /restaurants
│   ├── productRoutes.js    # CRUD /products
│   ├── orderRoutes.js      # CRUD /orders
│   ├── userRoutes.js       # GET /users/profile
│   └── adminRoutes.js      # Admin endpoints
│
├── middleware/
│   └── authMiddleware.js   # JWT verification, roles
│
├── socket/
│   └── socketHandler.js    # Socket.IO events
│
└── server.js               # Express app setup
```

### Flujo de Request

```
HTTP Request (GET /api/restaurants)
      │
      ▼
Express Router (routes/)
      │
      ▼
Middleware (CORS, Auth, etc)
      │
      ▼
verifyToken() [si es protected]
      │
      ▼
Controller (restaurantController.getRestaurants)
      │
      ▼
Model (restaurantService.getRestaurants)
      │
      ▼
Query MySQL
      │
      ▼
Parse Response
      │
      ▼
Return JSON
      │
      ▼
HTTP Response (200, 400, 401, 404, 500)
```

### Middleware Stack

```
Express Server
    │
    ├─ helmet()                 # Seguridad HTTP headers
    │
    ├─ rateLimit()              # 100 req/15min por IP
    │
    ├─ morgan()                 # Logging HTTP
    │
    ├─ express.json()           # Parse JSON body
    │
    ├─ cors()                   # CORS para localhost:5173
    │
    ├─ Routes
    │  ├─ authRoutes
    │  ├─ restaurantRoutes
    │  ├─ productRoutes
    │  ├─ orderRoutes
    │  ├─ userRoutes
    │  └─ adminRoutes
    │
    └─ Error Handler            # Centralizado
```

## Base de Datos (MySQL)

### Schema Relacional

```
usuarios (1)
    │
    ├─────── (1:1) restaurantes
    │           │
    │           ├─────── (1:N) productos
    │           │              │
    │           │              └─── (N:M) pedidos
    │           │
    │           └─────── (1:N) pedidos
    │
    ├─────── (1:N) pedidos
    │           │
    │           └─────── (1:N) items_pedido
    │                         │
    │                         └─── (N:1) productos
    │
    └─────── (1:N) calificaciones
```

### Tablas Principales

| Tabla | Descripción | Relaciones |
|-------|-------------|-----------|
| usuarios | Clientes, Restaurantes, Admin | FK: restaurantes, pedidos |
| restaurantes | Info restaurantes | FK: usuario_id |
| categorias | Categorías de productos | FK: restaurante_id |
| productos | Items del menú | FK: restaurante_id, categoria_id |
| pedidos | Órdenes | FK: usuario_id, restaurante_id |
| items_pedido | Detalles del pedido | FK: pedido_id, producto_id |
| calificaciones | Reviews | FK: pedido_id, usuario_id |

### Índices Críticos

```sql
-- Búsquedas rápidas
INDEX idx_email (email)
INDEX idx_usuario_id (usuario_id)
INDEX idx_restaurante_id (restaurante_id)
INDEX idx_estado (estado)
INDEX idx_creado_en (creado_en)

-- Full text search
FULLTEXT INDEX ft_nombre_descripcion (nombre, descripcion)
```

## Autenticación: JWT

### Flujo

```
1. Usuario login/register
   ├─ Envía email + password
   └─ (contraseña sin hashear por HTTPS)
   
2. Servidor recibe
   ├─ Valida formato
   ├─ Busca usuario en BD
   └─ Compara password con hash (bcrypt)
   
3. Si válido
   ├─ Crea JWT token
   │  └─ Contiene: id, email, tipo_usuario
   │  └─ Vence en: 7 días
   ├─ Retorna token + usuario
   └─ Cliente lo guarda en localStorage
   
4. Requests posteriores
   ├─ Cliente envía: Authorization: Bearer {token}
   ├─ Middleware verifica token
   ├─ Extrae user info del token
   └─ Request continúa con req.user disponible
   
5. Token expirado
   ├─ Servidor retorna 401
   ├─ Cliente borra token
   └─ Usuario redirigido a login
```

### Estructura del JWT

```
Header.Payload.Signature

Header: { alg: "HS256", typ: "JWT" }
Payload: { id: 1, email: "user@ex.com", tipo_usuario: "cliente", iat: 1234567890, exp: 1235173690 }
Signature: HMACSHA256(header.payload, JWT_SECRET)
```

## Socket.IO: Actualizaciones en Tiempo Real

### Namespaces

```
/orders
├─ Eventos para seguimiento de pedidos
├─ Salas: order_${pedido_id}, restaurant_${restaurante_id}
├─ Cliente escucha: status_update
└─ Restaurante emite: order_status_changed

/restaurants
├─ Eventos de estado de restaurante
├─ Salas: restaurant_${restaurante_id}
└─ Emite: restaurant_status_changed, menu_changed
```

### Flow de un Pedido

```
Cliente hace pedido
    │
    ▼
POST /api/orders (HTTP)
    │
    ▼
Server crea pedido en BD
    │
    ▼
Server emite Socket:
    └─ to(restaurant_${id}).emit('new_order', data)
    │
    ▼
Restaurante recibe en tiempo real
└─ Dashboard se actualiza automáticamente
    │
    ▼
Restaurante cambia estado "Preparando"
    │
    ▼
PUT /api/orders/${id}/status (HTTP)
    │
    ▼
Server emite Socket:
    ├─ to(order_${id}).emit('status_update')    [Cliente]
    └─ to(restaurant_${id}).emit('order_updated') [Restaurante]
    │
    ▼
Cliente y Restaurante reciben (WebSocket)
└─ Ambas pantallas se actualizan en tiempo real
```

## Seguridad

### Capas de Protección

```
1. HTTPS en Producción
   └─ Encripta datos en tránsito

2. Rate Limiting
   └─ 100 requests/15 minutos por IP

3. Helmet.js
   └─ Headers de seguridad HTTP

4. JWT en Authorization Header
   └─ No en cookies (XSS protection)

5. CORS
   └─ Solo permite requests de localhost:5173 (dev)

6. SQL Injection Prevention
   └─ Prepared statements (mysql2)

7. Password Hashing
   └─ bcryptjs con salt 10 rounds

8. Input Validation
   └─ express-validator en cada endpoint

9. Error Handling
   └─ No expone detalles internos en prod

10. Roles & Permissions
    └─ Middleware verifica tipo_usuario
```

## Escalabilidad

### Mejoras Futuras Planeadas

```
1. Caché
   ├─ Redis para sesiones
   ├─ Restaurantes (low-frequency change)
   └─ Productos (low-frequency change)

2. Microservicios
   ├─ Orders Service (independiente)
   ├─ Users Service
   ├─ Restaurants Service
   └─ Payments Service (futura)

3. Load Balancing
   ├─ Nginx/HAProxy
   ├─ Multiple Express instances
   └─ Database replication

4. Base de Datos
   ├─ Read replicas
   ├─ Partionamiento por restaurante
   └─ Índices optimizados

5. Queue System
   ├─ Bull/RabbitMQ para jobs
   ├─ Email notifications
   ├─ SMS notifications
   └─ Report generation

6. Monitoring
   ├─ Winston/Bunyan logging
   ├─ Prometheus metrics
   ├─ Grafana dashboards
   └─ Sentry error tracking
```

## Despliegue

### Desarrollo
```
npm run dev
├─ Backend: nodemon (hot reload)
└─ Frontend: Vite dev server
```

### Producción
```
Backend:
├─ npm run build (si aplica)
├─ npm start
└─ PM2 process manager

Frontend:
├─ npm run build
├─ dist/ con Nginx
└─ CDN para assets
```

## Monitoreo

### Logs
```
Backend:
├─ Morgan: HTTP requests
├─ Console: Errors
└─ archivo: error.log

Frontend:
├─ Console: Errors
├─ Network: API calls
└─ Application: Storage (tokens)
```

### Métricas Importantes
- Tiempo de respuesta API
- Errores por endpoint
- Usuarios activos
- Pedidos por día
- Ingresos totales

---

**Última actualización:** 2025-05-15

