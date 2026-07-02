#!/bin/bash
# ==========================================================
# 🩺 HEALTH CHECK - GIGANTYA
# ==========================================================
# Verifica que todos los servicios estén corriendo.
# Uso: ssh root@2.25.75.94 'bash /var/www/gigantya/health-check.sh'
# O guardalo en el server como ejecutable y corrélo cuando quieras.
# ==========================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }

echo "🩺 Estado de GigantYA - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. PM2 (backend)
echo ""
echo "Backend (PM2):"
PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -oE '"status":\s*"[^"]+"' | head -1 | grep -oE '"[^"]+"$' | tr -d '"')
if [ "$PM2_STATUS" = "online" ]; then
  PM2_MEM=$(pm2 jlist 2>/dev/null | grep -oE '"memory":\s*[0-9]+' | head -1 | grep -oE '[0-9]+$')
  PM2_MEM_MB=$((PM2_MEM / 1024 / 1024))
  ok "gigantya-api está online (${PM2_MEM_MB}MB RAM)"
elif [ -z "$PM2_STATUS" ]; then
  warn "No se pudo leer el estado de PM2 (puede haber un bug en el script)"
else
  fail "gigantya-api NO está corriendo (status: $PM2_STATUS)"
fi

# 2. MySQL
echo ""
echo "Base de datos (MySQL):"
if sudo systemctl is-active --quiet mysql; then
  USER_COUNT=$(mysql -u gigantya_user -pgigantya123456 restaurante_pedidos_gigantya -sN -e "SELECT COUNT(*) FROM usuarios;" 2>/dev/null)
  if [ -n "$USER_COUNT" ]; then
    ok "MySQL activo, $USER_COUNT usuario(s) en la base"
  else
    warn "MySQL activo pero no se pudo contar usuarios (¿password cambió?)"
  fi
else
  fail "MySQL NO está corriendo"
fi

# 3. Nginx
echo ""
echo "Web server (Nginx):"
if sudo systemctl is-active --quiet nginx; then
  ok "Nginx activo"
else
  fail "Nginx NO está corriendo"
fi

# 4. SSL (certificado)
echo ""
echo "Certificado SSL:"
CERT_DAYS=$(sudo certbot certificates 2>/dev/null | grep -A 2 "gigantya.com" | grep "VALID" | grep -oE '[0-9]+ days' | head -1 | grep -oE '[0-9]+')
if [ -n "$CERT_DAYS" ]; then
  if [ "$CERT_DAYS" -gt 14 ]; then
    ok "Válido por $CERT_DAYS días más"
  else
    warn "Válido por $CERT_DAYS días - RENOVAR PRONTO"
  fi
else
  fail "No se pudo verificar el certificado"
fi

# 5. Health check de la API
echo ""
echo "API health check:"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://gigantya.com/api/health)
if [ "$HEALTH" = "200" ]; then
  ok "API respondiendo 200 OK en https://gigantya.com/api/health"
else
  fail "API NO responde (HTTP $HEALTH)"
fi

# 6. Disco
echo ""
echo "Disco:"
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
  ok "Uso de disco: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
  warn "Uso de disco: ${DISK_USAGE}% - revisar"
else
  fail "Disco casi lleno: ${DISK_USAGE}%"
fi

# 7. Memoria
echo ""
echo "Memoria RAM:"
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [ "$MEM_PCT" -lt 80 ]; then
  ok "RAM: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
elif [ "$MEM_PCT" -lt 90 ]; then
  warn "RAM: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
else
  fail "RAM casi llena: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
fi

echo ""
echo "=========================================="
echo "Listo. Para más detalles: pm2 logs gigantya-api"
