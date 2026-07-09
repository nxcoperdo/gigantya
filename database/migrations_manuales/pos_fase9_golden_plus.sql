-- =====================================================================
-- ALTER manual: Fase 9 POS — Plan Golden Plus (ensanchar `plan`)
-- =====================================================================
--
-- Contexto:
--   La migración Knex `20260904000001_golden_plus_plan_column.js`
--   hace lo mismo que este script. Este SQL queda para el VPS donde
--   las migraciones se aplican a mano (ver [[deploy-vps-checklist]]).
--
-- Cambios:
--   A) restaurantes.plan     VARCHAR(20) → VARCHAR(30) (es NULLABLE)
--   B) suscripciones.plan    VARCHAR(50) → VARCHAR(50)  (no requiere cambio
--                                       en realidad, pero lo dejamos
--                                       ensanchado por consistencia)
--
--   'golden_plus' mide 11 chars y entra en VARCHAR(20) actual, pero
--   ensanchar previene futuros planes con nombres largos
--   (ej. 'premium_plus', 'enterprise'). La columna es VARCHAR libre
--   validada en código (ver `PLANES` en `utils/planFeatures.js`),
--   por eso NO hace falta cambiar el tipo a ENUM.
--
-- Convenciones de tipo:
--   - restaurantes.plan     es NULLABLE, DEFAULT 'basico'
--   - suscripciones.plan    es NOT NULL,  DEFAULT 'basico'
--   - El MODIFY preserva IS_NULLABLE y DEFAULT — no los toca.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase9_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db := DATABASE();
SET @db := COALESCE(@db, SCHEMA());
SET @db := COALESCE(@db, (SELECT SCHEMA_NAME FROM information_schema.schemata WHERE DEFAULT_CHARACTER_SET_NAME IS NOT NULL LIMIT 1));

SET @sql := IF(@db IS NULL,
  'SELECT "ERROR: ninguna base de datos seleccionada. Usá `USE restaurante_pedidos_gigantya` o conectá con -D restaurante_pedidos_gigantya" AS msg',
  'SELECT "OK: target database detected" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t_restaurantes_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'restaurantes'
);
SET @t_suscripciones_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'suscripciones'
);

-- ========== A) restaurantes.plan ==========
SET @col_a_len := (
  SELECT IFNULL(CHARACTER_MAXIMUM_LENGTH, 0)
    FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'restaurantes'
     AND column_name = 'plan'
);
SET @col_a_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'restaurantes'
     AND column_name = 'plan'
);
SET @sql := IF(@t_restaurantes_exists = 0,
  'SELECT "skip A: tabla restaurantes no existe" AS msg',
  IF(@col_a_exists = 0,
    'SELECT "skip A: columna restaurantes.plan no existe" AS msg',
    IF(@col_a_len >= 30,
      CONCAT('SELECT "A) restaurantes.plan ya es VARCHAR(', @col_a_len, '), skip" AS msg'),
      'ALTER TABLE `restaurantes` MODIFY COLUMN `plan` VARCHAR(30) DEFAULT ''basico'''
    )
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== B) suscripciones.plan ==========
-- suscripciones.plan ya es VARCHAR(50), así que este bloque es
-- defensivo: si por alguna razón alguien la bajó a <30, la restauramos.
SET @col_b_len := (
  SELECT IFNULL(CHARACTER_MAXIMUM_LENGTH, 0)
    FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'suscripciones'
     AND column_name = 'plan'
);
SET @col_b_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'suscripciones'
     AND column_name = 'plan'
);
SET @sql := IF(@t_suscripciones_exists = 0,
  'SELECT "skip B: tabla suscripciones no existe" AS msg',
  IF(@col_b_exists = 0,
    'SELECT "skip B: columna suscripciones.plan no existe" AS msg',
    IF(@col_b_len >= 30,
      CONCAT('SELECT "B) suscripciones.plan ya es VARCHAR(', @col_b_len, '), skip" AS msg'),
      'ALTER TABLE `suscripciones` MODIFY COLUMN `plan` VARCHAR(30) NOT NULL DEFAULT ''basico'''
    )
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Fase 9 POS aplicada (o ya existente)' AS msg;
