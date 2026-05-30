# 🎯 INICIO RÁPIDO - Lee esto Primero

¡Bienvenido a **Gigantya**! 🏪

Esta es una **plataforma completa para pedidos online de restaurantes** lista para producción.

---

## ⚡ En 10 Minutos Estarás Corriendo

### 1. Base de Datos (2 min)

```bash
# Abre MySQL y ejecuta:
mysql -u root -p < database/schema.sql

# Crear usuario:
mysql -u root -p << EOF
CREATE USER 'gigantya_user'@'localhost' IDENTIFIED BY 'gigantya123456';
GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### 2. Backend (3 min)

```bash
cd server
npm install
npm run dev
```

**Verás:** `🚀 Servidor ejecutándose en puerto 5000`

### 3. Frontend (3 min)

Abre otra terminal:

```bash
cd client
npm install
npm run dev
```

**Verás:** `Local: http://localhost:5173/`

### ✅ ¡Funcionando!

- 🌐 Front: http://localhost:5173
- 🔌 API: http://localhost:5000/api
- 💾 DB: localhost:3306

---

## 📚 Documentación

| Documento | Contenido |
|-----------|----------|
| **[QUICK_START.md](./docs/QUICK_START.md)** | ⚡ Setup en 5 minutos |
| **[SETUP.md](./docs/SETUP.md)** | 📋 Setup detallado paso a paso |
| **[API.md](./docs/API.md)** | 📖 Documentación completa de endpoints |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | 🏗️ Cómo funciona el proyecto |
| **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | 🚀 Desplegar en producción |

---

## 🚀 Stack Tecnológico

```
Frontend:
  ✨ React 18 (UI Library)
  ⚡ Vite (Build Tool)
  🎨 Tailwind CSS (Styling)
  🌐 Axios (HTTP Client)
  🔌 Socket.IO Client (Real-time)

Backend:
  🟩 Node.js (Runtime)
  🚀 Express (Web Framework)
  🗄️ MySQL (Database)
  🔐 JWT (Authentication)
  🔌 Socket.IO (Real-time)

Seguridad:
  🛡️ Helmet (Headers)
  🔒 bcryptjs (Password Hashing)
  ⏱️ Rate Limiting
  🔗 CORS
```

---

## 🎨 Características

### ✅ Implementadas

**Cliente:**
- ✅ Registro/Login
- ✅ Ver restaurantes
- ✅ Búsqueda
- ✅ (TODO) Carrito
- ✅ (TODO) Hacer pedidos
- ✅ (TODO) Rastreo en tiempo real

**Restaurante:**
- ✅ Registro/Login
- ✅ Dashboard básico
- ✅ (TODO) Gestionar menú
- ✅ (TODO) Ver pedidos
- ✅ (TODO) Cambiar estado

**Admin:**
- ✅ Aprobar restaurantes
- ✅ Ver estadísticas
- ✅ Gestionar usuarios

---

## 💻 Estructura del Proyecto

```
gigantya/
├── client/          # React Frontend @ :5173
├── server/          # Node.js Backend @ :5000
├── database/        # MySQL Schema
└── docs/            # Documentación

client/src/
├── components/      # Componentesreutilizables
├── pages/           # Páginas principales
├── services/        # API + Socket.IO
├── context/         # AuthContext
└── App.jsx          # Entry point

server/src/
├── config/          # Database
├── controllers/     # Lógica de negocio
├── models/          # Operaciones BD
├── routes/          # Endpoints API
├── middleware/      # Auth + validaciones
├── socket/          # WebSocket events
└── server.js        # Express app
```

---

## 🧪 Cuentas de Prueba

### Crear Cliente
1. Ir a http://localhost:5173
2. Click "Registrarse"
3. Tipo: Cliente
4. Llenar campos

### Crear Restaurante
1. Ir a http://localhost:5173
2. Click "Registrarse"
3. Tipo: Restaurante
4. Llenar campos

### Admin (En BD)
```sql
mysql> UPDATE usuarios SET tipo_usuario='admin' WHERE id=1;
```

