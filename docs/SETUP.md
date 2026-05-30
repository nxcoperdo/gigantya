# 🚀 Guía de Setup y Ejecución Local

Complete step-by-step guide para configurar y ejecutar Gigantya localmente.

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Configuración Base de Datos](#configuración-base-de-datos)
3. [Configuración Backend](#configuración-backend)
4. [Configuración Frontend](#configuración-frontend)
5. [Ejecución Completa](#ejecución-completa)
6. [Pruebas](#pruebas)
7. [Troubleshooting](#troubleshooting)

## 📦 Prerrequisitos

### Software Requerido
- **Node.js 16.0+** - [Descargar](https://nodejs.org/en/download/)
- **MySQL 8.0+** - [Descargar](https://dev.mysql.com/downloads/mysql/)
- **Git** (opcional)
- **Postman** (para probar APIs, opcional)

### Verificación de Instalación

```bash
# Verificar Node.js
node --version
npm --version

# Verificar MySQL
mysql --version
```

## 🗄️ Configuración Base de Datos

### Paso 1: Crear Base de Datos

```bash
# Conectarse a MySQL
mysql -u root -p

# Ejecutar script SQL
mysql -u root -p < database/schema.sql

# O copiar y pegar el contenido de database/schema.sql en phpMyAdmin
```

### Paso 2: Crear Usuario MySQL

```bash
# Conectarse como root
mysql -u root -p

# Ejecutar:
CREATE USER 'gigantya_user'@'localhost' IDENTIFIED BY 'gigantya123456';
GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Paso 3: Verificar Conexión

```bash
mysql -u gigantya_user -p restaurante_pedidos_gigantya
# Ingresar contraseña: gigantya123456

# Dentro de MySQL:
SHOW TABLES;
DESC usuarios;
EXIT;
```

## ⚙️ Configuración Backend

### Paso 1: Ir a la carpeta del servidor

```bash
cd server
```

### Paso 2: Instalar dependencias

```bash
npm install
```

**Esto instalará:**
- express
- mysql2
- jsonwebtoken
- bcryptjs
- socket.io
- cors
- dotenv
- morgan
- express-validator
- helmet
- express-rate-limit

### Paso 3: Crear archivo .env

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Abrir en editor y configurar
# Windows: notepad .env
# macOS/Linux: nano .env
```

**Contenido de .env:**
```env
# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=gigantya_user
DB_PASSWORD=gigantya123456
DB_NAME=restaurante_pedidos_gigantya

# Servidor
NODE_ENV=development
PORT=5000

# JWT (Cambiar a algo seguro en producción)
JWT_SECRET=tu_clave_secreta_super_segura_aqui_12345
JWT_EXPIRE=7d

# Socket.IO
SOCKET_PORT=5000

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Paso 4: Iniciar el servidor

```bash
# Modo desarrollo (con hot reload)
npm run dev

# Modo producción
npm start

# Salida esperada:
# 🚀 Servidor ejecutándose en puerto 5000
# 📝 Modo: development
# 🔐 CORS habilitado para: http://localhost:5173
```

**El backend estará en:** `http://localhost:5000`

## 🎨 Configuración Frontend

### Paso 1: Ir a la carpeta del cliente

```bash
cd client
```

### Paso 2: Instalar dependencias

```bash
npm install
```

**Esto instalará:**
- react, react-dom
- react-router-dom
- axios
- socket.io-client
- tailwindcss
- vite
- lucide-react

### Paso 3: Crear archivo .env

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Abrir en editor
# Windows: notepad .env
# macOS/Linux: nano .env
```

**Contenido de .env:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Paso 4: Iniciar el servidor de desarrollo

```bash
npm run dev

# Salida esperada:
#   VITE v5.0.8  ready in XXX ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help
```

**Frontend estará en:** `http://localhost:5173`

## 🔄 Ejecución Completa

### Opción 1: Dos Terminales Separadas (Recomendado para desarrollo)

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
# Abrir otra terminal en la carpeta client
cd client
npm run dev
```

**Resultado:**
- Backend: http://localhost:5000
- Frontend: http://localhost:5173
- Socket.IO: ws://localhost:5000/socket.io

### Opción 2: Una Terminal con npm-concurrently

```bash
# En la raíz del proyecto
npm install -g concurrently

# Crear script en package.json (raíz)
{
  "scripts": {
    "dev": "concurrently \"cd server && npm run dev\" \"cd client && npm run dev\""
  }
}

npm run dev
```

## ✅ Verificación

### 1. Verificar Backend

```bash
# Abrir navegador o Postman
http://localhost:5000/api

# Respuesta esperada:
{
  "message": "API Sistema de Pedidos para Restaurantes",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

### 2. Verificar Frontend

```bash
# Abrir en navegador
http://localhost:5173

# Deberías ver:
# - La página de inicio con listado de restaurantes
# - Header con opciones de login/registro
# - Footer
```

### 3. Verificar Conexión a BD

En el backend (cuando esté ejecutándose), deberías ver:
```
✅ Conexión a MySQL exitosa
```

### 4. Probar Autenticación

**Registrar usuario:**
```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "nombre": "Test Cliente",
  "email": "cliente@test.com",
  "telefono": "+573001234567",
  "contraseña": "test1234",
  "contraseña_confirmacion": "test1234",
  "tipo_usuario": "cliente"
}
```

**Login:**
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "cliente@test.com",
  "contraseña": "test1234"
}
```

## 🧪 Pruebas

### Con Postman

1. Importar: `docs/Gigantya.postman_collection.json`
2. Configurar variables de entorno
3. Ejecutar requests

### Con cURL

```bash
# Registrar
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

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","contraseña":"test1234"}'
```

## 🐛 Troubleshooting

### Error: "Port 5000 already in use"

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

### Error: "ECONNREFUSED 127.0.0.1:3306"

**Problemas posibles:**
1. MySQL no está ejecutándose
   ```bash
   # Windows: iniciar MySQL desde servicios
   # macOS: brew services start mysql
   # Linux: sudo service mysql start
   ```

2. Credenciales incorrectas en .env
   ```bash
   # Verificar:
   mysql -u gigantya_user -p
   # Contraseña: gigantya123456
   ```

3. Base de datos no existe
   ```bash
   mysql -u root -p < database/schema.sql
   ```

### Error: "Cannot find module 'react'"

```bash
# En la carpeta client
rm -rf node_modules package-lock.json
npm install
```

### Error CORS

```
Access to XMLHttpRequest from origin 'http://localhost:5173' has been blocked
```

**Solución:**
1. Verificar que backend .env tiene:
   ```
   CORS_ORIGIN=http://localhost:5173
   ```

2. Verificar que frontend .env tiene:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

3. Reiniciar ambos servidores

### Socket.IO no conecta

```
Transport polling failed, no transports available
```

**Solución:**
1. Verificar que backend está corriendo
2. Verificar VITE_SOCKET_URL en frontend .env
3. Verificar firewall no bloquea puerto 5000

### Base de datos vacía

```bash
# Verificar que el schema se ejecutó
mysql -u gigantya_user -p restaurante_pedidos_gigantya
SHOW TABLES;

# Si está vacía:
mysql -u root -p restaurante_pedidos_gigantya < database/schema.sql
```

## 📊 Primeros Pasos en la Aplicación

### 1. Crear Usuario Cliente

1. Ir a http://localhost:5173
2. Click en "Registrarse"
3. Seleccionar "Cliente"
4. Llenar formulario
5. Click "Registrarse"

### 2. Ver Restaurantes

1. Ya deberías estar logueado
2. Verás la lista de restaurantes (estará vacía si no los creaste)

### 3. Crear Usuario Restaurante

1. Ir a http://localhost:5173
2. Click en "Registrarse"
3. Seleccionar "Restaurante"
4. Llenar formulario
5. Click "Registrarse"

### 4. Crear Restaurante

1. Logueado como restaurante
2. Ir al dashboard
3. Crear restaurante (será pendiente de aprobación)

### 5. Admin Approval (Manual)

```bash
# Directamente en MySQL
UPDATE restaurantes SET aprobado = 1 WHERE id = 1;
```

## 🎉 ¡Listo!

Ahora puedes:
- Registrar usuarios
- Crear restaurantes
- Agregar productos
- Hacer pedidos
- Ver actualizaciones en tiempo real

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs del backend y frontend
2. Verifica todas las variables .env
3. Asegúrate de que MySQL esté corriendo
4. Intenta reiniciar los servidores

---

**Última actualización:** 2025-05-15
**Versión:** 1.0.0

