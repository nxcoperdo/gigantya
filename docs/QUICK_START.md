# 🚀 Guía Rápida de Inicio

## ⏱️ 5 Minutos para Estar Corriendo

### 1️⃣ Preparar Base de Datos (1 min)

```bash
# Abrir MySQL
mysql -u root -p

# Crear usuario (en MySQL):
CREATE USER 'gigantya_user'@'localhost' IDENTIFIED BY 'gigantya123456';
GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Crear schema:
mysql -u root -p < database/schema.sql
```

### 2️⃣ Backend (2 min)

```bash
cd server
npm install
npm run dev
```

**Esperado:**
```
🚀 Servidor ejecutándose en puerto 5000
```

### 3️⃣ Frontend (2 min)

En otra terminal:

```bash
cd client
npm install
npm run dev
```

**Esperado:**
```
Local: http://localhost:5173/
```

### ✅ Listo!

- Frontend: http://localhost:5173
- Backend: http://localhost:5000/api
- Base de Datos: localhost:3306

---

## 🧪 Pruebas Rápidas

### Test 1: Ver Restaurantes
```
GET http://localhost:5000/api/restaurants
```

### Test 2: Registrar Usuario
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre":"Test User",
    "email":"test@test.com",
    "telefono":"+573001234567",
    "contraseña":"test1234",
    "contraseña_confirmacion":"test1234",
    "tipo_usuario":"cliente"
  }'
```

### Test 3: Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@test.com",
    "contraseña":"test1234"
  }'
```

---

## 📦 Estructura del Proyecto

```
gigantya/
├── client/              # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/  # Componentes reutilizables
│   │   ├── pages/       # Páginas (Home, Login, Register)
│   │   ├── services/    # API y Socket.IO
│   │   ├── context/     # AuthContext
│   │   ├── App.jsx      # Aplicación principal
│   │   └── index.css    # Tailwind CSS
│   ├── package.json
│   ├── vite.config.js
│   └── .env            # Variables de entorno
│
├── server/              # Node.js + Express
│   ├── src/
│   │   ├── config/      # Conexión MySQL
│   │   ├── controllers/ # Lógica de negocio
│   │   ├── models/      # Modelos de datos
│   │   ├── routes/      # Rutas API
│   │   ├── middleware/  # Auth, validaciones
│   │   ├── socket/      # Socket.IO
│   │   └── server.js    # Servidor principal
│   ├── package.json
│   └── .env             # Variables de entorno
│
├── database/
│   └── schema.sql       # Schema MySQL completo
│
└── docs/
    ├── API.md           # Documentación API
    ├── SETUP.md         # Setup detallado
    └── QUICK_START.md   # Esta guía
```

---

## 🔑 Variables de Entorno

### Backend (.env)
- `DB_HOST`: localhost
- `DB_USER`: gigantya_user
- `DB_PASSWORD`: gigantya123456
- `DB_NAME`: restaurante_pedidos_gigantya
- `PORT`: 5000
- `JWT_SECRET`: Cambiar en producción

### Frontend (.env)
- `VITE_API_URL`: http://localhost:5000/api
- `VITE_SOCKET_URL`: http://localhost:5000

---

## 🧑‍🔬 Cuentas de Prueba

### Admin
- Email: admin@restaurantes.local
- Password: admin123
- (Hash precargado en base de datos)

### Cliente (crear con UI)
- Tipo: Cliente
- Puede ver restaurantes
- Puede hacer pedidos

### Restaurante (crear con UI)
- Tipo: Restaurante
- Puede crear menú
- Recibe pedidos

---

## 🛠️ Comandos Útiles

### Backend
```bash
cd server

# Desarrollo
npm run dev

# Producción
npm start

# Ver logs
npm run dev 2>&1 | tee server.log
```

### Frontend
```bash
cd client

# Desarrollo
npm run dev

# Build producción
npm run build

# Vista previa build
npm run preview
```

### Base de Datos
```bash
# Conectar
mysql -u gigantya_user -p restaurante_pedidos_gigantya

# Ver tablas
SHOW TABLES;

# Ver usuarios
SELECT * FROM usuarios;

# Ver restaurantes
SELECT * FROM restaurantes;

# Ver pedidos
SELECT * FROM pedidos;
```

---

## 📱 Características Implementadas

### ✅ Frontend
- [x] Sistema de autenticación (Login/Registro)
- [x] Componentes responsive
- [x] Tailwind CSS integrado
- [x] Context API para estado global
- [x] Header y Footer
- [x] Página de inicio con lista de restaurantes
- [x] Búsqueda de restaurantes
- [ ] Detalle de restaurante (TODO)
- [ ] Carrito de compras (TODO)
- [ ] Dashboard cliente (TODO)
- [ ] Dashboard restaurante (TODO)
- [ ] Panel admin (TODO)

### ✅ Backend
- [x] API REST completa
- [x] Sistema de autenticación JWT
- [x] Modelos de datos
- [x] Controladores
- [x] Rutas protegidas
- [x] Validaciones
- [x] Error handling
- [x] Socket.IO configurado
- [x] CORS configurado
- [x] Rate limiting
- [x] Seguridad básica

### ✅ Base de Datos
- [x] Schema completo
- [x] Tablas normalizadas
- [x] Relaciones configuradas
- [x] Índices
- [x] Vistas útiles
- [x] Datos de ejemplo

---

## 🚨 Troubleshooting Rápido

### Puerto 5000 en uso
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID {PID} /F

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

### MySQL no conecta
```bash
# Windows: Start MySQL from Services
# macOS: brew services start mysql
# Linux: sudo service mysql start

# Verificar
mysql -u gigantya_user -p -e "SELECT 1"
```

### Node modules corrupto
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Próximas Características

1. **Página de Detalles del Restaurante**
   - Mostrar menú
   - Agregar al carrito
   - Ver horarios

2. **Carrito y Checkout**
   - Gestionar items
   - Calcular total
   - Procesar pedido

3. **Dashboard Cliente**
   - Ver pedidos
   - Rastrear en tiempo real
   - Historial

4. **Dashboard Restaurante**
   - Ver pedidos pendientes
   - Cambiar estado
   - Gestionar menú
   - Estadísticas

5. **Panel Admin**
   - Aprobar restaurantes
   - Ver estadísticas
   - Gestionar usuarios

6. **Integraciones**
   - Pagos (Stripe/PayPal)
   - SMS/Email
   - Google Maps
   - Redes sociales

---

## 💡 Tips

1. **Socket.IO**: Los cambios de estado de pedidos se actualizan en tiempo real
2. **Autenticación**: El token se guarda en localStorage
3. **Base de Datos**: Las contraseñas se hashean con bcrypt (salt 10)
4. **API**: Todos los errores retornan status codes apropiados
5. **Frontend**: Tailwind CSS está preconfigurado con colores personalizados

---

## 🔗 Enlaces Útiles

- [Documentación Completa](./docs/API.md)
- [Setup Detallado](./docs/SETUP.md)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Socket.IO](https://socket.io)
- [JWT](https://jwt.io)

---

## 📞 Soporte

Revisa los logs:
- Backend: Terminal del servidor
- Frontend: Consola del navegador (F12)
- MySQL: `/var/log/mysql/error.log`

---

**¡A disfrutar del proyecto! 🚀**

Última actualización: 2025-05-15

