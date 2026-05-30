# 🌐 Guía de Despliegue en Producción

## Plataformas Soportadas

- ✅ Heroku
- ✅ AWS EC2
- ✅ DigitalOcean
- ✅ Vercel (Frontend)
- ✅ Railway
- ✅ Render

## Requisitos Previos

- Node.js 16+
- MySQL 8.0+
- Git
- Dominio (comprarlo en Namecheap, GoDaddy, etc)
- SSL Certificate (Let's Encrypt gratuito)

---

## 1️⃣ Despliegue en DigitalOcean (Recomendado)

### Step 1: Crear Droplet

1. Ir a DigitalOcean.com
2. Crear nuevo Droplet
3. Seleccionar:
   - Ubuntu 22.04 LTS
   - $6/mes (Basic)
   - Nueva región
4. Agregar SSH key
5. Crear droplet

### Step 2: Conectarse y Configurar

```bash
# SSH al droplet
ssh root@{IP_DEL_DROPLET}

# Update
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar MySQL
sudo apt install -y mysql-server

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2
sudo npm install -g pm2

# Instalar Git
sudo apt install -y git
```

### Step 3: Clonar el Repositorio

```bash
cd /var/www
sudo git clone https://github.com/{usuario}/gigantya.git
cd gigantya
sudo chown -R $USER:$USER .

# Instalar dependencias
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### Step 4: Configurar MySQL

```bash
# Conectarse a MySQL
sudo mysql -u root

# Crear usuario
CREATE USER 'gigantya_prod'@'localhost' IDENTIFIED BY '{CONTRASEÑA_SEGURA}';
GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_prod'@'localhost';
FLUSH PRIVILEGES;

# Crear base de datos e importar schema
CREATE DATABASE restaurante_pedidos_gigantya;
EXIT;

# Importar schema
mysql -u gigantya_prod -p restaurante_pedidos_gigantya < database/schema.sql
```

### Step 5: Configurar Variables de Entorno

```bash
# Backend
cd /var/www/gigantya/server
sudo nano .env
```

```env
# Database
DB_HOST=localhost
DB_USER=gigantya_prod
DB_PASSWORD={CONTRASEÑA_SEGURA}
DB_NAME=restaurante_pedidos_gigantya

# Server
NODE_ENV=production
PORT=5000

# JWT (CAMBIAR!)
JWT_SECRET={GENERAR_CON_: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"}
JWT_EXPIRE=7d

# CORS (tu dominio)
CORS_ORIGIN=https://tu-dominio.com
```

```bash
# Frontend
cd /var/www/gigantya/client
sudo nano .env
```

```env
VITE_API_URL=https://api.tu-dominio.com/api
VITE_SOCKET_URL=https://api.tu-dominio.com
```

### Step 6: Build del Frontend

```bash
cd /var/www/gigantya/client
npm run build

# Mover archivos a Nginx
sudo cp -r dist/* /var/www/html/
```

### Step 7: Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

```nginx
# Frontend
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Redirigir a HTTPS después de instalar SSL
    # return 301 https://$server_name$request_uri;
}

# Backend API
upstream backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name api.tu-dominio.com;

    location / {
        proxy_pass http://backend;
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
        proxy_pass http://backend/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Redirigir a HTTPS después de instalar SSL
    # return 301 https://$server_name$request_uri;
}
```

```bash
# Validar configuración
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 8: SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx

# Generar certificados (automático)
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com -d api.tu-dominio.com

# Para renovación automática
sudo systemctl enable certbot.timer
```

### Step 9: Iniciar Backend con PM2

```bash
cd /var/www/gigantya/server

# Iniciar
pm2 start src/server.js --name "gigantya-api"

# Configurar autostart
pm2 startup
pm2 save

# Ver logs
pm2 logs gigantya-api
```

### Step 10: Configurar Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 2️⃣ Despliegue en Heroku

### Paso 1: Preparar Aplicación

```bash
# Crear Procfile
echo "web: cd server && npm start" > Procfile

# Crear .gitignore
git add .
git commit -m "Ready for production"
```

### Paso 2: Deploy

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Crear app
heroku create gigantya-api

# Agregar MySQL (ClearDB)
heroku addons:create cleardb:ignite

# Configurar variables
heroku config:set JWT_SECRET="tu_clave_secreta"
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN="https://gigantya.herokuapp.com"

# Deploy
git push heroku main

# Ver logs
heroku logs --tail
```

---

## 3️⃣ Despliegue en AWS EC2

### Paso 1: Launch EC2 Instance

1. AWS Console → EC2 → Launch Instance
2. Seleccionar Ubuntu 22.04 LTS
3. Instance Type: t2.micro (free tier)
4. Crear security group:
   - SSH: 22
   - HTTP: 80
   - HTTPS: 443
   - Custom: 5000 (API)

### Paso 2: Configuración

Similar a DigitalOcean, pero usando AWS RDS para MySQL es recomendado:

```bash
# Crear RDS Instance
# - Engine: MySQL 8.0
# - Instance: db.t3.micro (free tier)
# - Multi-AZ: No (for prod, yes)
# - Storage: 20GB
# - Backup retention: 7 days
```

---

## 🔒 Seguridad en Producción

### Checklist

- [ ] Cambiar JWT_SECRET a valor seguro
- [ ] Cambiar contraseña DB MySQL
- [ ] Habilitar HTTPS/SSL
- [ ] Configurar CORS con dominio específico
- [ ] Habilitar firewall
- [ ] Remover datos de ejemplo
- [ ] Habilitar backups automáticos
- [ ] Configurar rate limiting
- [ ] Habilitar logging
- [ ] Usar variables de ambiente para secrets
- [ ] Remover console.logs sensibles
- [ ] Configurar HTTPS en Heroku (automatic)
- [ ] Usar helmet middleware
- [ ] Implementar CSRF tokens

### Variables de Ambiente (Producción)

```env
# Nunca commitar .env en Git!
# Usar .env.example con placeholders

NODE_ENV=production
PORT=5000
DB_HOST=tu-rds-hostname.amazonaws.com
DB_USER=admin
DB_PASSWORD=contraseña_muy_segura_random_32_caracteres
DB_NAME=restaurante_pedidos_gigantya

JWT_SECRET=tu_jwt_secret_super_seguro_cambiar
JWT_EXPIRE=7d

CORS_ORIGIN=https://tu-dominio.com

# Opcional
SENTRY_DSN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

## 🔄 CI/CD con GitHub Actions

### Crear `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_IP }}
        username: root
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/gigantya
          git pull origin main
          cd server && npm install && npm start &
          cd ../client && npm install && npm run build
          sudo cp -r dist/* /var/www/html/
          sudo systemctl restart nginx
```

---

## 📊 Monitoreo en Producción

### Logs y Alertas

```bash
# Ver logs en tiempo real
pm2 logs gigantya-api

# Usar herramientas
npm install -g forever    # Alternative to PM2
npm install -g supervisor # Alternative to PM2

# Configurar rotación de logs
sudo apt install logrotate

# Crear /etc/logrotate.d/gigantya
/var/www/gigantya/server/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 nobody nobody
    sharedscripts
    postrotate
        pm2 reload gigantya-api > /dev/null 2>&1
    endscript
}
```

### Backups Automáticos

```bash
# Crear script de backup
sudo nano /usr/local/bin/backup-gigantya.sh
```

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups/gigantya"
mkdir -p $BACKUP_DIR

# Backup MySQL
mysqldump -u gigantya_prod -p{PASSWORD} restaurante_pedidos_gigantya | \
  gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Subir a S3 (opcional)
# aws s3 cp $BACKUP_DIR/db_$TIMESTAMP.sql.gz s3://tu-bucket/backups/

# Limpiar backups antiguos (>30 días)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

```bash
# Agregar a cron (diariamente a las 3 AM)
0 3 * * * /usr/local/bin/backup-gigantya.sh
```

---

## 📈 Performance

### Optimizaciones

1. **Database**
   ```sql
   -- Agregar índices
   CREATE INDEX idx_pedido_restaurante ON pedidos(restaurante_id);
   CREATE INDEX idx_usuario_email ON usuarios(email);
   ```

2. **Caching**
   ```javascript
   // Instalar Redis
   npm install redis
   
   // Cachear restaurantes que no cambian frecuentemente
   ```

3. **Compression**
   ```bash
   # Nginx ya activa gzip
   # Pero puedes verificar en nginx.conf
   ```

4. **CDN**
   ```
   - CloudFlare (DNS + CDN gratis)
   - AWS CloudFront
   - Bunny CDN
   ```

---

## 🚨 Troubleshooting Producción

### Backend no inicia

```bash
# Ver error
pm2 logs gigantya-api --err

# Verificar puerto
sudo netstat -tlnp | grep 5000

# Verificar DB conecta
mysql -u gigantya_prod -p -h DB_HOST -D DB_NAME -e "SELECT 1"
```

### Nginx no sirve frontend

```bash
# Verificar configuración
sudo nginx -t

# Ver error
sudo tail -f /var/log/nginx/error.log

# Recargar
sudo nginx -s reload
```

### SSL Certificate Vencido

```bash
# Renovar manualmente
sudo certbot renew --dry-run

# O automático
sudo systemctl status certbot.timer
```

---

## 📝 Checklist de Deployment

- [ ] Base de datos creada y poblada
- [ ] Variables de ambiente configuradas
- [ ] Dominio apuntando a servidor
- [ ] SSL certificate instalado
- [ ] Frontend compilado y servido
- [ ] Backend corriendo con PM2
- [ ] Nginx configurado correctamente
- [ ] Firewall habilitado
- [ ] Backups automáticos configurados
- [ ] Logging habilitado
- [ ] Monitoreo configurado
- [ ] Usuarios de prueba creados
- [ ] Emails de notificación funcionando
- [ ] Rate limiting activo
- [ ] CORS limitado a tu dominio

---

## 🎉 ¡Listo!

Tu aplicación está en producción. Ahora:

1. Monitorear logs regularmente
2. Hacer backups periódicos
3. Actualizar dependencias mensualmente
4. Verificar seguridad
5. Escalar cuando sea necesario

---

**Última actualización:** 2025-05-15

