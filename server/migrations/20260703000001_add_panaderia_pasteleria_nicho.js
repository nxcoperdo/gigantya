/**
 * Migración: cuarto nicho "Panadería y pastelería".
 *
 * Esta migración agrega el flag `es_panaderia_pasteleria` a `restaurantes`
 * y extiende el enum `tipo_negocio` de `categorias` con el valor
 * 'panaderia_pasteleria'. Es el cuarto nicho del producto, igual que
 * mercado y comida rápida.
 *
 * Cambios:
 *   1. `restaurantes.es_panaderia_pasteleria TINYINT(1) NOT NULL DEFAULT 0`
 *      - Identifica a los locales cuyo tipo de negocio es panadería /
 *        pastelería (panaderías, pastelerías, repostería, etc.).
 *      - Default 0 → los locales existentes NO son panaderías. El
 *        admin los marca manualmente desde el dashboard con el toggle
 *        que esta migración habilita.
 *      - El flag es combinable con `es_restaurante` y `es_comida_rapida`
 *        (un local puede ser restaurante + panadería, o comida rápida +
 *        panadería). Es mutuamente excluyente con `es_mercado_abarrotes`
 *        por convención de modelo (mercado es nicho único, los otros
 *        pueden combinar). Esta exclusión NO se enforce a nivel DB — se
 *        valida en la UI admin al activar el toggle.
 *
 *   2. `categorias.tipo_negocio` ahora acepta
 *      ('restaurante', 'mercado', 'comida_rapida', 'panaderia_pasteleria').
 *      - El valor 'restaurante' sigue siendo el default histórico.
 *      - Las filas existentes NO se tocan: el ALTER COLUMN respeta el
 *        default 'restaurante' y convierte enum viejo (3 valores) a
 *        enum nuevo (4 valores) sin perder datos.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable`
 * siguiendo `20260701000001_add_comida_rapida_nicho.js`.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'es_panaderia_pasteleria', (table) => {
    table.boolean('es_panaderia_pasteleria').notNullable().defaultTo(false);
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
 * Extiende el enum `categorias.tipo_negocio` para incluir 'panaderia_pasteleria'
 * si el enum actual todavía no lo acepta.
 *
 * Estrategia:
 *   - Leemos el tipo de columna actual con SHOW COLUMNS.
 *   - Si el string 'panaderia_pasteleria' ya está en la definición del ENUM, no-op.
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
  // El tipo viene como
  // `enum('restaurante','mercado','comida_rapida','panaderia_pasteleria')` —
  // si 'panaderia_pasteleria' ya está en la definición, nada que hacer.
  if (currentType.includes('panaderia_pasteleria')) return;

  await knex.raw(
    `ALTER TABLE categorias MODIFY COLUMN tipo_negocio
       ENUM('restaurante','mercado','comida_rapida','panaderia_pasteleria')
       NOT NULL DEFAULT 'restaurante'`
  );
}

export async function down(knex) {
  if (await knex.schema.hasTable('restaurantes')) {
    await dropColumnIfExists(knex, 'restaurantes', 'es_panaderia_pasteleria');
  }

  // Revertir enum: las filas con tipo_negocio='panaderia_pasteleria' se
  // convertirían al default 'restaurante' — aceptable para un down
  // (significa perder la marcación del nicho).
  if (await knex.schema.hasTable('categorias')) {
    const columns = await knex.raw(`SHOW COLUMNS FROM categorias LIKE 'tipo_negocio'`);
    const rows = columns[0] || [];
    if (rows.length > 0 && rows[0].Type.includes('panaderia_pasteleria')) {
      await knex.raw(
        `ALTER TABLE categorias MODIFY COLUMN tipo_negocio
           ENUM('restaurante','mercado','comida_rapida')
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
