-- =====================================================================
-- ALTER manual: tablas `pagos` y `cajas_sesiones` (Fase 5)
-- =====================================================================
--
-- Contexto:
--   La migración Knex `20260801000005_cash_register_and_pagos.js` hace
--   lo mismo que este script. Este SQL queda para el VPS donde las
--   migraciones se aplican a mano (ver [[deploy-vps-checklist]]).
--
-- Crea:
--   - pagos: cada cargo aplicado a un pedido. Un pedido puede tener
--     VARIAS filas (pago mixto).
--   - cajas_sesiones: una "apertura" de caja. Mientras estado='abierta',
--     el cajero puede cobrar referenciándola.
--
-- Notas de tipos:
--   - `usuarios.id` es INT (sin UNSIGNED), por lo que las FKs hacia
--     usuarios (pagos.recibido_por, cajas_sesiones.usuario_id) son
--     INT. `pedidos.id` es INT, pero `pedidos.id` está declarado como
--     `INT UNSIGNED` en la BD (revisar con SHOW CREATE TABLE). Si NO
--     es UNSIGNED, ajustar la columna abajo.
--   - `restaurantes.id` y `mesas.id` son `INT UNSIGNED`, por eso
--     pagos.restaurante_id, pagos.caja_sesion_id, cajas_sesiones.
--     restaurante_id son `INT UNSIGNED`.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase5_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

SET @db = DATABASE();

-- ========== Tabla `pagos` ==========
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = @db AND table_name = 'pagos'
);
SET @sql := IF(@tbl_exists = 0,
  'CREATE TABLE pagos (
    id INT NOT NULL AUTO_INCREMENT,
    pedido_id INT UNSIGNED NOT NULL,
    restaurante_id INT UNSIGNED NOT NULL,
    metodo VARCHAR(20) NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    propina DECIMAL(10, 2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10, 2) NOT NULL DEFAULT 0,
    referencia_externa VARCHAR(100) NULL,
    recibido_por INT NULL,
    caja_sesion_id INT UNSIGNED NULL,
    items_pagados_json JSON NULL,
    creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pagos_pedido (pedido_id),
    KEY idx_pagos_rest_fecha (restaurante_id, creado_en),
    CONSTRAINT fk_pagos_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pagos_rest FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    CONSTRAINT fk_pagos_user FOREIGN KEY (recibido_por) REFERENCES usuarios(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT "pagos ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK fk_pagos_caja_sesion se agrega DESPUÉS de crear cajas_sesiones.

-- ========== Tabla `cajas_sesiones` ==========
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = @db AND table_name = 'cajas_sesiones'
);
SET @sql := IF(@tbl_exists = 0,
  'CREATE TABLE cajas_sesiones (
    id INT NOT NULL AUTO_INCREMENT,
    restaurante_id INT UNSIGNED NOT NULL,
    usuario_id INT NOT NULL,
    monto_apertura DECIMAL(10, 2) NOT NULL DEFAULT 0,
    monto_cierre_esperado DECIMAL(10, 2) NULL,
    monto_cierre_real DECIMAL(10, 2) NULL,
    diferencia DECIMAL(10, 2) NULL,
    desglose_billetes JSON NULL,
    notas_cierre TEXT NULL,
    abierta_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    cerrada_en TIMESTAMP NULL,
    estado VARCHAR(20) NOT NULL DEFAULT ''abierta'',
    PRIMARY KEY (id),
    KEY idx_caja_estado (restaurante_id, estado),
    KEY idx_caja_user_estado (usuario_id, estado),
    CONSTRAINT fk_caja_rest FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    CONSTRAINT fk_caja_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT "cajas_sesiones ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== FK pagos.caja_sesion_id → cajas_sesiones.id ==========
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
   WHERE constraint_schema = @db AND table_name = 'pagos' AND constraint_name = 'fk_pagos_caja_sesion'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE pagos ADD CONSTRAINT fk_pagos_caja_sesion FOREIGN KEY (caja_sesion_id) REFERENCES cajas_sesiones(id) ON DELETE SET NULL',
  'SELECT "fk_pagos_caja_sesion ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Verificación post-cambio (descomentar si querés ver el resultado):
-- =====================================================================
-- SHOW CREATE TABLE pagos;
-- SHOW CREATE TABLE cajas_sesiones;
--
-- SELECT table_name, table_rows
--   FROM information_schema.tables
--  WHERE table_schema = @db AND table_name IN ('pagos','cajas_sesiones');
