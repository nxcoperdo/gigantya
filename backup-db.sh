#!/bin/bash
# ==========================================================
# 💾 SCRIPT DE BACKUP DE BASE DE DATOS - GIGANTYA
# ==========================================================
# Uso: ./backup-db.sh
# Cron: 0 3 * * * /var/www/gigantya/backup-db.sh
# Ubicación: /var/www/gigantya/backup-db.sh
# ==========================================================

set -e

# Configuración (leer del .env del server)
APP_DIR="/var/www/gigantya"
BACKUP_DIR="/var/backups/gigantya/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=7

# Crear directorio
mkdir -p "$BACKUP_DIR"

# Cargar variables de .env
if [ -f "$APP_DIR/server/.env" ]; then
    source <(grep -E '^DB_' "$APP_DIR/server/.env" | sed 's/^/export /')
else
    echo "❌ No se encontró .env en $APP_DIR/server"
    exit 1
fi

# Verificar variables
if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Variables DB_USER o DB_NAME no definidas"
    exit 1
fi

echo "💾 Iniciando backup de base de datos..."
echo "   DB: $DB_NAME"
echo "   Usuario: $DB_USER"
echo "   Destino: $BACKUP_FILE"

# Hacer backup comprimido
if mysqldump -u "$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --quick \
    --lock-tables=false \
    "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then

    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completado: $BACKUP_FILE ($SIZE)"
else
    echo "❌ Error al hacer backup"
    exit 1
fi

# Eliminar backups antiguos
DELETED=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "🧹 $DELETED backups antiguos eliminados (>$RETENTION_DAYS días)"
fi

# Verificar espacio en disco
DISK_USAGE=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  ALERTA: Disco al ${DISK_USAGE}% de capacidad"
fi

echo "✅ Proceso de backup finalizado"
