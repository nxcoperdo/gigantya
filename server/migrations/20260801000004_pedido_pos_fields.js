/**
 * Migración POS Fase 3: campos para pedidos tomados desde el POS.
 *
 * Esta migración agrega 5 columnas a `pedidos`:
 *
 *   - `es_retiro_local`     BOOLEAN  (default 0) — persistencia histórica
 *                           de la modalidad "retira en mostrador". El
 *                           código ya la referencia en `Order.js:585`, pero
 *                           la columna nunca se aplicó en esta BD (las
 *                           migraciones de julio 2026 quedaron registradas
 *                           en `knex_migrations` pero no impactaron la BD).
 *                           Re-asegurar la columna aquí no rompe nada si ya
 *                           existe.
 *
 *   - `es_consumo_en_local` BOOLEAN  (default 0) — misma idea que arriba
 *                           para la modalidad "comer en la mesa". El código
 *                           también la referencia en `Order.js:586`.
 *
 *   - `mesa_id`             INT NULL  — FK a `mesas.id`. NULL para pedidos
 *                           a domicilio/recoger que no ocupan mesa.
 *                           `ON DELETE SET NULL` para no perder pedidos
 *                           históricos si el dueño elimina una mesa
 *                           (soft-delete ya la preserva, pero por si
 *                           alguien la borra físicamente).
 *
 *   - `canal`               VARCHAR(20) NOT NULL DEFAULT 'web' —
 *                           'web' para el flujo del cliente,
 *                           'pos' para el flujo del Punto de Venta
 *                           (cajero/mesero/cocina),
 *                           'kiosko' reservado para futuro.
 *                           Útil para reportes y para filtrar el KDS
 *                           (cocina solo ve pedidos `canal='pos'`).
 *
 *   - `creado_por`          INT NULL  — FK a `usuarios.id`. Para pedidos
 *                           del cliente, queda NULL (es el cliente
 *                           quien lo pide). Para pedidos POS, es el id
 *                           del staff que lo creó (mesero, cajero, etc.).
 *                           `ON DELETE SET NULL` para no perder
 *                           auditoría si el staff se desvincula.
 *
 * Todas las FKs respetan la convención del proyecto:
 * `restaurantes.id` es INT (NO UNSIGNED), por lo que las columnas FK
 * tampoco son `unsigned()`. Ver `20260801000001` para más detalles.
 *
 * Patrón idempotente: usa `ensureColumn` y `hasColumn` para que re-ejecutar
 * la migración no falle. La verificación previa al commit
 * (`scripts/verify-pos-fase3.js`) lee information_schema para confirmar.
 */
export async function up(knex) {
  // 1) es_retiro_local — re-aplicar por si la migración previa quedó
  // registrada en knex_migrations sin impactar la BD.
  await ensureColumn(knex, 'pedidos', 'es_retiro_local', (table) => {
    table.boolean('es_retiro_local').notNullable().defaultTo(false);
  });

  // 2) es_consumo_en_local — idem.
  await ensureColumn(knex, 'pedidos', 'es_consumo_en_local', (table) => {
    table.boolean('es_consumo_en_local').notNullable().defaultTo(false);
  });

  // 3) mesa_id — FK a mesas. Nullable: solo los pedidos POS de mesa
  // la setean. Los pedidos web/recoger/domicilio quedan en NULL.
  await ensureColumn(knex, 'pedidos', 'mesa_id', (table) => {
    table.integer('mesa_id').unsigned().nullable();
  });
  await ensureForeign(knex, 'pedidos', 'mesa_id', 'fk_pedidos_mesa', {
    references: 'mesas.id',
    onDelete: 'SET NULL',
  });
  await ensureIndex(knex, 'pedidos', 'mesa_id', 'idx_pedidos_mesa');

  // 4) canal — 'web' por default para todos los pedidos preexistentes
  // (asume que el flujo del cliente es web). Pedidos nuevos del POS
  // lo setan en 'pos'.
  await ensureColumn(knex, 'pedidos', 'canal', (table) => {
    table.string('canal', 20).notNullable().defaultTo('web');
  });
  await ensureIndex(knex, 'pedidos', 'canal', 'idx_pedidos_canal');

  // 5) creado_por — usuario staff que creó el pedido. NULL para clientes.
  // IMPORTANTE: NO `unsigned()` porque `usuarios.id` es INT (no UNSIGNED).
  // MySQL rechaza FKs entre columnas de tipos incompatibles — mismo gotcha
  // que el fix-up 20260801000002_fix_usuarios_restaurante_fk.js.
  // Si esta columna se creó como UNSIGNED en un intento previo (porque
  // un fix-up no había sido publicado todavía), el fix-up
  // 20260801000005_fix_pedido_creado_por_unsigned.js la recrea limpia.
  await ensureColumn(knex, 'pedidos', 'creado_por', (table) => {
    table.integer('creado_por').nullable();
  });
  await ensureForeign(knex, 'pedidos', 'creado_por', 'fk_pedidos_creador', {
    references: 'usuarios.id',
    onDelete: 'SET NULL',
  });
  await ensureIndex(knex, 'pedidos', 'creado_por', 'idx_pedidos_creador');

  // 6) FIX de bug preexistente: `items_pedido.especificaciones` es referenciada
  // por `Order.js:644` (note del item, tipo "sin cebolla") y por el render del
  // ticket, pero NUNCA fue creada en la BD. La migración inicial 20260607000001
  // creó `items_pedido` sin esa columna. La migración 20260708000001 la
  // documenta como "ya existía" pero no la crea. Resultado: cualquier pedido
  // nuevo del cliente web FALLA con `Unknown column 'especificaciones'`.
  // Aquí la creamos idempotentemente.
  await ensureColumn(knex, 'items_pedido', 'especificaciones', (table) => {
    table.text('especificaciones').nullable();
  });
}

