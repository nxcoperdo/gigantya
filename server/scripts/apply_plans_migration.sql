-- ============================================================
-- gigantya · migración de planes y suscripciones
-- SQL idempotente listo para ejecutar a mano
--
-- Aplica los cambios del archivo Knex:
--   server/migrations/20260609000001_subscriptions_and_plans.js
--
-- Ejecutar con: mysql -u root restaurante_pedidos_gigantya < this.sql
-- (o desde MySQL Workbench / DBeaver, el script es seguro de correr varias veces)
-- ============================================================

-- 1. Columna `plan` en `restaurantes` (si no existe)
SET @col_plan := (SELECT COUNT(*) FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME   = 'restaurantes'
                    AND COLUMN_NAME  = 'plan');
SET @sql := IF(@col_plan = 0,
  'ALTER TABLE restaurantes ADD COLUMN plan ENUM(''basico'', ''profesional'', ''premium'') NOT NULL DEFAULT ''basico''',
  'SELECT ''plan ya existe, no se hace nada'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Columna `fecha_vencimiento_plan` en `restaurantes` (si no existe)
SET @col_fv := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'restaurantes'
                  AND COLUMN_NAME  = 'fecha_vencimiento_plan');
SET @sql := IF(@col_fv = 0,
  'ALTER TABLE restaurantes ADD COLUMN fecha_vencimiento_plan DATETIME NULL, ADD INDEX idx_plan_vencimiento (plan, fecha_vencimiento_plan)',
  'SELECT ''fecha_vencimiento_plan ya existe, no se hace nada'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Tabla `suscripciones` (si no existe)
CREATE TABLE IF NOT EXISTS suscripciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurante_id INT UNSIGNED NOT NULL,
  plan ENUM('basico', 'profesional', 'premium') NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_vencimiento DATETIME NOT NULL,
  estado ENUM('activa', 'vencida', 'cancelada') NOT NULL DEFAULT 'activa',
  monto_pagado DECIMAL(10, 2) NULL,
  metodo_pago VARCHAR(50) NULL,
  notas TEXT NULL,
  recordatorio_enviado TINYINT(1) NOT NULL DEFAULT 0,
  creado_por INT UNSIGNED NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_susc_restaurante (restaurante_id),
  INDEX idx_susc_vencimiento (fecha_vencimiento, estado),
  CONSTRAINT fk_suscripciones_restaurante
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_suscripciones_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla `producto_imagenes` (galería de fotos, si no existe)
CREATE TABLE IF NOT EXISTS producto_imagenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  imagen_url VARCHAR(255) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_img_producto (producto_id),
  CONSTRAINT fk_producto_imagenes_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Fix de la constraint UNIQUE en `cupones`:
--    de UNIQUE(codigo) global a UNIQUE(restaurante_id, codigo) por restaurante.
--    Solo si la tabla cupones existe.

SET @has_cupones := (SELECT COUNT(*) FROM information_schema.TABLES
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cupones');

-- 5a. Quitar UNIQUE global en codigo (si existe con nombre "codigo" o "codigo_unique")
SET @idx_codigo := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'cupones'
                      AND INDEX_NAME = 'codigo');
SET @sql := IF(@has_cupones > 0 AND @idx_codigo > 0,
  'ALTER TABLE cupones DROP INDEX codigo',
  'SELECT ''UNIQUE global en cupones.codigo no existe, saltando'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5b. Crear UNIQUE compuesto (si no existe)
SET @idx_comp := (SELECT COUNT(*) FROM information_schema.STATISTICS
                  WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'cupones'
                    AND INDEX_NAME = 'cupones_restaurante_id_codigo_unique');
SET @sql := IF(@has_cupones > 0 AND @idx_comp = 0,
  'ALTER TABLE cupones ADD CONSTRAINT cupones_restaurante_id_codigo_unique UNIQUE (restaurante_id, codigo)',
  'SELECT ''UNIQUE compuesto ya existe, saltando'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- Verificación final
-- ============================================================
SELECT 'Columnas en restaurantes:' AS check_name;
SHOW COLUMNS FROM restaurantes;

SELECT '' AS spacer;
SELECT 'Tabla suscripciones:' AS check_name;
SHOW TABLES LIKE 'suscripciones';

SELECT '' AS spacer;
SELECT 'Tabla producto_imagenes:' AS check_name;
SHOW TABLES LIKE 'producto_imagenes';

SELECT '' AS spacer;
SELECT 'Índices de cupones:' AS check_name;
SHOW INDEX FROM cupones;
