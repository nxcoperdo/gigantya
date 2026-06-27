/**
 * Migración: agregar columna `max_compra` a la tabla `cupones`.
 *
 * ¿Para qué sirve?
 *   Complementa `min_compra` (que ya existía) para que el restaurante pueda
 *   definir un rango de monto válido para usar el cupón:
 *     - min_compra = 30.000  → cupón aplica solo si el pedido es ≥ $30.000
 *     - max_compra = 80.000  → cupón aplica solo si el pedido es ≤ $80.000
 *
 *   Si `max_compra` es NULL, no hay tope superior (es lo que ya pasaba con
 *   `min_compra` NULL = "sin mínimo").
 *
 * Compatibilidad:
 *   - Columna NULL-able para no romper cupones existentes.
 *   - Patrón idempotente con `hasColumn` (siguiendo el estilo del resto de
 *     las migraciones del proyecto).
 */
export async function up(knex) {
  await ensureColumn(knex, 'cupones', 'max_compra', (table) => {
    table.decimal('max_compra', 10, 2).nullable();
  });
}

export async function down(knex) {
  if (await knex.schema.hasTable('cupones')) {
    const hasColumn = await knex.schema.hasColumn('cupones', 'max_compra');
    if (hasColumn) {
      await knex.schema.alterTable('cupones', (table) => {
        table.dropColumn('max_compra');
      });
    }
  }
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, la agrega.
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