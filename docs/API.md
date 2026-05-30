# 📚 Documentación API REST

## Base URL

```
http://localhost:5000/api
```

## Autenticación

Todos los endpoints protegidos requieren un JWT token en el header:

```
Authorization: Bearer {token}
```

## 🔐 Autenticación

### Registrar Usuario

**POST** `/auth/register`

```json
{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "telefono": "+573001234567",
  "contraseña": "segura123",
  "contraseña_confirmacion": "segura123",
  "tipo_usuario": "cliente",
  "documento_identidad": "1234567890"
}
```

**Respuesta (201):**
```json
{
  "mensaje": "Usuario registrado exitosamente",
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "tipo_usuario": "cliente"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

---

### Login

**POST** `/auth/login`

```json
{
  "email": "juan@example.com",
  "contraseña": "segura123"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Login exitoso",
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "tipo_usuario": "cliente"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

---

### Obtener Perfil

**GET** `/auth/me`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "+573001234567",
    "tipo_usuario": "cliente",
    "estado": "activo",
    "documento_identidad": "1234567890",
    "creado_en": "2025-05-15T10:30:00Z"
  }
}
```

---

### Actualizar Perfil

**PUT** `/auth/profile`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "nombre": "Juan Carlos Pérez",
  "telefono": "+573009876543"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Perfil actualizado exitosamente",
  "usuario": { ... }
}
```

---

### Cambiar Contraseña

**PUT** `/auth/change-password`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "contraseña_actual": "segura123",
  "contraseña_nueva": "nueva_segura456",
  "contraseña_confirmacion": "nueva_segura456"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Contraseña cambiada exitosamente"
}
```

---

## 🏪 Restaurantes

### Listar Restaurantes

**GET** `/restaurants`

**Query Parameters:**
- `ciudad` (string, opcional)
- `nombre` (string, opcional)

**Ejemplo:**
```
GET /restaurants?ciudad=Gigantá&nombre=pizza
```

**Respuesta (200):**
```json
{
  "total": 2,
  "restaurantes": [
    {
      "id": 1,
      "usuario_id": 2,
      "nombre": "Pizza Casa",
      "descripcion": "Las mejores pizzas de la ciudad",
      "direccion": "Calle 5 #10-20",
      "telefono": "+573001234567",
      "ciudad": "Gigantá, Huila",
      "horario_apertura": "11:00:00",
      "horario_cierre": "23:00:00",
      "imagen_url": "https://...",
      "estado": "activo",
      "aprobado": 1,
      "calificacion": 4.5,
      "creado_en": "2025-05-15T10:30:00Z"
    }
  ]
}
```

---

### Obtener Detalles del Restaurante

**GET** `/restaurants/{id}`

**Respuesta (200):**
```json
{
  "restaurante": {
    "id": 1,
    "nombre": "Pizza Casa",
    "descripcion": "Las mejores pizzas de la ciudad",
    "direccion": "Calle 5 #10-20",
    "telefono": "+573001234567",
    "horario_apertura": "11:00:00",
    "horario_cierre": "23:00:00",
    "productos": {
      "Pizzas": [
        {
          "id": 1,
          "nombre": "Pizza Margherita",
          "descripcion": "Con tomate, mozzarella y albahaca",
          "precio": "25000",
          "disponible": true,
          "imagen_url": "https://..."
        }
      ],
      "Bebidas": [
        {
          "id": 2,
          "nombre": "Coca Cola",
          "precio": "3000",
          "disponible": true
        }
      ]
    }
  }
}
```

---

### Crear Restaurante

**POST** `/restaurants`

**Header:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Mi Restaurante",
  "descripcion": "Descripción aquí",
  "direccion": "Calle 1 #10-20",
  "telefono": "+573001234567",
  "horario_apertura": "11:00",
  "horario_cierre": "23:00",
  "imagen_url": "https://..."
}
```

**Respuesta (201):**
```json
{
  "mensaje": "Restaurante creado exitosamente. Pendiente de aprobación del administrador.",
  "restaurante_id": 1
}
```

---

### Actualizar Restaurante

