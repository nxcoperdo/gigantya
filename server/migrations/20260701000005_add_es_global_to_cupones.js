/**
 * Migración: cupones pueden ser GLOBALES (de plataforma) o de un local.
 *
 * ¿Para qué sirve?
 *   Hoy la tabla `cupones` exige `restaurante_id` y filtra por él en
 *   `validateCoupon` (server/src/models/Coupon.js). El admin no tiene
 *   forma de crear cupones que apliquen a toda la plataforma.
 *
 *   Cambios:
 *     1. `restaurante_id` pasa a ser NULLable.
 *     2. Se elimina la FK a `restaurantes.id` (que tenía ON DELETE CASCADE).
 *        La invariante "es_global=1 ⇔ restaurante_id IS NULL" se enforce
 *        en código Y con un CHECK constraint a nivel DB (MySQL 8.0.16+).
 *     3. Nueva columna `es_global TINYINT(1) NOT NULL DEFAULT 0`.
 *     4. Índice sobre `es_global` para los listados/filtros de admin.
 *     5. CHECK constraint: garantiza que la fila no quede en estado
 *        inconsistente (es_global=1 con restaurante_id o es_global=0
 *        con restaurante_id NULL).
 *
 *   El UNIQUE(restaurante_id, codigo) existente sigue igual: MySQL
 *   permite múltiples NULLs en columnas UNIQUE, así que un cupón
 *   global con restaurante_id=NULL y N cupones de local con el
 *   mismo `codigo` conviven sin colisión.
 *
 *   La unicidad ENTRE globales (no puede haber dos globales con el
 *   mismo código) se enforce en código dentro de `Coupon.createCoupon`.
 *
 * Compatibilidad:
 *   - Columnas nuevas o cambios NULL-safe: no rompen datos existentes.
 *   - Patrón idempotente con `hasColumn` y guards (estilo del resto).
 *   - Para `restaurante_id` nullable usamos un guard que verifica
 *     `IS_NULLABLE = 'YES'` en INFORMATION_SCHEMA (knex.schema no
 *     expone `.nullable(false)` para columnas ya existentes, así
 *     que tenemos que hacerlo vía SQL crudo).
 *
 * Trade-off documentado:
 *   Al sacar la FK con ON DELETE CASCADE, ya no se borran cupones
 *   automáticamente al borrar un local. Se debe agregar manualmente
 *   en `Restaurant.deleteRestaurant` (ver server/src/models/Restaurant.js):
 *     DELETE FROM cupones WHERE restaurante_id = ? AND es_global = 0;
 *   Si eso no se hace, quedan filas "huérfanas" con restaurante_id
 *   apuntando a un restaurante borrado. El CHECK constraint no las
 *   rechaza (es_global=0, restaurante_id=13) hasta que alguien intente
 *   usarlas — el JOIN en `validateCoupon` simplemente no las matchea.
 *   Es un degradado aceptable; la limpieza la hace el modelo.
 */

import knexLib from 'knex';

export async function up(knex) {
  const hasTable = await knex.schema.hasTable('cupones');
  if (!hasTable) return;

  // 1) Hacer restaurante_id NULLable (sin FK, decisión documentada arriba).
  //    Primero dropeamos la FK, después la modificamos a NULL. Hacerlo en
  //    ese orden es importante: si la columna sigue siendo NOT NULL, la
  //    sentencia de drop FK puede ser rechazada por el motor en algunas
  //    versiones de MySQL cuando hay inconsistencia entre el constraint
  //    y los rows.
  await dropForeignKeyIfExists(knex, 'cupones', 'cupones_ibfk_1');
  // Backup: en MySQL la FK también puede llamarse 'cupones_restaurante_id_foreign'
  // si fue creada con Knex en otro momento. Intentamos ambas.
  await dropForeignKeyIfExists(knex, 'cupones', 'cupones_restaurante_id_foreign');
  // Como último recurso, dropeamos cualquier FK que apunte a `restaurantes`.
  await dropForeignKeysToTable(knex, 'cupones', 'restaurantes');

  await makeColumnNullable(knex, 'cupones', 'restaurante_id');

  // 2) Columna es_global
  await ensureColumn(knex, 'cupones', 'es_global', (table) => {
    table.boolean('es_global').notNullable().defaultTo(0);
  });

  // 3) Índice sobre es_global
  await ensureIndex(knex, 'cupones', 'idx_es_global', ['es_global']);

  // 4) CHECK constraint: invariante lógico.
  //    MySQL 8.0.16+ enforza CHECK. Si la versión es menor, la sentencia
  //    falla con error; por eso usamos try/catch y seguimos.
  //    En producción asumimos MySQL 8.x (ver deploy-vps-checklist.md).
  try {
    await knex.raw(`
      ALTER TABLE cupones
      ADD CONSTRAINT chk_cupones_es_global_coherente
      CHECK (
        (es_global = 0 AND restaurante_id IS NOT NULL)
        OR
        (es_global = 1 AND restaurante_id IS NULL)
      )
    `);
  } catch (error) {
    // Si la versión de MySQL no soporta CHECK (pre-8.0.16) o el
    // constraint ya existe, logueamos y seguimos. La invariante
    // sigue cubriéndose en código (Coupon.createCoupon / updateCoupon).
    console.warn(
      '[20260701000005_add_es_global_to_cupones] No se pudo crear el CHECK constraint:',
      error.message
    );
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('cupones')) {
    // Quitar CHECK
    try {
      await knex.raw(`
        ALTER TABLE cupones
        DROP CONSTRAINT chk_cupones_es_global_coherente
      `);
    } catch (_) {
      // Si no existe, ignorar.
    }

    // Quitar índice
    try {
      await knex.schema.alterTable('cupones', (table) => {
        table.dropIndex(['es_global'], 'idx_es_global');
      });
    } catch (_) {
      // Si no existe, ignorar.
    }

    // Quitar columna
    const hasColumn = await knex.schema.hasColumn('cupones', 'es_global');
    if (hasColumn) {
      await knex.schema.alterTable('cupones', (table) => {
        table.dropColumn('es_global');
      });
    }

    // Restaurar NOT NULL y FK
    // Primero: poblar NULLs (no debería haber ninguno por el CHECK, pero
    // por si la migración corrió sin el CHECK o se metieron datos a mano).
    await knex.raw(`
      UPDATE cupones
      SET restaurante_id = 0
      WHERE restaurante_id IS NULL
    `);
    // Nota: id=0 NO existe (AUTO_INCREMENT empieza en 1), pero la fila
    // queda "huérfana". Si se llega a ejecutar este down, es porque
    // estamos volviendo atrás una decisión de producto, no de datos.

    await knex.raw(`
      ALTER TABLE cupones
      MODIFY COLUMN restaurante_id INT NOT NULL
    `);

    // Restaurar FK
    try {
      await knex.raw(`
        ALTER TABLE cupones
        ADD CONSTRAINT cupones_ibfk_1
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE
      `);
    } catch (error) {
      console.warn(
        '[20260701000005_add_es_global_to_cupones.down] No se pudo restaurar la FK:',
        error.message
      );
    }
  }
}

