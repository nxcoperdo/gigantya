# 📚 Tabla de Contenidos - Documentación Gigantya

## 🚀 Comienza Aquí

**Primera vez?** Comienza con:
1. [INICIO.md](./INICIO.md) - Overview rápido (5 min)
2. [QUICK_START.md](./QUICK_START.md) - Setup en 10 minutos
3. Abre el proyecto en tu editor

---

## 📖 Documentación Completa

### 🎯 Overview y Setup
- **[INICIO.md](./INICIO.md)** - Guía de inicio (EMPIEZA AQUÍ)
- **[QUICK_START.md](./QUICK_START.md)** - 5-10 minutos para correr
- **[SETUP.md](./SETUP.md)** - Setup paso a paso detallado
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Resumen completo

### 💻 Desarrollo
- **[API.md](./API.md)** - Documentación de todas las APIs (30+ endpoints)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Cómo funciona internamente

### 🚀 Producción
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Desplegar en varios servicios

---

## 📋 Acciones Rápidas

### Setup Rápido
```bash
# 1. Base de datos
mysql -u root -p < database/schema.sql

# 2. Backend
cd server && npm install && npm run dev

# 3. Frontend (otra terminal)
cd client && npm install && npm run dev
```

### Acceder a la App
- Frontend: http://localhost:5173
- API: http://localhost:5000/api
- Base de datos: localhost:3306

---

## 📁 Estructura del Proyecto

```
gigantya/
├── 📂 client/                    React + Vite + Tailwind
│   ├── src/
│   │   ├── components/          Header, Footer, Loading, ProtectedRoute
│   │   ├── pages/               Home, Login, Register
│   │   ├── services/            API (axios), Socket.IO
│   │   ├── context/             AuthContext
│   │   ├── App.jsx              Router principal
│   │   └── index.css            Tailwind CSS
│   ├── package.json
│   └── .env                      Preconfigurado
│
├── 📂 server/                    Node.js + Express
│   ├── src/
│   │   ├── config/              database.js
│   │   ├── controllers/         6 controladores
│   │   ├── models/              4 modelos de datos
│   │   ├── routes/              6 rutas
│   │   ├── middleware/          authMiddleware.js
│   │   ├── socket/              socketHandler.js
│   │   └── server.js            Express app
│   ├── package.json
│   └── .env                      Preconfigurado
│
├── 📂 database/
│   └── schema.sql                Schema MySQL completo
│
├── 📂 docs/                      ← TÚ ESTÁS AQUÍ
│   ├── INICIO.md                 Lee esto primero
│   ├── QUICK_START.md            Setup rápido
│   ├── SETUP.md                  Setup detallado
│   ├── API.md                    Documentación endpoints
│   ├── ARCHITECTURE.md           Cómo funciona
│   ├── DEPLOYMENT.md             Deploy a producción
│   ├── PROJECT_SUMMARY.md        Resumen del proyecto
│   └── INDEX.md                  Esta guía
│
└── 📂 .gitignore, README.md, etc
```

---

## 🔗 Links Importantes

### Documentación Técnica

| Link | Tema |
|------|------|
| [INICIO.md](./INICIO.md) | Comienza aquí (5 min) |
| [QUICK_START.md](./QUICK_START.md) | Setup rápido (10 min) |
| [SETUP.md](./SETUP.md) | Setup detallado (30 min) |
| [API.md](./API.md) | Endpoints API (referencia) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Cómo funciona (estudio) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy (producción) |

### Tecnologías

