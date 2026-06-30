/**
 * Migración: agregar campo `tipo_negocio` a la tabla `categorias`.
 *
 * ¿Para qué sirve?
 *   Distingue dos tipos de filas en `categorias`:
 *     - 'restaurante' → categoría propia de un restaurante (comportamiento
 *       histórico; `restaurante_id` poblado).
 *     - 'mercado'     → categoría catálogo transversal a todos los locales
 *       marcados como `es_mercado_abarrotes = 1`. Estas filas tienen
 *       `restaurante_id = NULL` y se comparten entre todos los mercados.
 *
 * Default:
 *   - 'restaurante' (NOT NULL DEFAULT 'restaurante') → todas las filas
 *     existentes se mantienen como categorías de restaurante sin migración
 *     de datos.
 *
 * Notas del schema actual (verificado el 2026-06-28):
 *   - `restaurante_id` ya es NULLABLE en MySQL (atributo alterado manualmente
 *     antes de esta migración). No hace falta tocarlo.
 *   - El UNIQUE constraint es solo sobre `nombre` (`uk_restaurante_categoria`).
 *     No hace falta tocarlo.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo el patrón de `20260629000002_add_es_mercado_abarrotes_to_restaurantes.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'categorias', 'tipo_negocio', (table) => {
    table.enum('tipo_negocio', ['restaurante', 'mercado']).notNullable().defaultTo('restaurante');
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
  if (await knex.schema.hasTable('categorias')) {
    await dropColumnIfExists(knex, 'categorias', 'tipo_negocio');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}