-- =====================================================================
-- ALTER manual: campos POS en `pedidos` + fix `items_pedido.especificaciones`
-- =====================================================================
--
-- Contexto:
--   La migración Knex `20260801000004_pedido_pos_fields.js` hace lo mismo
--   que este script. Este SQL queda para el VPS donde las migraciones
--   se aplican a mano (ver [[deploy-vps-checklist]]).
--
-- Cambios (idempotente con guards en information_schema):
--   pedidos:
--     + es_retiro_local TINYINT(1) NOT NULL DEFAULT 0
--     + es_consumo_en_local TINYINT(1) NOT NULL DEFAULT 0
--     + mesa_id INT UNSIGNED NULL   (FK a mesas.id)
--     + canal VARCHAR(20) NOT NULL DEFAULT 'web'
--     + creado_por INT NULL         (FK a usuarios.id — INT, no UNSIGNED)
--   items_pedido:
--     + especificaciones TEXT NULL   (fix de bug preexistente)
--
-- Índices:
--   - idx_pedidos_mesa
--   - idx_pedidos_canal
--   - idx_pedidos_creador
--
-- FKs:
--   - fk_pedidos_mesa     (mesa_id → mesas.id, ON DELETE SET NULL)
--   - fk_pedidos_creador  (creado_por → usuarios.id, ON DELETE SET NULL)
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase3_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db = DATABASE();

-- ========== 1) pedidos.es_retiro_local ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'es_retiro_local'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN es_retiro_local TINYINT(1) NOT NULL DEFAULT 0 AFTER estado',
  'SELECT "es_retiro_local ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 2) pedidos.es_consumo_en_local ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'es_consumo_en_local'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN es_consumo_en_local TINYINT(1) NOT NULL DEFAULT 0 AFTER es_retiro_local',
  'SELECT "es_consumo_en_local ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 3) pedidos.mesa_id (FK a mesas.id) ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'mesa_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN mesa_id INT UNSIGNED NULL AFTER es_consumo_en_local',
  'SELECT "mesa_id ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 4) pedidos.canal ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'canal'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN canal VARCHAR(20) NOT NULL DEFAULT ''web'' AFTER mesa_id',
  'SELECT "canal ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 5) pedidos.creado_por (FK a usuarios.id — INT, no UNSIGNED) ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'creado_por'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN creado_por INT NULL AFTER canal',
  'SELECT "creado_por ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FIX: si creado_por fue creado por error como UNSIGNED, pasarlo a INT.
-- (MySQL requiere recrear la columna para cambiar UNSIGNED; el MODIFY
--  in-place NO funciona para UNSIGNED ↔ signed.)
SET @is_unsigned := (
  SELECT IF(column_type LIKE '%unsigned%', 1, 0) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'pedidos' AND column_name = 'creado_por'
);
SET @sql := IF(@is_unsigned = 1,
  'ALTER TABLE pedidos MODIFY COLUMN creado_por INT NULL',
  'SELECT "creado_por ya es INT (signed)" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 6) items_pedido.especificaciones (fix bug preexistente) ==========
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'items_pedido' AND column_name = 'especificaciones'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE items_pedido ADD COLUMN especificaciones TEXT NULL',
  'SELECT "especificaciones ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Índices ==========
-- idx_pedidos_mesa
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'pedidos' AND index_name = 'idx_pedidos_mesa'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE pedidos ADD INDEX idx_pedidos_mesa (mesa_id)',
  'SELECT "idx_pedidos_mesa ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_pedidos_canal
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'pedidos' AND index_name = 'idx_pedidos_canal'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE pedidos ADD INDEX idx_pedidos_canal (canal)',
  'SELECT "idx_pedidos_canal ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_pedidos_creador
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'pedidos' AND index_name = 'idx_pedidos_creador'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE pedidos ADD INDEX idx_pedidos_creador (creado_por)',
  'SELECT "idx_pedidos_creador ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Foreign keys ==========
-- fk_pedidos_mesa (depende de que la tabla mesas exista — creada en Fase 2)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
   WHERE constraint_schema = @db AND table_name = 'pedidos' AND constraint_name = 'fk_pedidos_mesa'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id) ON DELETE SET NULL',
  'SELECT "fk_pedidos_mesa ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fk_pedidos_creador
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
   WHERE constraint_schema = @db AND table_name = 'pedidos' AND constraint_name = 'fk_pedidos_creador'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_creador FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL',
  'SELECT "fk_pedidos_creador ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Verificación post-cambio (descomentar si querés ver el resultado):
-- =====================================================================
-- SHOW CREATE TABLE pedidos;
-- SHOW CREATE TABLE items_pedido;
--
-- SELECT column_name, column_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = @db AND table_name = 'pedidos'
--    AND column_name IN ('es_retiro_local','es_consumo_en_local','mesa_id','canal','creado_por')
--  ORDER BY ordinal_position;
--
-- SELECT column_name, column_type
--   FROM information_schema.columns
--  WHERE table_schema = @db AND table_name = 'items_pedido'
--    AND column_name = 'especificaciones';
