-- =====================================================================
-- Fase 12b — Migración home_media: archivo_path → archivo
-- =====================================================================
--
-- Contexto:
--   Cambio de diseño: en lugar de guardar el path completo al archivo
--   subido a server/uploads/home-media/, ahora los banners son assets
--   estáticos commiteados al repo en client/public/media/.
--   La columna `archivo_path` (relativa a /uploads/) se reemplaza por
--   `archivo` (solo el nombre del archivo, ej: 'banner2.mp4').
--   La URL pública es siempre `/media/<archivo>`.
--
-- Cambios:
--   1. Si existe `archivo_path` y NO existe `archivo`:
--        ALTER TABLE home_media ADD COLUMN archivo VARCHAR(100) NOT NULL DEFAULT '';
--   2. UPDATE: copiar el basename de archivo_path a archivo.
--        (cualquier 'home-media/upload-xxx.jpg' → 'upload-xxx.jpg')
--   3. UNIQUE constraint en `archivo` (defensivo).
--   4. DROP COLUMN archivo_path.
--
-- Idempotente: corre sin error si la columna ya fue renombrada.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase12b_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db := DATABASE();

SET @has_archivo_path := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'home_media' AND column_name = 'archivo_path'
);

SET @has_archivo := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'home_media' AND column_name = 'archivo'
);

-- =====================================================================
-- Paso 1: agregar `archivo` si no existe.
-- =====================================================================
SET @sql := IF(@has_archivo = 0 AND @has_archivo_path = 1,
  'ALTER TABLE home_media ADD COLUMN archivo VARCHAR(100) NOT NULL DEFAULT '''' AFTER nombre',
  'SELECT "archivo ya existe o archivo_path no existe, skip add" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Paso 2: copiar el basename de archivo_path a archivo para filas
-- existentes (solo las que tengan archivo_path pero archivo vacío).
-- SUBSTRING_INDEX(path, '/', -1) devuelve el último segmento después
-- de '/'. Ej: 'home-media/upload-abc.jpg' → 'upload-abc.jpg'.
-- =====================================================================
SET @sql := IF(@has_archivo_path = 1,
  'UPDATE home_media
      SET archivo = SUBSTRING_INDEX(archivo_path, ''/'', -1)
    WHERE (archivo IS NULL OR archivo = '''')
      AND archivo_path IS NOT NULL',
  'SELECT "no hay archivo_path que migrar, skip copy" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Paso 3: agregar UNIQUE KEY en `archivo` si no existe.
-- =====================================================================
SET @has_unique := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'home_media' AND index_name = 'uq_home_media_archivo'
);

SET @sql := IF(@has_unique = 0 AND @has_archivo = 1,
  'ALTER TABLE home_media ADD UNIQUE KEY uq_home_media_archivo (archivo)',
  'SELECT "uq_home_media_archivo ya existe o columna archivo no existe, skip" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Paso 4: borrar `archivo_path` si todavía existe.
-- =====================================================================
SET @sql := IF(@has_archivo_path = 1,
  'ALTER TABLE home_media DROP COLUMN archivo_path',
  'SELECT "archivo_path no existe, skip drop" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Verificación post-cambio (descomentar si querés ver el resultado):
-- =====================================================================
-- DESCRIBE home_media;

SELECT 'Fase 12b — home_media migrado a columna archivo' AS msg;
