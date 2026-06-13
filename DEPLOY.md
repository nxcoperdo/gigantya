# 🚀 Guía de Despliegue - VPS Hostinger

## Requisitos Previos

- VPS con Ubuntu 20.04/22.04 LTS
- Dominio apuntando al VPS (opcional pero recomendado)
- Acceso SSH al servidor

## 1. Conexión al Servidor

```bash
ssh root@tu-ip-vps
```

## 2. Actualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

## 3. Instalar Node.js y npm

```bash
# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # v20.x.x
npm --version   # 10.x.x
```

## 4. Instalar MySQL

```bash
sudo apt install -y mysql-server

# Asegurar instalación
sudo mysql_secure_installation

# Iniciar MySQL
sudo systemctl start mysql
sudo systemctl enable mysql
```

### Crear Base de Datos y Usuario

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE restaurante_pedidos_gigantya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'gigantya_user'@'localhost' IDENTIFIED BY 'CONTRASEÑA_MUY_SEGURA';

GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

### Aplicar Schema

```bash
mysql -u gigantya_user -p restaurante_pedidos_gigantya < /ruta/al/proyecto/database/schema.sql
mysql -u gigantya_user -p restaurante_pedidos_gigantya < /ruta/al/proyecto/database/migrations/002_add_password_reset_tokens.sql
```

## 5. Clonar/Transferir Proyecto

### Opción A: Git (recomendado)

```bash
cd /var/www
git clone https://github.com/tu-usuario/gigantya.git
cd gigantya
```

### Opción B: SCP desde local

```bash
# Desde tu máquina local
scp -r ./gigantya root@tu-ip-vps:/var/www/
```

## 6. Configurar Backend

```bash
cd /var/www/gigantya/server

# Instalar dependencias
npm install --production

# Copiar archivo de producción
cp .env.production .env

# Editar .env con tus credenciales
nano .env
```

### Variables CRÍTICAS a cambiar en `.env`:

- `DB_PASSWORD` - Contraseña de MySQL
- `JWT_SECRET` - Generar con: `openssl rand -base64 32`
- `CORS_ORIGIN` - Tu dominio (ej: `https://gigantya.com`)
- `SMTP_USER` y `SMTP_PASS` - Tu email
- `FRONTEND_URL` - Tu dominio

## 7. Configurar Frontend

```bash
cd /var/www/gigantya/client

# Instalar dependencias
npm install

# Copiar archivo de producción
cp .env.production .env

# Editar .env
nano .env
```

Cambiar `VITE_API_URL` por tu dominio:
```
VITE_API_URL=https://tudominio.com/api
```

### Compilar Frontend

```bash
npm run build
```

## 8. Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Configurar PM2 para el Backend

```bash
cd /var/www/gigantya/server

# Iniciar aplicación
pm2 start src/server.js --name gigantya-api

# Guardar configuración de PM2
pm2 save

# Configurar PM2 para iniciar al boot
pm2 startup
# Copiar y ejecutar el comando que muestra (sudo env ...)
```

### Comandos útiles de PM2

```bash
pm2 status          # Ver estado
pm2 logs            # Ver logs en tiempo real
pm2 restart api     # Reiniciar
pm2 stop api        # Detener
pm2 monit           # Monitor en tiempo real
```

## 9. Configurar Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/gigantya
```

### Configuración Nginx

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Frontend (archivos estáticos)
    location / {
        root /var/www/gigantya/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API (reverse proxy)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Habilitar Sitio

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/gigantya /etc/nginx/sites-enabled/

# Eliminar sitio por defecto (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Probar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 10. Configurar SSL con Certbot (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (ya viene configurada)
sudo systemctl status certbot.timer
```

## 11. Configurar Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000/tcp    # Backend API
sudo ufw allow 5001/tcp    # Socket.IO
sudo ufw enable
```

## 12. Verificar Instalación

Visita:
- `https://tudominio.com` - Frontend
- `https://tudominio.com/api/auth/me` - API test

## 13. Scripts de Producción

### Backup de Base de Datos

Crear archivo `/var/www/gigantya/backup-db.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/gigantya"
mkdir -p $BACKUP_DIR

mysqldump -u gigantya_user -pCONTRASEÑA restaurante_pedidos_gigantya > $BACKUP_DIR/db_backup_$DATE.sql

# Eliminar backups de más de 7 días
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completado: $BACKUP_DIR/db_backup_$DATE.sql"
```

```bash
chmod +x /var/www/gigantya/backup-db.sh

# Agregar a crontab (diario a las 3 AM)
crontab -e
# Agregar línea:
0 3 * * * /var/www/gigantya/backup-db.sh
```

### Deploy Script

Crear archivo `/var/www/gigantya/deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Iniciando deploy..."

# Backend
cd /var/www/gigantya/server
git pull origin main
npm install --production
pm2 restart gigantya-api

# Frontend
cd /var/www/gigantya/client
git pull origin main
npm install
npm run build

echo "✅ Deploy completado!"
```

```bash
chmod +x /var/www/gigantya/deploy.sh
```

## 14. Monitoreo y Logs

### Ver Logs

```bash
# Backend
pm2 logs gigantya-api

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MySQL
sudo tail -f /var/log/mysql/error.log
```

### Monitoreo de Recursos

```bash
htop              # Uso de CPU/RAM
df -h             # Uso de disco
free -h           # Memoria disponible
```

## 15. Solución de Problemas

### El frontend no carga

```bash
# Verificar build
cd /var/www/gigantya/client
npm run build

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

### La API no responde

```bash
# Verificar PM2
pm2 status
pm2 logs gigantya-api

# Verificar puerto
netstat -tulpn | grep 5000
```

### Error de base de datos

```bash
# Verificar MySQL
sudo systemctl status mysql

# Verificar credenciales
mysql -u gigantya_user -p -e "SHOW DATABASES;"
```

## Checklist Final

- [ ] MySQL instalado y configurado
- [ ] Schema aplicado
- [ ] Node.js instalado
- [ ] Backend ejecutándose con PM2
- [ ] Frontend compilado
- [ ] Nginx configurado como reverse proxy
- [ ] SSL/HTTPS configurado
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] `.env` con valores seguros de producción

## Soporte

Para issues específicos de Hostinger, contactar su soporte 24/7 vía live chat.