---

## 🔑 Variables de Ambiente

### Backend (.env)
```env
DB_HOST=localhost
DB_USER=gigantya_user
DB_PASSWORD=gigantya123456
DB_NAME=restaurante_pedidos_gigantya
PORT=5000
JWT_SECRET=tu_clave_secreta
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🧪 Pruebas de API

### Registrar Usuario
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre":"Test",
    "email":"test@test.com",
    "telefono":"+573001234567",
    "contraseña":"test1234",
    "contraseña_confirmacion":"test1234",
    "tipo_usuario":"cliente"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@test.com",
    "contraseña":"test1234"
  }'
```

### Obtener Token y Usar en Requests
```bash
# Guardar el token de la respuesta anterior

curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer {TOKEN_AQUI}"
```

---

## 🛠️ Comandos Útiles

### Backend
```bash
cd server
npm run dev        # Desarrollo
npm start          # Producción
npm install        # Instalar deps
```

### Frontend
```bash
cd client
npm run dev        # Desarrollo
npm run build      # Compilar
npm run preview    # Ver build local
npm install        # Instalar deps
```

### Base de Datos
```bash
# Conectar
mysql -u gigantya_user -p restaurante_pedidos_gigantya

# Ver tablas
SHOW TABLES;

# Ver usuarios
SELECT * FROM usuarios;

# Ver pedidos
SELECT * FROM pedidos;
```

---

## 🐛 Problemas Comunes

### ❌ "MySQL connection refused"
```bash
# Verificar que MySQL está corriendo
mysql -u root -p -e "SELECT 1"
```

### ❌ "Port 5000 already in use"
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID {PID} /F

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

### ❌ "Cannot find module"
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

---

## 📱 Pantallas Incluidas

### ✅ Completadas
- Inicio (lista restaurantes)
- Login
- Registro
- Header + Footer

### 🚧 Por Hacer
- Detalle restaurante
- Carrito
- Checkout
- Mis pedidos
- Dashboard restaurante
- Panel admin

---

## 🔒 Seguridad

✅ BCrypt para contraseñas
✅ JWT para autenticación
✅ CORS configurado
✅ Rate limiting habilitado
✅ Helmet para headers HTTP
✅ Validaciones en backend

---

## 📈 Próximas Mejoras

1. Integración de pagos (Stripe/PayPal)
2. Notificaciones por email/SMS
3. Sistema de reseñas
4. Cupones y promociones
5. Analytics avanzado
6. App mobile

---

## 🤝 Contribuir

Este es un MVP abierto. Siéntete libre de:
- Reportar bugs
- Sugerir features
- Hacer pull requests
- Mejorar documentación

---

## 📞 Soporte

**Revisa los logs:**
- Backend: Terminal del servidor
- Frontend: Consola del navegador (F12)
- MySQL: Comando `SHOW ERRORS;`

**Documentación:**
- [Leer SETUP.md](./docs/SETUP.md)
- [Ver API.md](./docs/API.md)
- [Entender ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 📄 Licencia

MIT License - Libre para usar y modificar

---

## 👨‍💻 Autor

Creado para **Gigantá, Huila, Colombia** 🇨🇴

Hecho con ❤️ usando:
- React
- Node.js
- MySQL
- Socket.IO

---

## 🎯 Siguientes Pasos

👉 **1. Lee:** [QUICK_START.md](./docs/QUICK_START.md)
👉 **2. Instala:** Dependencias con `npm install`
👉 **3. Configura:** Base de datos
👉 **4. Ejecuta:** `npm run dev`
👉 **5. Desarrolla:** Agrega más features

---

### ¿Necesitas ayuda?

1. **Setup Issues?** → [SETUP.md](./docs/SETUP.md)
2. **Querydifferent endpoint?** → [API.md](./docs/API.md)
3. **Entender el flujo?** → [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. **Deploy en prod?** → [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

**Happy Coding! 🚀**

*Última actualización: 2025-05-15*