**PUT** `/restaurants/{id}`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "nombre": "Mi Restaurante Updated",
  "descripcion": "Nueva descripción"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Restaurante actualizado exitosamente"
}
```

---

## 🍽️ Productos

### Obtener Productos por Restaurante

**GET** `/products/restaurant/{restaurante_id}`

**Respuesta (200):**
```json
{
  "total": 3,
  "productos": [
    {
      "id": 1,
      "restaurante_id": 1,
      "categoria_id": 1,
      "nombre": "Pizza Margherita",
      "descripcion": "Con tomate, mozzarella y albahaca",
      "precio": "25000",
      "imagen_url": "https://...",
      "disponible": 1,
      "estado": "activo",
      "creado_en": "2025-05-15T10:30:00Z"
    }
  ]
}
```

---

### Obtener Producto

**GET** `/products/{id}`

**Respuesta (200):**
```json
{
  "producto": { ... }
}
```

---

### Crear Producto

**POST** `/products`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "nombre": "Pizza Pepperoni",
  "descripcion": "Con pepperoni y queso",
  "precio": 28000,
  "categoria_id": 1,
  "imagen_url": "https://..."
}
```

**Respuesta (201):**
```json
{
  "mensaje": "Producto creado exitosamente",
  "producto_id": 3
}
```

---

### Actualizar Producto

**PUT** `/products/{id}`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "nombre": "Pizza Pepperoni XL",
  "precio": 32000
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Producto actualizado exitosamente"
}
```

---

### Eliminar Producto

**DELETE** `/products/{id}`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "mensaje": "Producto eliminado exitosamente"
}
```

---

### Toggle Disponibilidad

**PATCH** `/products/{id}/toggle`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "mensaje": "Disponibilidad actualizada",
  "disponible": false
}
```

---

### Buscar Productos

**GET** `/products/search/{restaurante_id}?q=pizza`

**Query Parameters:**
- `q` (string, requerido, mín 2 caracteres)

**Respuesta (200):**
```json
{
  "query": "pizza",
  "total": 2,
  "productos": [ ... ]
}
```

---

## 📦 Pedidos

### Crear Pedido

**POST** `/orders`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "restaurante_id": 1,
  "items": [
    {
      "producto_id": 1,
      "cantidad": 2,
      "precio_unitario": 25000
    },
    {
      "producto_id": 2,
      "cantidad": 1,
      "precio_unitario": 3000
    }
  ],
  "total": 53000,
  "notas": "Sin cebolla en la pizza",
  "direccion_entrega": "Calle 5 #10-20",
  "telefono_contacto": "+573001234567"
}
```

**Respuesta (201):**
```json
{
  "mensaje": "Pedido creado exitosamente",
  "pedido": {
    "id": 1,
    "usuario_id": 1,
    "restaurante_id": 1,
    "total": 53000,
    "estado": "Pendiente",
    "notas": "Sin cebolla en la pizza",
    "creado_en": "2025-05-15T14:30:00Z",
    "items": [
      {
        "id": 1,
        "pedido_id": 1,
        "producto_id": 1,
        "cantidad": 2,
        "precio_unitario": 25000,
        "subtotal": 50000
      }
    ]
  }
}
```

---

### Obtener Pedido

**GET** `/orders/{id}`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "pedido": {
    "id": 1,
    "usuario_id": 1,
    "restaurante_id": 1,
    "total": 53000,
    "estado": "Pendiente",
    "cliente_nombre": "Juan Pérez",
    "cliente_email": "juan@example.com",
    "restaurante_nombre": "Pizza Casa",
    "items": [
      {
        "id": 1,
        "producto_nombre": "Pizza Margherita",
        "cantidad": 2,
        "precio_unitario": 25000,
        "subtotal": 50000
      }
    ],
    "creado_en": "2025-05-15T14:30:00Z"
  }
}
```

---

### Mis Pedidos (Cliente)

**GET** `/orders/client/my-orders`

**Header:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `estado` (string, opcional) - Filtrar por estado
- `limit` (number, opcional) - Límite de resultados (defecto: 20)

**Respuesta (200):**
```json
{
  "total": 5,
  "pedidos": [
    {
      "id": 1,
      "restaurante_nombre": "Pizza Casa",
      "total": 53000,
      "estado": "Entregado",
      "items_count": 2,
      "creado_en": "2025-05-15T14:30:00Z"
    }
  ]
}
```

---

### Pedidos del Restaurante

**GET** `/orders/restaurant/my-orders`

**Header:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `estado` (string, opcional) - Filtrar por estado

**Respuesta (200):**
```json
{
  "total": 3,
  "restaurante_id": 1,
  "pedidos": [
    {
      "id": 1,
      "cliente_nombre": "Juan Pérez",
      "cliente_telefono": "+573001234567",
      "total": 53000,
      "estado": "Preparando",
      "items_count": 2,
      "creado_en": "2025-05-15T14:30:00Z"
    }
  ]
}
```

---

### Cambiar Estado del Pedido

**PUT** `/orders/{id}/status`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "estado": "Preparando"
}
```

