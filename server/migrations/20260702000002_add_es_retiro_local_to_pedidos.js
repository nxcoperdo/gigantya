/**
 * Migración: agregar campo `es_retiro_local` a la tabla `pedidos`.
 *
 * ¿Para qué sirve?
 *   Hoy la modalidad del pedido (envío a domicilio vs. retiro en mostrador)
 *   se deduce en tiempo real del flag `restaurantes.ofrece_domicilio`. Esto
 *   tiene un problema: si un local cambia su flag después de tomar un
 *   pedido, el dashboard del local pierde la noción de que ese pedido fue
 *   un retiro (porque el flag actual dice "sí hace domicilios").
 *
 *   Esta columna guarda de forma inmutable la modalidad con la que se
 *   creó cada pedido. La columna la escribe el modelo `createOrderWithItems`
 *   a partir del flag del local al momento de crear el pedido; después no
 *   se actualiza.
 *
 *   El dashboard del local usa esta columna para mostrar la etiqueta
 *   "Retira en local" en pedidos históricos incluso si el local luego
 *   cambió a ofrecer domicilios.
 *
 * Default:
 *   - `0` (NOT NULL DEFAULT 0) → pedidos preexistentes sin info quedan
 *     como envío a domicilio, que es lo más conservador (coincide con el
 *     comportamiento histórico: antes de esta feature no existían retiros).
 *
 * Patrón idempotente: igual que
 * 20260629000001_add_ofrece_domicilio_to_restaurantes.js.
 */
export async function up(knex) {
  await ensureColumn(knex, 'pedidos', 'es_retiro_local', (table) => {
    table.boolean('es_retiro_local').notNullable().defaultTo(false);
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
    await dropColumnIfExists(knex, 'pedidos', 'es_retiro_local');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
