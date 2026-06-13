# Memoria del Proyecto Gigantya

## Funcionalidades Implementadas (2026-06-13)

### 📧 Sistema de Notificaciones Externas
- **Archivo:** `server/src/services/notificationService.js`
- **Características:**
  - Envío de emails vía Nodemailer (SMTP/SendGrid)
  - Envío de SMS vía Twilio
  - 7 plantillas de emails para diferentes estados de pedido
  - Configuración vía variables de entorno (.env)
- **Documentación:** `docs/FEATURES_IMPLEMENTADAS.md`

### ⭐ Sistema de Reseñas y Calificaciones
- **Endpoints:** GET `/api/ratings/restaurant/:id` (público), POST/PUT (autenticado)
- **UI:** 
  - Modal de calificación en `OrdersHistoryPage.jsx`
  - Sección de calificaciones en `RestaurantDetailsPage.jsx`
  - Promedio mostrado en `HomePage.jsx`
- **Características:**
  - Calificación 1-5 estrellas con comentario opcional
  - Solo pedidos "Entregados" pueden ser calificados
  - Distribución gráfica de calificaciones
  - Promedio actualizado automáticamente

### 📊 Migraciones de Base de Datos
- **Archivo:** `database/migrations/001_add_order_states.sql`
- **Cambios:**
  - Nuevos estados de pedido: Comprobante Enviado, Pago Confirmado, Pago Rechazado
  - Índices para calificaciones
  - Columnas de plan (básico/profesional/premium)

---

## Enlaces a Documentación
- [Características Implementadas](docs/FEATURES_IMPLEMENTADAS.md)
- [Arquitectura del Proyecto](docs/ARCHITECTURE.md)
- [Índice General](docs/INDEX.md)
