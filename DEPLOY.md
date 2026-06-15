# 🚀 Guía de Despliegue - VPS Hostinger

Sistema de Pedidos para Restaurantes Gigantya - Deploy paso a paso.

## 📋 Requisitos Previos

- ✅ VPS con Ubuntu 20.04/22.04 LTS (mínimo 1GB RAM, recomendado 2GB+)
- ✅ Dominio apuntando al VPS (configurar DNS A record)
- ✅ Acceso SSH al servidor
- ✅ Cuenta de email para SMTP (Gmail, SendGrid, etc.)

---

## 🎯 Paso 1: Conexión Inicial al Servidor

```bash
ssh root@tu-ip-vps
```

## 🔧 Paso 2: Configuración Inicial del Sistema

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Crear usuario no-root (recomendado por seguridad)
adduser gigantya
usermod -aG sudo gigantya

# Configurar firewall básico
sudo ufw allow OpenSSH
sudo ufw enable
```

> 💡 **Tip**: De aquí en adelante, trabaja con el usuario `gigantya` (no root) y usa `sudo` solo cuando sea necesario.

## 📦 Paso 3: Instalar Node.js 20 LTS

```bash
# Instalar NVM (recomendado para gestionar versiones)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Instalar Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verificar
node --version  # v20.x.x
npm --version   # 10.x.x
```

## 🗄️ Paso 4: Instalar y Configurar MySQL

```bash
# Instalar MySQL
sudo apt install -y mysql-server

# Asegurar instalación
sudo mysql_secure_installation
# - Set root password: YES
# - Remove anonymous users: YES
# - Disallow root login remotely: YES
# - Remove test database: YES
# - Reload privilege tables: YES

# Crear base de datos y usuario
sudo mysql -u root -p
```

```sql
CREATE DATABASE restaurante_pedidos_gigantya
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'gigantya_user'@'localhost'
  IDENTIFIED BY 'CONTRASEÑA_MUY_SEGURA_AQUI';

GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.*
  TO 'gigantya_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

### Aplicar Schema y Migraciones

```bash
# Desde tu máquina local, copia los archivos SQL al servidor
scp database/schema.sql gigantya@tu-ip:/tmp/
scp database/migrations/*.sql gigantya@tu-ip:/tmp/

# En el servidor, aplicar schema
mysql -u gigantya_user -p restaurante_pedidos_gigantya < /tmp/schema.sql

# Aplicar migraciones en orden
for f in /tmp/migrations/*.sql; do
  echo "Aplicando $f..."
  mysql -u gigantya_user -p restaurante_pedidos_gigantya < "$f"
done
```

## 📥 Paso 5: Clonar el Proyecto

```bash
# Crear directorio de la app
sudo mkdir -p /var/www/gigantya
sudo chown gigantya:gigantya /var/www/gigantya

# Clonar repo
cd /var/www/gigantya
git clone https://github.com/tu-usuario/gigantya.git .
```

> ⚠️ Si NO usas Git, sube los archivos con SCP/SFTP:
> ```bash
> scp -r ./gigantya/* gigantya@tu-ip:/var/www/gigantya/
> ```

## ⚙️ Paso 6: Configurar el Backend

```bash
cd /var/www/gigantya/server

# Instalar dependencias (solo producción)
npm install --production

# Crear archivo .env desde plantilla
cp .env.production .env
nano .env
```

### 🔐 Variables CRÍTICAS del Backend (.env)

Edita `server/.env` con tus valores:

```env
NODE_ENV=production
PORT=5000

# Base de datos (las credenciales que creaste en Paso 4)
DB_HOST=localhost
DB_PORT=3306
DB_USER=gigantya_user
DB_PASSWORD=CONTRASEÑA_MUY_SEGURA_AQUI
DB_NAME=restaurante_pedidos_gigantya

# JWT - ⚠️ CRÍTICO: Generar con openssl rand -base64 48
JWT_SECRET=PEGA_AQUI_TU_SECRETO_ALEATORIO
JWT_EXPIRE=7d

# CORS - tu dominio HTTPS
CORS_ORIGIN=https://tudominio.com

# Frontend URL
FRONTEND_URL=https://tudominio.com

# Email SMTP (Gmail ejemplo)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=contraseña_de_aplicacion_gmail
EMAIL_FROM=GigantYA <noreply@tudominio.com>
```

