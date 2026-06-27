/**
 * Migración: agregar campo `ofrece_domicilio` a la tabla `restaurantes`.
 *
 * ¿Para qué sirve?
 *   Permite que cada restaurante declare explícitamente si hace domicilios a
 *   domicilio o si solo opera "recoge en local". La home pública usa este
 *   campo como filtro en dos botones tipo toggle:
 *     - "Con domicilios"     → ofrece_domicilio = 1
 *     - "Solo recoge en local" → ofrece_domicilio = 0
 *
 * Default:
 *   - `TRUE` (NOT NULL DEFAULT 1) → los restaurantes existentes siguen
 *     mostrándose en el modo "Con domicilios" sin tocar datos. Los que
 *     prefieran "solo local" lo cambian desde su dashboard.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo el patrón de `20260628000001_add_google_maps_columns.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'ofrece_domicilio', (table) => {
    table.boolean('ofrece_domicilio').notNullable().defaultTo(true);
  });
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, agrega la
 * columna ejecutando el callback recibido (que declara la columna sobre `table`).
 *
 * @param {import('knex').Knex} knex
 * @param {string} tableName
 * @param {string} columnName
 * @param {(table: import('knex').CreateTableBuilder) => void} declare
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

export async function down(knex) {
  if (await knex.schema.hasTable('restaurantes')) {
    await dropColumnIfExists(knex, 'restaurantes', 'ofrece_domicilio');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
