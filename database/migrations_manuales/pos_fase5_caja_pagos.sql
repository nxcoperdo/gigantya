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
--   Las FKs hacia pedidos.id / restaurantes.id / usuarios.id heredan
--   exactamente el tipo (INT o INT UNSIGNED) de la tabla origen, así
--   este script funciona tanto si el destino tiene las PKs firmadas
--   como no. Lo autodetectamos en runtime con information_schema.
--
-- Antes de correr: dump de seguridad.
--   sudo mysqldump restaurante_pedidos_gigantya \
--     --single-transaction --quick --lock-tables=false \
--     > /tmp/backup_pre_fase5_$(date +%Y%m%d_%H%M%S).sql
--
-- =====================================================================

-- La BD puede venir de -D o del prompt actual. Si @db quedó NULL (caso
-- `SOURCE` desde cliente interactivo sin BD seleccionada) lo inferimos
-- del schema actual; si tampoco hay schema, fallamos con mensaje claro.
SET @db := DATABASE();
SET @db := COALESCE(@db, SCHEMA());
SET @db := COALESCE(@db, (SELECT SCHEMA_NAME FROM information_schema.schemata WHERE DEFAULT_CHARACTER_SET_NAME IS NOT NULL LIMIT 1));

-- Si @db sigue NULL, no hay nada que hacer (el DBA debe conectar a una BD).
SET @sql := IF(@db IS NULL,
  'SELECT "ERROR: ninguna base de datos seleccionada. Usá `USE restaurante_pedidos_gigantya` o conectá con -D restaurante_pedidos_gigantya" AS msg',
  'SELECT "OK: target database detected" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Detección dinámica de tipos. CAST explícito para evitar el error
-- "Illegal mix of collations" cuando la BD y information_schema usan
-- collations distintos. NULLIF por si la tabla no existe todavía.
SET @t_pedido_id := (
  SELECT COLUMN_TYPE FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'pedidos' AND column_name = 'id'
);
SET @t_rest_id := (
  SELECT COLUMN_TYPE FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'restaurantes' AND column_name = 'id'
);
SET @t_user_id := (
  SELECT COLUMN_TYPE FROM information_schema.columns
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'usuarios' AND column_name = 'id'
);
-- cajas_sesiones la creamos nosotros: su PK es INT no UNSIGNED, y como
-- las FKs hacia ella vienen solo desde pagos.caja_sesion_id, dejamos
-- ese campo también como INT no UNSIGNED para evitar mismatches futuros.
SET @t_caja_id := 'INT';

-- Si falta alguna tabla origen, fallamos con mensaje claro en vez de
-- armar CREATE TABLE con campos NULL que rompe la sintaxis.
SET @sql := IF(@t_pedido_id IS NULL OR @t_rest_id IS NULL OR @t_user_id IS NULL,
  CONCAT('SELECT "ERROR: tablas origen faltantes. Detectados: pedido_id=', IFNULL(@t_pedido_id,'NULL'),
         ' restaurante_id=', IFNULL(@t_rest_id,'NULL'),
         ' usuario_id=', IFNULL(@t_user_id,'NULL'),
         '. Verificá que pedidos/restaurantes/usuarios existan en ', IFNULL(@db,'NULL'), '" AS msg'),
  'SELECT "OK: source column types detected" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Tabla `pagos` ==========
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'pagos'
);
SET @sql := IF(@tbl_exists = 0,
  CONCAT(
    'CREATE TABLE pagos (
      id INT NOT NULL AUTO_INCREMENT,
      pedido_id ', @t_pedido_id, ' NOT NULL,
      restaurante_id ', @t_rest_id, ' NOT NULL,
      metodo VARCHAR(20) NOT NULL,
      monto DECIMAL(10, 2) NOT NULL,
      propina DECIMAL(10, 2) NOT NULL DEFAULT 0,
      descuento DECIMAL(10, 2) NOT NULL DEFAULT 0,
      referencia_externa VARCHAR(100) NULL,
      recibido_por ', @t_user_id, ' NULL,
      caja_sesion_id ', @t_caja_id, ' NULL,
      items_pagados_json JSON NULL,
      creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pagos_pedido (pedido_id),
      KEY idx_pagos_rest_fecha (restaurante_id, creado_en),
      CONSTRAINT fk_pagos_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      CONSTRAINT fk_pagos_rest FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
      CONSTRAINT fk_pagos_user FOREIGN KEY (recibido_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  ),
  'SELECT "pagos ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Tabla `cajas_sesiones` ==========
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'cajas_sesiones'
);
SET @sql := IF(@tbl_exists = 0,
  CONCAT(
    'CREATE TABLE cajas_sesiones (
      id INT NOT NULL AUTO_INCREMENT,
      restaurante_id ', @t_rest_id, ' NOT NULL,
      usuario_id ', @t_user_id, ' NOT NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  ),
  'SELECT "cajas_sesiones ya existe" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== FK pagos.caja_sesion_id → cajas_sesiones.id ==========
-- La creamos separada porque al definir pagos aún no existía cajas_sesiones.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
   WHERE constraint_schema = CAST(@db AS CHAR CHARACTER SET utf8mb4)
     AND table_name = 'pagos' AND constraint_name = 'fk_pagos_caja_sesion'
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
--  WHERE table_schema = DATABASE() AND table_name IN ('pagos','cajas_sesiones');