**Generar JWT_SECRET seguro:**
```bash
openssl rand -base64 48
```

> 💡 **Gmail App Password**: https://myaccount.google.com/apppasswords

## 🎨 Paso 7: Configurar y Compilar el Frontend

```bash
cd /var/www/gigantya/client

# Instalar dependencias
npm install

# Crear .env desde plantilla
cp .env.production .env
nano .env
```

Edita `client/.env`:

```env
# URL de tu API en producción
VITE_API_URL=https://tudominio.com/api
VITE_APP_ENV=production
```

### Compilar para Producción

```bash
npm run build
```

Esto genera la carpeta `client/dist/` optimizada con:
- ✅ Code splitting (cada página es un chunk)
- ✅ Tree shaking
- ✅ Minificación con esbuild
- ✅ Gzip friendly
- ✅ Bundle inicial: ~36KB (10KB gzip)

## 🔄 Paso 8: Instalar y Configurar PM2

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicación
cd /var/www/gigantya/server
pm2 start ecosystem.config.cjs --env production

# Configurar PM2 para iniciar en boot
pm2 startup
# ⚠️ Copia y ejecuta el comando que aparece (empieza con sudo env...)

# Guardar estado actual
pm2 save
```

### Comandos Útiles de PM2

```bash
pm2 status              # Ver estado de procesos
pm2 logs gigantya-api   # Ver logs en tiempo real
pm2 logs --lines 100    # Ver últimas 100 líneas
pm2 monit               # Monitor interactivo (CPU, RAM)
pm2 restart gigantya-api
pm2 reload gigantya-api # Reload sin downtime (zero-downtime)
pm2 stop gigantya-api
pm2 delete gigantya-api
```

## 🌐 Paso 9: Instalar y Configurar Nginx

```bash
sudo apt install -y nginx
```

### Copiar configuración optimizada

```bash
# Copiar el archivo nginx.gigantya.conf que viene con el proyecto
sudo cp /var/www/gigantya/nginx.gigantya.conf /etc/nginx/sites-available/gigantya

# ⚠️ EDITAR: Cambiar "tudominio.com" por tu dominio real
sudo nano /etc/nginx/sites-available/gigantya
# Busca y reemplaza: tudominio.com → tudominio.com

# Activar sitio
sudo ln -s /etc/nginx/sites-available/gigantya /etc/nginx/sites-enabled/

# Eliminar sitio default
sudo rm /etc/nginx/sites-enabled/default

# Probar configuración
sudo nginx -t

# Si todo OK, reiniciar
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Características de la configuración Nginx:

- ✅ Redirección HTTP → HTTPS
- ✅ Compresión GZIP (60-80% reducción)
- ✅ Cache de assets estáticos (1 año)
- ✅ Proxy reverso para API y WebSockets
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ SSL/TLS optimizado

## 🔒 Paso 10: Configurar SSL con Let's Encrypt (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado (sigue las instrucciones)
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Verificar renovación automática
sudo systemctl status certbot.timer

# Probar renovación
sudo certbot renew --dry-run
```

> 🎉 Tu sitio ya está disponible en **https://tudominio.com**

## 🛡️ Paso 11: Configurar Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'    # Puertos 80 y 443

# ⚠️ NO expongas el puerto 5000 públicamente
# (Nginx ya hace de proxy reverso)

sudo ufw enable
sudo ufw status
```

## 💾 Paso 12: Configurar Backups Automáticos

```bash
# Hacer ejecutables los scripts
chmod +x /var/www/gigantya/deploy.sh
chmod +x /var/www/gigantya/backup-db.sh

# Editar backup-db.sh y poner la contraseña de DB
nano /var/www/gigantya/backup-db.sh
# Busca: mysqldump -u "$DB_USER" -p"$DB_PASSWORD"
# Mejor: usar un archivo ~/.my.cnf con credenciales (más seguro)

# Crear archivo de credenciales MySQL
mkdir -p ~/.config/mysql
cat > ~/.my.cnf <<EOF
[client]
user=gigantya_user
password=TU_CONTRASEÑA
EOF
chmod 600 ~/.my.cnf

# Probar backup manualmente
/var/www/gigantya/backup-db.sh

# Configurar cron para backup diario a las 3 AM
crontab -e
# Agregar esta línea:
0 3 * * * /var/www/gigantya/backup-db.sh >> /var/log/gigantya-backup.log 2>&1
```

