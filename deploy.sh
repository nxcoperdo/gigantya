#!/bin/bash
# ==========================================================
# 🚀 SCRIPT DE DEPLOY - GIGANTYA
# ==========================================================
# Uso: ./deploy.sh
# Ubicación: /var/www/gigantya/deploy.sh
# ==========================================================

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando deploy de Gigantya...${NC}"
echo ""

# Configuración
APP_DIR="/var/www/gigantya"
BACKUP_DIR="/var/backups/gigantya/deploys"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"

# 1. Backup del .env actual
echo -e "${YELLOW}📦 [1/7] Backup de .env actual...${NC}"
if [ -f "$APP_DIR/server/.env" ]; then
    cp "$APP_DIR/server/.env" "$BACKUP_DIR/env_backup_$TIMESTAMP"
    echo -e "${GREEN}   ✅ Backup guardado: $BACKUP_DIR/env_backup_$TIMESTAMP${NC}"
else
    echo -e "${YELLOW}   ⚠️  No se encontró .env, saltando backup${NC}"
fi

# 2. Pull de últimos cambios
echo -e "${YELLOW}📥 [2/7] Descargando últimos cambios...${NC}"
cd "$APP_DIR"
if [ -d ".git" ]; then
    git pull origin main
    echo -e "${GREEN}   ✅ Cambios descargados${NC}"
else
    echo -e "${RED}   ❌ No es un repositorio git${NC}"
    exit 1
fi

# 3. Instalar dependencias del backend
echo -e "${YELLOW}📦 [3/7] Instalando dependencias del backend...${NC}"
cd "$APP_DIR/server"
npm install --production
echo -e "${GREEN}   ✅ Dependencias backend instaladas${NC}"

# 4. Restaurar .env si se respaldó
if [ -f "$BACKUP_DIR/env_backup_$TIMESTAMP" ]; then
    cp "$BACKUP_DIR/env_backup_$TIMESTAMP" "$APP_DIR/server/.env"
    echo -e "${GREEN}   ✅ .env restaurado${NC}"
fi

# 5. Build del frontend
echo -e "${YELLOW}🏗️  [4/7] Compilando frontend...${NC}"
cd "$APP_DIR/client"

# Verificar si existe .env, si no copiar de .env.production
if [ ! -f ".env" ] && [ -f ".env.production" ]; then
    cp .env.production .env
    echo -e "${YELLOW}   ⚠️  .env creado desde .env.production${NC}"
fi

npm install
npm run build
echo -e "${GREEN}   ✅ Frontend compilado${NC}"

# 6. Reiniciar backend con PM2
echo -e "${YELLOW}🔄 [5/7] Reiniciando backend...${NC}"
cd "$APP_DIR/server"
if pm2 list | grep -q "gigantya-api"; then
    pm2 reload gigantya-api
    echo -e "${GREEN}   ✅ Backend reiniciado (reload sin downtime)${NC}"
else
    pm2 start ecosystem.config.cjs --env production
    pm2 save
    echo -e "${GREEN}   ✅ Backend iniciado${NC}"
fi

# 7. Verificar salud
echo -e "${YELLOW}🏥 [6/7] Verificando salud del servidor...${NC}"
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}   ✅ Servidor saludable (HTTP $HEALTH)${NC}"
else
    echo -e "${RED}   ❌ Servidor no responde (HTTP $HEALTH)${NC}"
    echo -e "${YELLOW}   Revisar logs: pm2 logs gigantya-api${NC}"
fi

# 8. Recargar nginx (para que sirva los nuevos assets)
echo -e "${YELLOW}🔄 [7/7] Recargando nginx...${NC}"
if command -v nginx &> /dev/null; then
    sudo nginx -t && sudo systemctl reload nginx
    echo -e "${GREEN}   ✅ Nginx recargado${NC}"
fi

# Limpiar backups antiguos (mantener últimos 10)
echo -e "${YELLOW}🧹 Limpiando backups antiguos...${NC}"
ls -t $BACKUP_DIR/env_backup_* 2>/dev/null | tail -n +11 | xargs -r rm
echo -e "${GREEN}   ✅ Backups antiguos eliminados${NC}"

echo ""
echo -e "${GREEN}✅ DEPLOY COMPLETADO EXITOSAMENTE${NC}"
echo ""
echo "📊 Ver logs en tiempo real:  pm2 logs gigantya-api"
echo "📊 Monitorear:                pm2 monit"
echo "📊 Estado:                    pm2 status"