**Estados válidos:**
- `Pendiente`
- `Preparando`
- `Listo`
- `Entregado`
- `Cancelado`

**Respuesta (200):**
```json
{
  "mensaje": "Estado del pedido actualizado",
  "pedido": { ... }
}
```

---

### Cancelar Pedido

**DELETE** `/orders/{id}`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "mensaje": "Pedido cancelado exitosamente"
}
```

**Nota:** Solo se pueden cancelar pedidos con estado "Pendiente"

---

## 👥 Usuarios

### Obtener Perfil

**GET** `/users/profile`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "+573001234567",
    "tipo_usuario": "cliente",
    "estado": "activo",
    "creado_en": "2025-05-15T10:30:00Z"
  }
}
```

---

### Actualizar Perfil

**PUT** `/users/profile`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "nombre": "Juan Carlos Pérez",
  "telefono": "+573009876543"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Perfil actualizado",
  "usuario": { ... }
}
```

---

## 🛡️ Admin

### Obtener Todos los Restaurantes

**GET** `/admin/restaurants`

**Header:**
```
Authorization: Bearer {token}
```

**Nota:** Solo accesible para admin

**Respuesta (200):**
```json
{
  "total": 5,
  "restaurantes": [ ... ]
}
```

---

### Obtener Restaurantes Pendientes

**GET** `/admin/restaurants/pending`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "total": 2,
  "restaurantes": [ ... ]
}
```

---

### Aprobar Restaurante

**PUT** `/admin/restaurants/{id}/approve`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "mensaje": "Restaurante aprobado exitosamente"
}
```

---

### Rechazar Restaurante

**PUT** `/admin/restaurants/{id}/reject`

**Header:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "razon": "No cumple con requisitos"
}
```

**Respuesta (200):**
```json
{
  "mensaje": "Restaurante rechazado"
}
```

---

### Obtener Estadísticas

**GET** `/admin/stats`

**Header:**
```
Authorization: Bearer {token}
```

**Respuesta (200):**
```json
{
  "estadisticas": {
    "usuarios_totales": 25,
    "restaurantes_aprobados": 5,
    "pedidos_totales": 150,
    "ingresos_totales": 4500000
  }
}
```

---

## ⚠️ Códigos de Error

### 400 - Bad Request
```json
{
  "error": "Camposrequeridos faltando: ..."
}
```

### 401 - Unauthorized
```json
{
  "error": "Token no proporcionado"
}
```

### 403 - Forbidden
```json
{
  "error": "No tienes permiso para acceder a este recurso"
}
```

### 404 - Not Found
```json
{
  "error": "Recurso no encontrado"
}
```

### 409 - Conflict
```json
{
  "error": "El email ya está registrado"
}
```

### 500 - Internal Server Error
```json
{
  "error": "Error interno del servidor"
}
```

---

## 🔄 Estados del Pedido

| Estado | Descripción |
|--------|-------------|
| Pendiente | Pedido acaba de ser creado |
| Preparando | El restaurante está preparando |
| Listo | Listo para entregar |
| Entregado | Completado |
| Cancelado | Cancelado por cliente/admin |

---

## 📝 Notas Importantes

1. **Autenticación**: Todos los endpoints excepto login, register y GET restaurantes requieren token
2. **Autorización**: Solo propietarios pueden editar sus restaurantes/productos
3. **Rate Limiting**: 100 requests por 15 minutos
4. **CORS**: Habilitado solo para localhost:5173 en desarrollo
5. **Timestamps**: Todos los tiempos están en UTC (ISO 8601)

---

**Última actualización:** 2025-05-15

