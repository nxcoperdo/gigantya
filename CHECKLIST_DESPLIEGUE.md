# ✅ Checklist Pre-Despliegue - Gigantya VPS

## Antes de Desplegar

### 1. Configurar Variables de Entorno

#### Backend (`server/.env.production`)

- [ ] `DB_PASSWORD` - Contraseña segura para MySQL
- [ ] `JWT_SECRET` - Generar con: `openssl rand -base64 32`
- [ ] `CORS_ORIGIN` - Tu dominio real (ej: `https://gigantya.com`)
- [ ] `FRONTEND_URL` - Tu dominio real
- [ ] `SMTP_USER` - Tu email para notificaciones
- [ ] `SMTP_PASS` - App Password de Google (no tu contraseña normal)
- [ ] `EMAIL_FROM` - Nombre y email remitente

#### Frontend (`client/.env.production`)

- [ ] `VITE_API_URL` - URL de tu API (ej: `https://gigantya.com/api`)

### 2. Base de Datos

- [ ] MySQL instalado y corriendo
- [ ] Database creada: `restaurante_pedidos_gigantya`
- [ ] Usuario creado con permisos
- [ ] Schema aplicado (`database/schema.sql`)
- [ ] Migraciones aplicadas (`database/migrations/*.sql`)

### 3. Seguridad

- [ ] Firewall configurado (puertos 80, 443, 22 abiertos)
- [ ] SSL/TLS instalado (Certbot)
- [ ] Contraseñas seguras generadas
- [ ] `.env` no está en el repositorio Git
- [ ] `NODE_ENV=production`

### 4. Dependencias

- [ ] Backend: `npm install --production` ejecutado
- [ ] Frontend: `npm install && npm run build` ejecutado
- [ ] PM2 instalado globalmente

### 5. Nginx

- [ ] Configuración creada en `/etc/nginx/sites-available/`
- [ ] Enlace simbólico en `/etc/nginx/sites-enabled/`
- [ ] `nginx -t` pasa sin errores
- [ ] Nginx reiniciado y habilitado

### 6. PM2 / Servicios

- [ ] Backend iniciado con PM2: `pm2 start src/server.js --name gigantya-api`
- [ ] `pm2 save` ejecutado
- [ ] `pm2 startup` configurado para boot

### 7. Dominio y DNS

- [ ] Dominio apunta a la IP del VPS
- [ ] Certificado SSL válido
- [ ] Redirección HTTP → HTTPS configurada (opcional)

## Después del Despliegue

### Verificaciones

- [ ] Frontend carga en `https://tudominio.com`
- [ ] API responde en `https://tudominio.com/api/auth/me`
- [ ] Login funciona
- [ ] Registro funciona
- [ ] Emails de recuperación llegan
- [ ] WebSocket/Socket.IO conecta (pedidos en tiempo real)

### Monitoreo

- [ ] `pm2 logs gigantya-api` - Sin errores críticos
- [ ] `systemctl status nginx` - Activo y corriendo
- [ ] `systemctl status mysql` - Activo y corriendo

### Backup

- [ ] Script de backup de BD configurado (cron)
- [ ] Primer backup ejecutado exitosamente

## Comandos de Verificación Rápida

```bash
# Estado de servicios
pm2 status
systemctl status nginx
systemctl status mysql

# Logs en tiempo real
pm2 logs gigantya-api --lines 50

# Ver puertos
netstat -tulpn | grep -E '5000|5001|80|443'

# Verificar SSL
sudo certbot certificates
```

## Solución de Problemas Comunes

### Error: "Connection refused" al conectar a MySQL

```bash
# Verificar que MySQL está corriendo
sudo systemctl status mysql

# Verificar credenciales en .env
cat /var/www/gigantya/server/.env | grep DB_
```

### Error: CORS en el frontend

```bash
# Verificar CORS_ORIGIN en .env del backend
# Debe coincidir con el dominio del frontend (sin trailing slash)
CORS_ORIGIN=https://tudominio.com
```

### Emails no llegan

```bash
# Verificar configuración SMTP
cat /var/www/gigantya/server/.env | grep SMTP_

# Ver logs del backend
pm2 logs gigantya-api | grep Email
```

### Frontend muestra página en blanco

```bash
# Verificar build del frontend
cd /var/www/gigantya/client
npm run build

# Verificar configuración Nginx
sudo nginx -t
cat /etc/nginx/sites-available/gigantya
```

## Contacto y Soporte

- Issues de Git: [URL del repositorio]
- Documentación: `/DEPLOY.md`
- Logs del sistema: `/var/log/`
