# Migración chat Fruver — VPS Hostinger

Aplicar la migración SQL del chat cliente↔vendedor. Es idempotente: si las
tablas/columnas ya existen, las omite sin romper.

## 1. Verificar si ya está aplicada

```sql
SHOW TABLES LIKE 'conversaciones';
SHOW TABLES LIKE 'mensajes';
SHOW COLUMNS FROM pedidos LIKE 'origen';
```

Si las 3 consultas devuelven resultado (tabla/columna existe), **ya está aplicada**, saltá al paso 3.

## 2. Crear el archivo SQL en el VPS

El archivo NO está en el repo (`.gitignore` ignora `*.sql`), así que tenés que crearlo a mano. Corré este bloque en el VPS:

```bash
cat > /var/www/gigantya/database/migrations_manuales/20260719000001_chat_fruver.sql <<'MIGRATION_EOF'
CREATE TABLE IF NOT EXISTS `conversaciones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `restaurante_id` INT NOT NULL,
  `cliente_identificador` VARCHAR(190) NOT NULL COMMENT '"user:<id>" si está logueado, "anon:<hash>" si no',
  `cliente_nombre` VARCHAR(150) NULL,
  `cliente_telefono` VARCHAR(40) NULL,
  `estado` ENUM('abierta','cerrada','convertida') NOT NULL DEFAULT 'abierta',
  `pedido_id` INT NULL COMMENT 'FK a pedidos.id cuando se convierte en pedido',
  `ultimo_mensaje_en` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv_restaurante_estado` (`restaurante_id`, `estado`, `ultimo_mensaje_en`),
  KEY `idx_conv_cliente` (`restaurante_id`, `cliente_identificador`),
  CONSTRAINT `fk_conv_restaurante`
    FOREIGN KEY (`restaurante_id`) REFERENCES `restaurantes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensajes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversacion_id` INT UNSIGNED NOT NULL,
  `emisor_tipo` ENUM('cliente','vendedor','sistema') NOT NULL,
  `emisor_usuario_id` INT NULL COMMENT 'id del vendedor (NULL si emisor es cliente o sistema)',
  `contenido` TEXT NOT NULL,
  `adjuntos_json` JSON NULL COMMENT '{producto_id, nombre, precio} cuando viene del catálogo',
  `leido_en` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_conv` (`conversacion_id`, `created_at`),
  KEY `idx_msg_conv_emisor_leido` (`conversacion_id`, `emisor_tipo`, `leido_en`),
  CONSTRAINT `fk_msg_conv`
    FOREIGN KEY (`conversacion_id`) REFERENCES `conversaciones` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'origen'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `pedidos` ADD COLUMN `origen` ENUM(''web_self'',''web_asistido'',''pos'',''kiosko'') NOT NULL DEFAULT ''web_self'' AFTER `canal`',
  'SELECT ''columna pedidos.origen ya existe, no se hace nada'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversaciones'
    AND CONSTRAINT_NAME = 'fk_conv_pedido'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `conversaciones` ADD CONSTRAINT `fk_conv_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)',
  'SELECT ''fk fk_conv_pedido ya existe, no se hace nada'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
MIGRATION_EOF
```

## 3. Aplicar la migración

```bash
mysql -u gigantya_user -p restaurante_pedidos_gigantya < /var/www/gigantya/database/migrations_manuales/20260719000001_chat_fruver.sql
```

## 4. Verificar

```sql
SHOW TABLES LIKE 'conversaciones';        -- debe devolver 1 fila
SHOW TABLES LIKE 'mensajes';              -- debe devolver 1 fila
SHOW COLUMNS FROM pedidos LIKE 'origen';   -- debe mostrar la columna con default web_self
SELECT constraint_name FROM information_schema.TABLE_CONSTRAINTS
  WHERE constraint_schema = DATABASE()
    AND constraint_name IN ('fk_conv_restaurante','fk_conv_pedido','fk_msg_conv');
-- debe devolver 3 filas
```

## 5. Verificar/activar el flag del local 4

El chat solo funciona para locales con `es_mercado_abarrotes = 1`. El local 4 (fruver piloto) tiene que tener ese flag.

```sql
-- Ver estado actual
SELECT id, nombre, es_mercado_abarrotes, estado FROM restaurantes WHERE id = 4;

-- Si es_mercado_abarrotes = 0, activarlo:
UPDATE restaurantes SET es_mercado_abarrotes = 1 WHERE id = 4;

-- Verificar de nuevo
SELECT id, nombre, es_mercado_abarrotes FROM restaurantes WHERE id = 4;
```

**Esperado:** `es_mercado_abarrotes = 1`

## 6. Verificar que el chat funciona

Después de aplicar la migración y que el backend se haya reiniciado (ya hecho con el deploy), probá desde el navegador:

1. Abrí `https://gigantya.com/restaurant/4` en modo incógnito (sin login)
2. Debería aparecer el modal pidiendo nombre + teléfono
3. Llenalo, escribí un mensaje, mandalo
4. En otra pestaña, logueate como el dueño del local 4 y andá a `https://gigantya.com/dashboard/chat`
5. Debería aparecer la conversación con el mensaje que mandaste

Si el botón "Chat" no aparece en `/restaurant/4`, el local 4 no tiene `es_mercado_abarrotes = 1` (volvé al paso 5).

## 7. Si algo falla

- **"El local no está disponible para chatear"** → `UPDATE restaurantes SET es_mercado_abarrotes = 1 WHERE id = 4;`
- **"El chat solo está disponible para locales de mercado/abarrotes"** → mismo fix que arriba
- **"Unknown column 'origen'" en logs de PM2** → la migración no se aplicó. Repetir paso 3.
- **El cliente no recibe el `anon_identifier`** → asegurar que el localStorage del browser tenga `chat_identity_4` con `{nombre, telefono}`. Si está vacío, abrir el `ChatIdentityModal` lo crea automáticamente.
