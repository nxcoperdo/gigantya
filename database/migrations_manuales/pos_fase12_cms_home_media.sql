-- =====================================================================
-- CREATE TABLE manual: Fase 12 — CMS de banner de Home (tabla `home_media`)
-- =====================================================================
--
-- Contexto:
--   La migración Knex `20260710000001_cms_home_media.js` hace lo mismo
--   que este script. Este SQL queda para el VPS donde las migraciones
--   se aplican a mano (ver [[deploy-vps-checklist]]).
--
-- Crea la tabla `home_media`:
--   El super-admin de GigantYA (rol `usuarios.tipo_usuario='admin'`)
--   puede subir varios archivos (imagen o video) a un "gestor de
--   banners de la home". Elige UNO como activo; la home pública
--   (`/`) lee el activo y lo muestra en el hero.
--
-- Columnas:
--   - id              PK
--   - nombre          VARCHAR(150) — nombre humano que le pone el admin
--   - archivo_path    VARCHAR(255) — relativo a /uploads/ (ej:
--                                     'home-media/upload-abc123.mp4')
--   - tipo            ENUM('imagen','video') — derivado del MIME
--   - mime            VARCHAR(50)
--   - size_bytes      INT UNSIGNED
--   - activo          TINYINT(1) — 1 = visible en la home. Por
--                     convención del controller solo puede haber 1
--                     activo a la vez (transaccional en setActivo).
--   - subido_por      FK a usuarios.id (sin UNSIGNED en este proyecto,
--                     ver migración de Fase 5)
--   - creado_en       TIMESTAMP default CURRENT_TIMESTAMP
--
-- Notas:
--   - ON DELETE RESTRICT en subido_por: si quisieran borrar un admin
--     que subió banners, hay que borrarlos primero. Defensivo.
--   - No agrego UNIQUE sobre activo porque MySQL no soporta
--     `UNIQUE WHERE`. El controller lo garantiza transaccionalmente.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase12_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db := DATABASE();
SET @db := COALESCE(@db, SCHEMA());
SET @db := COALESCE(@db, (SELECT SCHEMA_NAME FROM information_schema.schemata WHERE DEFAULT_CHARACTER_SET_NAME IS NOT NULL LIMIT 1));

SET @sql := IF(@db IS NULL,
  'SELECT "ERROR: ninguna base de datos seleccionada. Usá `USE restaurante_pedidos_gigantya` o conectá con -D restaurante_pedidos_gigantya" AS msg',
  'SELECT "OK: target database detected" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Detección dinámica del tipo de `usuarios.id` (en este proyecto es
-- INT sin UNSIGNED, ver migración Knex de Fase 5). NULLIF por si la
-- tabla `usuarios` no existe todavía.
SET @t_user_id := (
  SELECT COLUMN_TYPE FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'usuarios' AND column_name = 'id'
);

SET @sql := IF(@t_user_id IS NULL,
  CONCAT('SELECT "ERROR: tabla `usuarios` no existe en ', IFNULL(@db,'NULL'), '. ¿Fases previas aplicadas?" AS msg'),
  'SELECT "OK: usuarios.id detectado" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Tabla `home_media` ==========
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'home_media'
);
SET @sql := IF(@tbl_exists = 0,
  CONCAT(
    'CREATE TABLE home_media (
      id INT NOT NULL AUTO_INCREMENT,
      nombre VARCHAR(150) NOT NULL,
      archivo_path VARCHAR(255) NOT NULL,
      tipo ENUM(''imagen'',''video'') NOT NULL,
      mime VARCHAR(50) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 0,
      subido_por ', @t_user_id, ' NOT NULL,
      creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_home_media_activo (activo),
      KEY idx_home_media_creado (creado_en),
      CONSTRAINT fk_home_media_user FOREIGN KEY (subido_por) REFERENCES usuarios(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  ),
  'SELECT "home_media ya existe, skip" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Verificación post-cambio (descomentar si querés ver el resultado):
-- =====================================================================
-- DESCRIBE home_media;
-- SHOW CREATE TABLE home_media;

SELECT 'Fase 12 — CMS Home Media aplicada (o ya existente)' AS msg;
