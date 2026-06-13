#!/bin/bash

# ====================================================
# Script para aplicar migraciones de base de datos
# ====================================================
# Uso: bash apply-migrations.sh
# ====================================================

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔧 Aplicando migraciones de base de datos...${NC}\n"

# Leer credenciales del .env si existe
if [ -f "server/.env" ]; then
  export $(grep "^DB_" server/.env | xargs)
fi

# Pedir credenciales si no están en .env
if [ -z "$DB_USER" ]; then
  read -p "Usuario de MySQL: " DB_USER
fi

if [ -z "$DB_PASSWORD" ]; then
  read -sp "Contraseña de MySQL: " DB_PASSWORD
  echo
fi

if [ -z "$DB_NAME" ]; then
  read -p "Nombre de la base de datos: " DB_NAME
fi

export DB_PASSWORD

# Directorio de migraciones
MIGRATIONS_DIR="database/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}❌ Directorio de migraciones no encontrado: $MIGRATIONS_DIR${NC}"
  exit 1
fi

# Aplicar schema principal primero
echo -e "${YELLOW}[1/2] Aplicando schema principal...${NC}"

if [ -f "database/schema.sql" ]; then
  mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/schema.sql
  echo -e "${GREEN}✓ Schema principal aplicado${NC}"
else
  echo -e "${YELLOW}⚠️  No se encontró database/schema.sql, saltando...${NC}"
fi

# Aplicar migraciones en orden
echo -e "${YELLOW}[2/2] Aplicando migraciones...${NC}"

for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$migration")
  echo -e "  → Aplicando: $filename"

  mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$migration"

  echo -e "${GREEN}    ✓ Completado${NC}"
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ ¡Migraciones aplicadas exitosamente!${NC}"
echo -e "${GREEN}========================================${NC}"

# Verificar tablas creadas
echo -e "\n${YELLOW}Tablas en la base de datos:${NC}"
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;"

echo -e "\n${YELLOW}Estado de password_reset_tokens:${NC}"
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE password_reset_tokens;" 2>/dev/null && echo "✓ Tabla existe" || echo "⚠️  Tabla no existe"