## 🔄 Paso 13: Deploy Inicial Completo

```bash
# 1. Verificar que el backend responde localmente
curl http://localhost:5000/api/health
# Debe responder: {"status":"ok",...}

# 2. Verificar que Nginx responde
curl http://tudominio.com/api/health
# Debe responder: {"status":"ok",...}

# 3. Ver logs en tiempo real
pm2 logs gigantya-api
```

---

## 📊 Monitoreo y Mantenimiento

### Ver Logs

```bash
# Backend (PM2)
pm2 logs gigantya-api
pm2 logs gigantya-api --lines 200 --nostream

# Nginx
sudo tail -f /var/log/nginx/gigantya_access.log
sudo tail -f /var/log/nginx/gigantya_error.log

# MySQL
sudo tail -f /var/log/mysql/error.log
```

### Monitoreo de Recursos

```bash
htop              # Procesos y uso de CPU/RAM
df -h             # Espacio en disco
free -h           # Memoria
du -sh /var/www/gigantya/server/uploads  # Tamaño de uploads
```

### Actualizar la Aplicación (Deploy)

```bash
cd /var/www/gigantya
./deploy.sh
```

El script automáticamente:
1. ✅ Hace backup del `.env`
2. ✅ Hace `git pull`
3. ✅ Reinstala dependencias
4. ✅ Compila el frontend
5. ✅ Reinicia el backend (zero-downtime)
6. ✅ Recarga Nginx

---

## 🔧 Solución de Problemas

### ❌ Error: "EADDRINUSE: address already in use 0.0.0.0:5000"

```bash
# Ver qué proceso usa el puerto
sudo lsof -i :5000
# O
sudo netstat -tulpn | grep 5000

# Matar el proceso
sudo kill -9 <PID>
pm2 restart gigantya-api
```

### ❌ Frontend carga pero la API no responde

```bash
# 1. Verificar backend
pm2 status
pm2 logs gigantya-api

# 2. Verificar CORS en .env
grep CORS_ORIGIN /var/www/gigantya/server/.env
# Debe ser exactamente: https://tudominio.com (sin / al final)

# 3. Verificar Nginx
sudo nginx -t
curl -I https://tudominio.com/api/health
```

### ❌ Error de conexión a base de datos

```bash
# Probar conexión manualmente
mysql -u gigantya_user -p restaurante_pedidos_gigantya -e "SELECT 1;"

# Verificar que el servicio está corriendo
sudo systemctl status mysql
```

### ❌ Build del frontend falla

```bash
cd /var/www/gigantya/client
# Limpiar caché
rm -rf node_modules dist .vite
npm install
npm run build
```

---

## 📋 Checklist Final

- [ ] MySQL instalado y base de datos creada
- [ ] Schema y migraciones aplicadas
- [ ] Node.js 20 instalado
- [ ] Backend ejecutándose con PM2 (`pm2 status`)
- [ ] Frontend compilado (`client/dist/`)
- [ ] Nginx configurado como reverse proxy
- [ ] SSL/HTTPS configurado con Let's Encrypt
- [ ] Firewall UFW habilitado (solo puertos 22, 80, 443)
- [ ] Backups automáticos configurados (cron)
- [ ] Health check respondiendo: `curl https://tudominio.com/api/health`
- [ ] `.env` con valores seguros (JWT_SECRET aleatorio)
- [ ] Logs funcionando y sin errores críticos

---

## 🎉 Tu sitio está en producción!

- 🌐 **Sitio web**: https://tudominio.com
- 🔌 **API**: https://tudominio.com/api
- 💓 **Health check**: https://tudominio.com/api/health

### Comandos rápidos de referencia

```bash
# Ver todo el estado
pm2 status && sudo systemctl status nginx mysql

# Reiniciar todo
pm2 restart gigantya-api && sudo systemctl reload nginx

# Ver logs en vivo (múltiples ventanas)
pm2 logs gigantya-api
sudo tail -f /var/log/nginx/gigantya_error.log
```

---

## 📞 Soporte

Si tienes problemas con la configuración del VPS de Hostinger:
- 💬 Live chat 24/7 desde tu panel de Hostinger
- 📚 Docs: https://www.hostinger.com/tutorials/vps

Para issues con la aplicación, revisa los logs primero:
```bash
pm2 logs gigantya-api --lines 200
```
