/**
 * Migración: agregar campo `es_mercado_abarrotes` a la tabla `restaurantes`.
 *
 * ¿Para qué sirve?
 *   Identifica a los locales cuyo tipo de negocio es "mercado y abarrotes".
 *   NO es una modalidad de servicio (como `ofrece_domicilio`), es un tipo
 *   de negocio acumulable: un mercado puede ofrecer domicilio o no, en
 *   cualquier combinación con el flag `ofrece_domicilio`.
 *
 * Uso en la UI:
 *   - Home pública: tercer botón en el toggle junto a "Con domicilios" y
 *     "Solo recoge en local" → filtra por `es_mercado_abarrotes = 1`.
 *   - Dashboard admin: switch inline en la celda "Modalidad" que cambia
 *     el flag vía PUT /admin/restaurants/:id/es-mercado-abarrotes.
 *
 * Default:
 *   - `FALSE` (NOT NULL DEFAULT 0) → los restaurantes existentes NO son
 *     mercados. El admin los marca manualmente desde el dashboard.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo el patrón de `20260629000001_add_ofrece_domicilio_to_restaurantes.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'es_mercado_abarrotes', (table) => {
    table.boolean('es_mercado_abarrotes').notNullable().defaultTo(false);
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
    await dropColumnIfExists(knex, 'restaurantes', 'es_mercado_abarrotes');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}