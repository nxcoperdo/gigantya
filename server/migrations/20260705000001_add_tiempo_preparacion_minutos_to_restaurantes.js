/**
 * Migración: agregar campo `tiempo_preparacion_minutos` a la tabla `restaurantes`.
 *
 * ¿Para qué sirve?
 *   Permite que cada local declare cuánto tarda aproximadamente en preparar
 *   un pedido. El valor (en minutos) se muestra en el header de
 *   `RestaurantDetailsPage` para que el cliente sepa qué esperar antes de pedir.
 *
 * Default:
 *   - `NULL` (columna nullable, sin default) → los locales existentes arrancan
 *     sin tiempo configurado, y por convención de UI (ver plan) el header no
 *     muestra el bloque cuando el valor es NULL. Cada local lo setea desde
 *     "Editar datos del local" en su dashboard.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo el patrón de `20260629000001_add_ofrece_domicilio_to_restaurantes.js`
 * y `20260628000001_add_google_maps_columns.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'tiempo_preparacion_minutos', (table) => {
    table.integer('tiempo_preparacion_minutos').unsigned().nullable();
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
    await dropColumnIfExists(knex, 'restaurantes', 'tiempo_preparacion_minutos');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
