-- =====================================================================
-- ALTER manual: Fase 10 — Modificadores configurables (obligatorio/min/max)
-- =====================================================================
--
-- Contexto:
--   La migración Knex `20260709000001_modificadores_obligatoriedad.js`
--   hace lo mismo que este script. Este SQL queda para el VPS donde
--   las migraciones se aplican a mano (ver [[deploy-vps-checklist]]).
--
-- Cambios en `producto_grupos_adiciones`:
--   A) obligatorio       TINYINT(1) NOT NULL DEFAULT 0
--   B) min_selecciones   INT       NOT NULL DEFAULT 0
--   C) max_selecciones   INT       NOT NULL DEFAULT 99
--
-- ¿Por qué?
--   Hoy los grupos de adiciones son contenedores libres (el cliente
--   elige lo que quiere o nada). Para soportar el modelo de negocios
--   real del cliente (desayunos, hamburguesas, pizzas, corrientazos),
--   los locales necesitan reglas tipo Rappi/PedidosYa:
--     - "Elige 1 opción" (obligatorio, min=1, max=1)
--     - "Puedes elegir hasta 2 opciones" (opcional, min=0, max=2)
--     - "Elige 1-2 acompañamientos" (obligatorio, min=1, max=2)
--
-- Defaults backward-compatible:
--   0 / 0 / 99 reproducen EXACTAMENTE el comportamiento anterior
--   (grupo opcional, sin mínimo, sin máximo efectivo). Cero impacto
--   en productos sin la nueva config.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase10_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db := DATABASE();
SET @db := COALESCE(@db, SCHEMA());
SET @db := COALESCE(@db, (SELECT SCHEMA_NAME FROM information_schema.schemata WHERE DEFAULT_CHARACTER_SET_NAME IS NOT NULL LIMIT 1));

SET @sql := IF(@db IS NULL,
  'SELECT "ERROR: ninguna base de datos seleccionada. Usá `USE restaurante_pedidos_gigantya` o conectá con -D restaurante_pedidos_gigantya" AS msg',
  'SELECT "OK: target database detected" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t_grupos_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'producto_grupos_adiciones'
);

-- ========== A) producto_grupos_adiciones.obligatorio ==========
SET @col_a_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'producto_grupos_adiciones'
     AND column_name = 'obligatorio'
);
SET @sql := IF(@t_grupos_exists = 0,
  'SELECT "skip A: tabla producto_grupos_adiciones no existe" AS msg',
  IF(@col_a_exists > 0,
    'SELECT "A) producto_grupos_adiciones.obligatorio ya existe, skip" AS msg',
    'ALTER TABLE `producto_grupos_adiciones` ADD COLUMN `obligatorio` TINYINT(1) NOT NULL DEFAULT 0 AFTER `activo`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== B) producto_grupos_adiciones.min_selecciones ==========
SET @col_b_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'producto_grupos_adiciones'
     AND column_name = 'min_selecciones'
);
SET @sql := IF(@t_grupos_exists = 0,
  'SELECT "skip B: tabla producto_grupos_adiciones no existe" AS msg',
  IF(@col_b_exists > 0,
    'SELECT "B) producto_grupos_adiciones.min_selecciones ya existe, skip" AS msg',
    'ALTER TABLE `producto_grupos_adiciones` ADD COLUMN `min_selecciones` INT NOT NULL DEFAULT 0 AFTER `obligatorio`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== C) producto_grupos_adiciones.max_selecciones ==========
SET @col_c_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'producto_grupos_adiciones'
     AND column_name = 'max_selecciones'
);
SET @sql := IF(@t_grupos_exists = 0,
  'SELECT "skip C: tabla producto_grupos_adiciones no existe" AS msg',
  IF(@col_c_exists > 0,
    'SELECT "C) producto_grupos_adiciones.max_selecciones ya existe, skip" AS msg',
    'ALTER TABLE `producto_grupos_adiciones` ADD COLUMN `max_selecciones` INT NOT NULL DEFAULT 99 AFTER `min_selecciones`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Fase 10 — Modificadores configurables aplicada (o ya existente)' AS msg;
