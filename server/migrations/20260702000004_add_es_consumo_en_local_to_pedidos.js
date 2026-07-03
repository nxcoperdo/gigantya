/**
 * Migración: agregar campo `es_consumo_en_local` a la tabla `pedidos`.
 *
 * ¿Para qué sirve?
 *   Persistir la modalidad del pedido al momento de crearlo. Igual que
 *   `es_retiro_local`, esta columna sobrevive a cambios posteriores del
 *   flag `restaurantes.ofrece_consumo_en_local`: si un local desactiva
 *   la opción después de tomar un pedido de consumo, el dashboard sigue
 *   mostrando el badge correcto porque lee la columna del pedido, no
 *   el flag actual del local.
 *
 * Default:
 *   - `0` (NOT NULL DEFAULT 0) → pedidos preexistentes (y cualquier
 *     pedido nuevo donde el cliente no pida consumo en local) quedan
 *     como 0. Los pedidos de envío y retiro existentes no se ven
 *     afectados.
 *
 * Patrón idempotente: igual que
 * 20260702000002_add_es_retiro_local_to_pedidos.js.
 */
export async function up(knex) {
  await ensureColumn(knex, 'pedidos', 'es_consumo_en_local', (table) => {
    table.boolean('es_consumo_en_local').notNullable().defaultTo(false);
  });
}

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
  if (await knex.schema.hasTable('pedidos')) {
    await dropColumnIfExists(knex, 'pedidos', 'es_consumo_en_local');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
