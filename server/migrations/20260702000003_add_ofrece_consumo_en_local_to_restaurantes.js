/**
 * Migración: agregar campo `ofrece_consumo_en_local` a la tabla `restaurantes`.
 *
 * ¿Para qué sirve?
 *   Permite que cada restaurante declare si acepta pedidos para consumir
 *   en el local (modalidad "comer en la mesa"). Cuando está activo, el
 *   cliente puede elegir esa opción en el checkout y la mesera lleva
 *   el pedido a la mesa cuando el local marca el pedido como Listo.
 *
 *   Es una nueva dimensión de servicio, sumable con `ofrece_domicilio`:
 *   un local puede ofrecer las 3 modalidades (envío, retiro, consumo)
 *   o solo algunas, según lo active el admin.
 *
 * Default:
 *   - `FALSE` (NOT NULL DEFAULT 0) → locales existentes NO ofrecen
 *     consumo en el local por default. El admin lo activa caso a caso
 *     desde el dashboard admin.
 *
 * Patrón idempotente: igual que
 * 20260629000001_add_ofrece_domicilio_to_restaurantes.js
 * y 20260702000001_add_es_restaurante_to_restaurantes.js.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'ofrece_consumo_en_local', (table) => {
    table.boolean('ofrece_consumo_en_local').notNullable().defaultTo(false);
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
  if (await knex.schema.hasTable('restaurantes')) {
    await dropColumnIfExists(knex, 'restaurantes', 'ofrece_consumo_en_local');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