// =============================================================
// Helpers
// =============================================================

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, la agrega.
 * Mismo estilo que las otras migraciones del proyecto.
 */
async function ensureColumn(knex, tableName, columnName, declare) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    declare(table);
  });
}

/**
 * Helper idempotente: crea un índice si no existe.
 * Knex no expone un "createIndexIfNotExists" de forma estable, así que
 * consultamos INFORMATION_SCHEMA. Si el índice ya está, no hacemos nada.
 */
async function ensureIndex(knex, tableName, indexName, columns) {
  const dbName = knex.client.database();
  const rows = await knex.raw(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [dbName, tableName, indexName]
  );
  // mysql2 devuelve un array con [rows, fields]. Tomamos el primer elemento.
  const existing = Array.isArray(rows) ? rows[0] : rows;
  if (existing && existing.length > 0) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.index(columns, indexName);
  });
}

/**
 * Drop foreign key por nombre, si existe. No-op si no está.
 */
async function dropForeignKeyIfExists(knex, tableName, fkName) {
  const dbName = knex.client.database();
  const rows = await knex.raw(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ?
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
     LIMIT 1`,
    [dbName, tableName, fkName]
  );
  const existing = Array.isArray(rows) ? rows[0] : rows;
  if (!existing || existing.length === 0) return;

  // knex.schema.alterTable con dropForeign acepta un array con el nombre.
  await knex.schema.alterTable(tableName, (table) => {
    table.dropForeign([fkName.replace(/^.*_/, '').replace(/_foreign$/, '')], fkName);
  });
}

/**
 * Drop todas las foreign keys de la tabla que apunten a `targetTable`.
 * Útil como red de seguridad: si el nombre exacto de la FK cambió entre
 * deploys (Knex a veces genera nombres distintos), queremos dropear la
 * constraint sí o sí para poder modificar la columna.
 */
async function dropForeignKeysToTable(knex, tableName, targetTable) {
  const dbName = knex.client.database();
  const rows = await knex.raw(
    `SELECT CONSTRAINT_NAME, COLUMN_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE CONSTRAINT_SCHEMA = ?
       AND TABLE_NAME = ?
       AND REFERENCED_TABLE_NAME = ?
       AND REFERENCED_COLUMN_NAME IS NOT NULL`,
    [dbName, tableName, targetTable]
  );
  const list = Array.isArray(rows) ? rows[0] : rows;
  if (!list || list.length === 0) return;

  for (const row of list) {
    const fkName = row.CONSTRAINT_NAME;
    try {
      // Usamos SQL crudo para evitar inconsistencias con el
      // generador de nombres de Knex.
      await knex.raw(`
        ALTER TABLE \`${tableName}\`
        DROP FOREIGN KEY \`${fkName}\`
      `);
    } catch (err) {
      console.warn(
        `[20260701000005] No se pudo dropear FK ${fkName}:`,
        err.message
      );
    }
  }
}

/**
 * Helper: cambia una columna a NULLable si todavía no lo es.
 * Knex.schema no expone `.nullable()` para columnas existentes, así
 * que vamos por INFORMATION_SCHEMA + ALTER directo.
 */
async function makeColumnNullable(knex, tableName, columnName) {
  const dbName = knex.client.database();
  const rows = await knex.raw(
    `SELECT IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, tableName, columnName]
  );
  const list = Array.isArray(rows) ? rows[0] : rows;
  if (!list || list.length === 0) return;
  if (list[0].IS_NULLABLE === 'YES') return;

  // Inferir el tipo de la columna para preservarlo. Si no lo podemos
  // inferir, usamos INT NULL como fallback (la columna es restaurante_id).
  // Para mantenerlo simple y a salvo, leemos COLUMN_TYPE.
  const typeRows = await knex.raw(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, tableName, columnName]
  );
  const typeList = Array.isArray(typeRows) ? typeRows[0] : typeRows;
  const columnType = typeList[0]?.COLUMN_TYPE || 'INT';

  await knex.raw(`
    ALTER TABLE \`${tableName}\`
    MODIFY COLUMN \`${columnName}\` ${columnType} NULL
  `);
}