export async function down(knex) {
  // El `down` deja la BD en el estado pre-Fase-3. NO dropeamos
  // `es_retiro_local` ni `es_consumo_en_local` porque son columnas que
  // ya estaban pensadas en migraciones previas; si llegamos hasta aquí
  // es porque esas migraciones no impactaron la BD, así que dropearlas
  // podría romper código que ya las usa. Dejamos esas 2 columnas y
  // solo revertimos lo nuevo de Fase 3.
  if (!(await knex.schema.hasTable('pedidos'))) return;

  // 1) Drop FKs e índices (idempotente vía information_schema).
  await dropIndexIfExists(knex, 'pedidos', 'idx_pedidos_creador');
  await dropIndexIfExists(knex, 'pedidos', 'idx_pedidos_canal');
  await dropIndexIfExists(knex, 'pedidos', 'idx_pedidos_mesa');
  await dropForeignIfExists(knex, 'pedidos', 'fk_pedidos_creador');
  await dropForeignIfExists(knex, 'pedidos', 'fk_pedidos_mesa');

  // 2) Drop columnas nuevas.
  await dropColumnIfExists(knex, 'pedidos', 'creado_por');
  await dropColumnIfExists(knex, 'pedidos', 'canal');
  await dropColumnIfExists(knex, 'pedidos', 'mesa_id');
  // `especificaciones` en items_pedido la dropeamos también: fue un fix
  // de bug preexistente, no de Fase 3. Si en el futuro alguien quiere
  // restaurarla, puede volver a ejecutar la migración.
  await dropColumnIfExists(knex, 'items_pedido', 'especificaciones');
}

// ========== Helpers idempotentes ==========

async function ensureColumn(knex, tableName, columnName, declare) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    declare(table);
  });
}

async function ensureIndex(knex, tableName, columnName, indexName) {
  const [rows] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1`,
    [tableName, indexName]
  );
  if (rows && rows.length > 0) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.index(columnName, indexName);
  });
}

async function ensureForeign(knex, tableName, columnName, constraintName, opts) {
  // knex.raw devuelve la estructura nativa de mysql2: [rows, fields].
  const [rows] = await knex.raw(
    `SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = ?
      LIMIT 1`,
    [tableName, constraintName]
  );
  if (rows && rows.length > 0) return;
  // Knex Schema API: table.foreign(column, name).references('col').inTable('table')
  // `opts.references` ya viene como 'tabla.columna' (ej: 'mesas.id'); partimos.
  const [refTable, refColumn] = opts.references.split('.');
  await knex.schema.alterTable(tableName, (table) => {
    table
      .foreign(columnName, constraintName)
      .references(refColumn)
      .inTable(refTable)
      .onDelete(opts.onDelete || 'RESTRICT');
  });
}

async function dropForeignIfExists(knex, tableName, constraintName) {
  // MySQL 8 no soporta DROP FOREIGN KEY IF EXISTS en una sola sentencia;
  // vamos 1 query con guard en information_schema (mismo patrón que
  // 20260801000002_fix_usuarios_restaurante_fk.js).
  const [rows] = await knex.raw(
    `SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = ?
      LIMIT 1`,
    [tableName, constraintName]
  );
  if (!rows || rows.length === 0) return;
  await knex.raw(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
}

async function dropIndexIfExists(knex, tableName, indexName) {
  const [rows] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1`,
    [tableName, indexName]
  );
  if (!rows || rows.length === 0) return;
  await knex.raw(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
