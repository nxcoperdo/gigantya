/**
 * Migración POS Fase 8: split bill / transfer / merge + config POS.
 *
 * Tres cambios (todos idempotentes con `ensureColumn` / `ensureForeign`):
 *
 *   A) `pedidos.transferido_de_mesa_id` — INT UNSIGNED NULL con FK a
 *      `mesas.id` ON DELETE SET NULL. Para que un pedido transferido
 *      de mesa A → mesa B conserve la huella de origen. NULL significa
 *      "no fue transferido" (la mayoría de los pedidos).
 *
 *   B) `pedidos.estado_pago` — ENUM('impago','parcial','pagado') NOT
 *      NULL DEFAULT 'impago'. Para el flujo de split bill: un pedido
 *      puede estar cobrado parcialmente, y solo cuando se paga completo
 *      pasa a 'Entregado' y libera la mesa. El default 'impago' es
 *      retro-compatible con pedidos ya cobrados (los que están en
 *      'Entregado' se interpretan como efectivamente pagados).
 *
 *   C) `restaurantes.configuracion_pos` — JSON NULL con shape
 *      documentado en la memoria [[gigantya-pos-mvp]] y en el
 *      service `posConfigService`. Decisión: JSON en `restaurantes`
 *      (mismo patrón que `configuracion_impuestos` / `configuracion_envios`)
 *      en vez de una tabla `restaurante_config` aparte.
 *
 * Convenciones de tipo (importantes — ver [[gigantya-pos-mvp]]):
 *   - `mesas.id` es `INT UNSIGNED`, por eso `transferido_de_mesa_id`
 *     también debe ser UNSIGNED (match exacto con la FK).
 *   - `restaurantes.id` es `INT` (signed) — no aplica aquí pero está
 *     documentado para próximas migraciones.
 *
 * Patrón idempotente: cada cambio verifica existencia vía
 * `information_schema.*` y los helpers del proyecto (ensureColumn /
 * ensureForeign). La verificación previa al commit se hace con el
 * test E2E `test-pos-e2e.mjs` step 13-15.
 */
export async function up(knex) {
  // ========== A) pedidos.transferido_de_mesa_id ==========
  await ensureColumn(knex, 'pedidos', 'transferido_de_mesa_id', (table) => {
    // UNSIGNED para matchear `mesas.id` (INT UNSIGNED).
    table.integer('transferido_de_mesa_id').unsigned().nullable();
  });
  // FK por separado (ensureColumn no maneja FKs). El nombre sigue
  // la convención fk_<tabla>_<columna>.
  await ensureForeign(knex, 'pedidos', 'transferido_de_mesa_id', 'fk_pedidos_transferido_de_mesa', {
    references: 'mesas.id',
    onDelete: 'SET NULL',
  });

  // ========== B) pedidos.estado_pago ==========
  await ensureColumn(knex, 'pedidos', 'estado_pago', (table) => {
    // ENUM nativo de MySQL — Knex expone `table.enu`.
    table.enu('estado_pago', ['impago', 'parcial', 'pagado'], {
      useNative: true,
      enumName: 'pedidos_estado_pago',
    }).notNullable().defaultTo('impago');
  });
  // Índice para acelerar el filtro "pedidos parcialmente pagados"
  // (útil en el reporte de pendientes, futuro). El nombre usa el
  // prefijo idx_ como el resto del proyecto.
  await ensureIndex(knex, 'pedidos', ['estado_pago'], 'idx_pedidos_estado_pago');

  // ========== C) restaurantes.configuracion_pos ==========
  await ensureColumn(knex, 'restaurantes', 'configuracion_pos', (table) => {
    table.json('configuracion_pos').nullable();
  });
}

export async function down(knex) {
  // Reverso (no se usa en producción, pero queda simétrico para
  // ambientes de test). El orden importa: primero FK, después columna.
  await dropForeignIfExists(knex, 'pedidos', 'fk_pedidos_transferido_de_mesa');
  await dropIndexIfExists(knex, 'pedidos', 'idx_pedidos_estado_pago');
  await dropColumnIfExists(knex, 'pedidos', 'transferido_de_mesa_id');
  await dropColumnIfExists(knex, 'pedidos', 'estado_pago');
  await dropColumnIfExists(knex, 'restaurantes', 'configuracion_pos');
}

// ========== Helpers idempotentes ==========
// (Mismos que en 20260801000004_pedido_pos_fields.js; copiados aquí
//  para que esta migración sea autocontenida y no rompa si el archivo
//  original se renombra.)

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
  const [rows] = await knex.raw(
    `SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = ?
      LIMIT 1`,
    [tableName, constraintName]
  );
  if (rows && rows.length > 0) return;
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