- [React 18](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Express](https://expressjs.com)
- [Socket.IO](https://socket.io)
- [MySQL](https://www.mysql.com)
- [JWT](https://jwt.io)

### Herramientas Recomendadas

- **Editor:** VS Code
- **API Testing:** Postman
- **Database:** MySQL Workbench o phpMyAdmin
- **Version Control:** Git + GitHub

---

## ❓ Preguntas Comunes

### Setup y Instalación

**¿Por dónde empiezo?**
→ Lee [INICIO.md](./INICIO.md)

**¿Cuál es el setup exacto?**
→ Sigue [QUICK_START.md](./QUICK_START.md)

**¿Necesito instalar algo especial?**
→ Solo Node.js 16+ y MySQL 8.0+

**¿Ya estoy corriendo?**
→ Ve a [API.md](./API.md) para empezar a consumir APIs

### Desarrollo

**¿Dónde agrego un nuevo endpoint?**
→ Lee la sección de Rutas en [ARCHITECTURE.md](./ARCHITECTURE.md)

**¿Cómo autenticar requests?**
→ Ver autenticación JWT en [API.md](./API.md)

**¿Quién puede acceder a qué?**
→ Ver Roles en [API.md](./API.md)

**¿Cómo hago real-time updates?**
→ Ver Socket.IO en [ARCHITECTURE.md](./ARCHITECTURE.md)

### Producción

**¿Cómo despliego?**
→ Lee [DEPLOYMENT.md](./DEPLOYMENT.md)

**¿Dónde pongo en vivo?**
→ Se cubren DigitalOcean, AWS, Heroku, Railway en [DEPLOYMENT.md](./DEPLOYMENT.md)

**¿Es seguro?**
→ Sí, incluye JWT, BCrypt, Rate Limiting, Helmet. Ver [ARCHITECTURE.md](./ARCHITECTURE.md)

### Troubleshooting

**Error: "Port already in use"**
```bash
# Windows
netstat -ano | findstr :5000

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

**Error: "Cannot connect to MySQL"**
→ Ver sección MySQL en [SETUP.md](./SETUP.md)

**Redux? Context?**
→ Usamos Context API para autenticación, es suficiente para MVP

---

## 🎯 Roadmap

### MVP ✅ (Completado)
- [x] Backend expresado
- [x] Frontend básico
- [x] Autenticación
- [x] Base de datos
- [x] Documentación

### Next Sprint (WIP)
- [ ] Página detalle restaurante
- [ ] Carrito de compras
- [ ] Dashboard cliente
- [ ] Dashboard restaurante

### Futuro
- [ ] Pagos (Stripe/PayPal)
- [ ] Notificaciones
- [ ] App mobile
- [ ] Analytics

---

## 💡 Tips y Trucos

### Backend
```bash
# Ver logs en tiempo real
pm2 logs

# Restart servidor
npm run dev

# Kill puerto si está ocupado
lsof -ti:5000 | xargs kill -9
```

### Frontend
```bash
# Limpiar caché de Vite
rm -rf node_modules/.vite

# Modo debug
localStorage.setItem('debug', '*')

# Console logs
console.log() en cualquier lugar
```

### Base de Datos
```bash
# Conectar
mysql -u gigantya_user -p restaurante_pedidos_gigantya

# Ver todas las tablas
SHOW TABLES;

# Limpiar tabla
TRUNCATE usuarios;

# Backup
mysqldump -u root -p restaurante_pedidos_gigantya > backup.sql
```

---

## 🤝 Contribuir

### Reportar Bugs
1. Abre issue en GitHub
2. Describe el problema
3. Cómo reproducirlo
4. Expected vs Actual

### Sugerir Features
1. Abre issue como "feature request"
2. Describe qué falta
3. Por qué sería útil
4. Ejemplos de uso

### Mejorar Código
1. Fork del repo
2. Create branch: `git checkout -b feature/nombre`
3. Commit: `git commit -am 'Add feature'`
4. Push: `git push origin feature/nombre`
5. Pull request

---

## 📞 Soporte

### Canal 1: Documentación
- Primero lee la sección relevante
- Busca en [SETUP.md](./SETUP.md) si es setup
- Busca en [API.md](./API.md) si es APIs
- Busca en [ARCHITECTURE.md](./ARCHITECTURE.md) si es arquitectura

### Canal 2: Logs
- Backend: Terminal donde corre `npm run dev`
- Frontend: Browser console (F12)
- MySQL: `mysql -u root -p -e "SHOW ERRORS;"`

### Canal 3: Código
- Revisa comentarios en el código
- Estructura es auto-explicativa
- Model → Controller → Route

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| Archivos | 50+ |
| Líneas de código | 5000+ |
| Endpoints API | 30+ |
| Componentes React | 6 |
| Tablas MySQL | 10 |
| Documentación | 6 guías |
| Tiempo setup | 15 minutos |

---

## ⭐ Checklist para Nuevos Usuarios

- [ ] Leer [INICIO.md](./INICIO.md)
- [ ] Seguir [QUICK_START.md](./QUICK_START.md)
- [ ] Crear cuenta de prueba
- [ ] Testear endpoints en [API.md](./API.md)
- [ ] Entender flujso en [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] Leer TODO comments en código
- [ ] Agregar primera feature

---

## 🎓 Recursos de Aprendizaje

### React
- [react.dev](https://react.dev) - Documentación oficial
- [React Router](https://reactrouter.com) - Routing
- [Context API](https://react.dev/reference/react/useContext) - Estado global

### Node.js
- [nodejs.org](https://nodejs.org) - Documentación
- [expressjs.com](https://expressjs.com) - Express
- [Socket.io](https://socket.io) - WebSocket

### Base de Datos
- [MySQL Docs](https://dev.mysql.com/doc/) - Documentación
- [SQL Tutorial](https://www.w3schools.com/sql/) - SQL Basics
- [Normalization](https://en.wikipedia.org/wiki/Database_normalization) - Database design

### Otros
- [JWT Introduction](https://jwt.io/introduction) - JSON Web Tokens
- [Tailwind CSS](https://tailwindcss.com/docs) - Documentación CSS
- [Postman Guide](https://learning.postman.com/) - API Testing

---

## 🎯 Tus Siguientes Pasos

```
Hoy (Day 1):
  ✓ Lee INICIO.md (5 min)
  ✓ Instala dependencias (5 min)
  ✓ Crea base de datos (3 min)
  ✓ Corre backend y frontend (5 min)
  
Mañana (Day 2):
  ✓ Crea primer usuario
  ✓ Testa endpoints con Postman
  ✓ Revisa el código frontend
  
Semana (Day 7):
  ✓ Agrega página de detalle restaurante
  ✓ Agrega componente carrito
  ✓ Prueba Socket.IO
  
Mes (Day 30):
  ✓ Feature completa: hacer pedido
  ✓ Integración de pagos
  ✓ Deploy a producción
```

---

## 🏆 Lo Que Apenderás

### Frontend
- React hooks y Context API
- Routing con React Router
- Formularios y validaciones
- Tailwind CSS
- HTTP requests con Axios
- WebSocket con Socket.IO

### Backend
- Express.js fundamentals
- RESTful API design
- JWT authentication
- Database queries
- Error handling
- Real-time with Socket.IO

### Base de Datos
- MySQL basics
- Relaciones y integridad
- Prepared statements
- Indexes
- Queries optimization

---

## 🚀 Bonus: Comandos Útiles

```bash
# Backend development
npm run dev              # Start with nodemon

# Frontend development
npm run dev              # Start Vite dev server
npm run build            # Production build

# Database
mysql -u root -p < database/schema.sql    # Create schema
mysql -u gigantya_user -p                 # Connect as user

# Git (cuando lo uses)
git init
git add .
git commit -m "Initial commit"
git push origin main
```

---

## 📞 Última Parada

**Si algo no funciona:**

1. ✅ Verifica que MySQL está corriendo
2. ✅ Verifica que tienes los .env correctos
3. ✅ Verifica que npm install se ejecutó en ambas carpetas
4. ✅ Lee los logs en la terminal
5. ✅ Revisa el console del navegador (F12)
6. ✅ Busca en documentos: SETUP.md, API.md, ARCHITECTURE.md

**Si todo está bien:**

7. 🎉 ¡Empieza a desarrollar!
8. 📖 Lee la documentación de la feature que quieres
9. 💻 Escribe el código
10. 🚀 Vale cuando esté funcionando

---

## 🎉 Conclusión

**Tienes todo lo que necesitas para:**

✅ Entender la arquitectura  
✅ Hacer cambios  
✅ Agregar features  
✅ Deployar a producción  
✅ Trabajar en equipo  

**¿Listo?**

→ [Lee INICIO.md](./INICIO.md) ahora

---

**Última actualización: 2025-05-15**

**Versión: 1.0.0**

**Status: ✅ Listo para desarrollo**

**Happy Coding! 🚀💻🎨**

