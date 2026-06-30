/**
 * Migración: tercer nicho "Comida rápida".
 *
 * Esta migración agrega el flag `es_comida_rapida` a `restaurantes` y
 * extiende el enum `tipo_negocio` de `categorias` con el valor
 * 'comida_rapida'. Es el tercer nicho del producto, igual que mercado.
 *
 * Cambios:
 *   1. `restaurantes.es_comida_rapida TINYINT(1) NOT NULL DEFAULT 0`
 *      - Identifica a los locales cuyo tipo de negocio es comida rápida
 *        (hamburgueserías, pizzerías al paso, perros calientes, etc.).
 *      - Default 0 → los locales existentes NO son comida rápida. El
 *        admin los marca manualmente desde el dashboard con el toggle
 *        que esta migración habilita.
 *
 *   2. `categorias.tipo_negocio` ahora acepta
 *      ('restaurante', 'mercado', 'comida_rapida').
 *      - El valor 'restaurante' sigue siendo el default histórico.
 *      - Las filas existentes NO se tocan: el ALTER COLUMN respeta el
 *        default 'restaurante' y convierte enum viejo (2 valores) a
 *        enum nuevo (3 valores) sin perder datos.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo `20260629000002_add_es_mercado_abarrotes_to_restaurantes.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'es_comida_rapida', (table) => {
    table.boolean('es_comida_rapida').notNullable().defaultTo(false);
  });

  await extendCategoriaTipoNegocio(knex);
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, agrega la
 * columna ejecutando el callback recibido (que declara la columna sobre `table`).
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

/**
 * Extiende el enum `categorias.tipo_negocio` para incluir 'comida_rapida'
 * si el enum actual todavía no lo acepta.
 *
 * Estrategia:
 *   - Leemos el tipo de columna actual con SHOW COLUMNS.
 *   - Si el string 'comida_rapida' ya está en la definición del ENUM, no-op.
 *   - Si falta, hacemos ALTER COLUMN con la lista completa.
 *
 * Importante: NO usar knex.schema.enum() porque al pasarle un nuevo array
 * genera `MODIFY COLUMN tipo_negocio ENUM(...)` solo si el tipo cambia.
 * Pero si la migración se re-ejecuta y el enum ya está extendido, knex
 * puede lanzar error de tipo inalterado. Hacemos el chequeo manual para
 * garantizar idempotencia al 100%.
 */
async function extendCategoriaTipoNegocio(knex) {
  const hasTable = await knex.schema.hasTable('categorias');
  if (!hasTable) return;

  const columns = await knex.raw(`SHOW COLUMNS FROM categorias LIKE 'tipo_negocio'`);
  const rows = columns[0] || [];
  if (rows.length === 0) return;

  const currentType = rows[0].Type || '';
  // El tipo viene como `enum('restaurante','mercado','comida_rapida')` —
  // si 'comida_rapida' ya está en la definición, nada que hacer.
  if (currentType.includes('comida_rapida')) return;

  await knex.raw(
    `ALTER TABLE categorias MODIFY COLUMN tipo_negocio
       ENUM('restaurante','mercado','comida_rapida')
       NOT NULL DEFAULT 'restaurante'`
  );
}

export async function down(knex) {
  if (await knex.schema.hasTable('restaurantes')) {
    await dropColumnIfExists(knex, 'restaurantes', 'es_comida_rapida');
  }

  // Revertir enum: las filas con tipo_negocio='comida_rapida' se
  // convertirían al default 'restaurante' — aceptable para un down
  // (significa perder la marcación del nicho).
  if (await knex.schema.hasTable('categorias')) {
    const columns = await knex.raw(`SHOW COLUMNS FROM categorias LIKE 'tipo_negocio'`);
    const rows = columns[0] || [];
    if (rows.length > 0 && !rows[0].Type.includes('comida_rapida')) {
      await knex.raw(
        `ALTER TABLE categorias MODIFY COLUMN tipo_negocio
           ENUM('restaurante','mercado')
           NOT NULL DEFAULT 'restaurante'`
      );
    }
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}