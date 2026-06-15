#!/bin/bash

# ====================================================
# Script de Instalación Automatizada - Gigantya VPS
# ====================================================
# Uso: bash install.sh
# ====================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando instalación de Gigantya...${NC}\n"

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Por favor ejecutar como root (sudo bash install.sh)${NC}"
  exit 1
fi

# ====================================================
# 1. Actualizar sistema
# ====================================================
echo -e "${YELLOW}[1/10] Actualizando sistema...${NC}"
apt update && apt upgrade -y

# ====================================================
# 2. Instalar Node.js
# ====================================================
echo -e "${YELLOW}[2/10] Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}✓ Node.js $(node --version) instalado${NC}"

# ====================================================
# 3. Instalar MySQL
# ====================================================
echo -e "${YELLOW}[3/10] Instalando MySQL...${NC}"
apt install -y mysql-server

systemctl start mysql
systemctl enable mysql

echo -e "${GREEN}✓ MySQL instalado${NC}"

# ====================================================
# 4. Instalar Nginx
# ====================================================
echo -e "${YELLOW}[4/10] Instalando Nginx...${NC}"
apt install -y nginx

systemctl start nginx
systemctl enable nginx

echo -e "${GREEN}✓ Nginx instalado${NC}"

# ====================================================
# 5. Instalar herramientas adicionales
# ====================================================
echo -e "${YELLOW}[5/10] Instalando herramientas adicionales...${NC}"
apt install -y certbot python3-certbot-nginx ufw git unzip

echo -e "${GREEN}✓ Herramientas instaladas${NC}"

# ====================================================
# 6. Configurar firewall
# ====================================================
echo -e "${YELLOW}[6/10] Configurando firewall...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 5000/tcp
ufw allow 5001/tcp
echo "y" | ufw enable

echo -e "${GREEN}✓ Firewall configurado${NC}"

# ====================================================
# 7. Configurar base de datos
# ====================================================
echo -e "${YELLOW}[7/10] Configurando base de datos...${NC}"

read -p "Ingresa contraseña para MySQL user 'gigantya_user': " -s DB_PASSWORD
echo

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS restaurante_pedidos_gigantya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gigantya_user'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON restaurante_pedidos_gigantya.* TO 'gigantya_user'@'localhost';
FLUSH PRIVILEGES;
EOF

echo -e "${GREEN}✓ Base de datos configurada${NC}"

# ====================================================
# 8. Instalar PM2
# ====================================================
echo -e "${YELLOW}[8/10] Instalando PM2...${NC}"
npm install -g pm2

echo -e "${GREEN}✓ PM2 instalado${NC}"

# ====================================================
# 9. Crear directorio del proyecto
# ====================================================
echo -e "${YELLOW}[9/10] Creando directorio del proyecto...${NC}"

mkdir -p /var/www/gigantya
cd /var/www/gigantya

# Si hay un repositorio Git, clonarlo
read -p "¿URL del repositorio Git? (dejar vacío si no): " GIT_URL

if [ ! -z "$GIT_URL" ]; then
  git clone $GIT_URL .
  echo -e "${GREEN}✓ Repositorio clonado${NC}"
else
  echo -e "${YELLOW}⚠️  Sin repositorio. Deberás copiar los archivos manualmente.${NC}"
fi

echo -e "${GREEN}✓ Directorio creado${NC}"

# ====================================================
# 10. Configurar servicios
# ====================================================
echo -e "${YELLOW}[10/10] Configurando servicios...${NC}"

# Crear archivo .env para el backend
cat > /var/www/gigantya/server/.env <<EOF
# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=gigantya_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=restaurante_pedidos_gigantya

# Servidor
NODE_ENV=production
PORT=5000

# JWT - CAMBIAR EN PRODUCCIÓN
JWT_SECRET=\$(openssl rand -base64 32)
JWT_EXPIRE=7d

# Socket.IO
SOCKET_PORT=5001

# CORS - CAMBIAR POR TU DOMINIO
CORS_ORIGIN=*

# Email
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=GigantYA <noreply@gigantya.com>

# Frontend URL - CAMBIAR POR TU DOMINIO
FRONTEND_URL=http://localhost:5173
EOF

echo -e "${GREEN}✓ Archivo .env creado${NC}"

# Instalar dependencias del backend
if [ -d "/var/www/gigantya/server" ]; then
  cd /var/www/gigantya/server
  npm install --production
  echo -e "${GREEN}✓ Dependencias del backend instaladas${NC}"
fi

# Instalar dependencias y compilar frontend
if [ -d "/var/www/gigantya/client" ]; then
  cd /var/www/gigantya/client
  npm install
  npm run build
  echo -e "${GREEN}✓ Frontend compilado${NC}"
fi

# ====================================================
# Crear configuración Nginx
# ====================================================
echo -e "${YELLOW}Creando configuración de Nginx...${NC}"

read -p "Ingresa tu dominio (ej: gigantya.com, dejar vacío para usar IP): " DOMAIN

if [ -z "$DOMAIN" ]; then
  DOMAIN=$(hostname -I | awk '{print $1}')
fi

cat > /etc/nginx/sites-available/gigantya <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend
    location / {
        root /var/www/gigantya/client/dist;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/gigantya /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx

echo -e "${GREEN}✓ Nginx configurado${NC}"

# ====================================================
# Iniciar servicios con PM2
# ====================================================
echo -e "${YELLOW}Iniciando servicios...${NC}"

cd /var/www/gigantya/server
pm2 start src/server.js --name gigantya-api
pm2 save
pm2 startup | tail -1 | bash -x

echo -e "${GREEN}✓ Servicios iniciados${NC}"

# ====================================================
# Resumen final
# ====================================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ ¡Instalación completada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n📍 Directorio del proyecto: /var/www/gigantya"
echo -e "🌐 Tu aplicación está disponible en: http://$DOMAIN"
echo -e "\n${YELLOW}Próximos pasos:${NC}"
echo -e "1. Configurar SSL: certbot --nginx -d $DOMAIN"
echo -e "2. Editar /var/www/gigantya/server/.env con tus credenciales de email"
echo -e "3. Actualizar CORS_ORIGIN y FRONTEND_URL en .env"
echo -e "4. Aplicar migrations: mysql -u gigantya_user -p < database/migrations/*.sql"
echo -e "\n${YELLOW}Comandos útiles:${NC}"
echo -e "  pm2 logs gigantya-api     # Ver logs del backend"
echo -e "  pm2 monit                 # Monitor en tiempo real"
echo -e "  systemctl status nginx    # Estado de Nginx"
echo -e "\n"
