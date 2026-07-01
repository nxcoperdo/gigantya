/**
 * Migración: crea la tabla `direcciones` (libreta de direcciones del usuario).
 *
 * Contexto:
 * La tabla `direcciones` existía en la DB de producción (creada a mano o
 * por un schema.sql antiguo) y es referenciada por:
 *   - server/src/models/Address.js (CRUD + queries de selección)
 *   - server/migrations/20260618000001_sectores_y_barrios.js
 *     (agrega direcciones.barrio_id)
 *   - server/migrations/20260628000001_add_google_maps_columns.js
 *     (agrega latitud/longitud/direccion_formateada/place_id con
 *      ensureColumn — todas ellas idempotentes con hasTable guard)
 *
 * Cuando el commit 154abe8 cambió CI para correr las migraciones Knex
 * desde cero, esta tabla dejó de existir y la migration 1800001 rompió
 * con ER_NO_SUCH_TABLE al intentar `alterTable('direcciones', ...)`.
 *
 * Solución: una migration nueva con timestamp ANTERIOR a la 1800001
 * (20260617000001) que cree la tabla con la estructura completa que el
 * modelo y las migrations posteriores esperan. No toco la inicial ni
 * las otras migrations para mantener el principio de no modificar nada
 * que ya funciona.
 *
 * Columnas: espejo exacto del modelo Address.js más las columnas que
 * las migrations 1800001 y 2800001 agregan (incluidas desde el inicio
 * para que la DB quede completa en una sola pasada).
 *
 * Idempotente: si la tabla ya existe (caso raro: creada a mano en
 * algunas DBs de dev), no la tocamos.
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('direcciones');
  if (hasTable) return;

  await knex.schema.createTable('direcciones', (table) => {
    table.increments('id').primary();
    table.integer('usuario_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    table.string('tipo', 20).defaultTo('residencia');
    table.string('direccion', 255).notNullable();
    table.string('ciudad', 100).defaultTo('Gigante, Huila');
    table.string('telefono', 20);
    table.text('notas');
    table.boolean('es_default').defaultTo(false);
    // barrio_id se llena en la migration 1800001 con FK a barrios.
    // Acá lo creamos sin FK (la 1800001 la agrega) porque la tabla
    // `barrios` no existe todavía al correr esta migration. El
    // allowNull es suficiente para que el modelo funcione antes de
    // que sectores/barrios estén poblados.
    table.integer('barrio_id').unsigned().nullable();
    table.decimal('latitud', 10, 7).nullable();
    table.decimal('longitud', 10, 7).nullable();
    table.string('direccion_formateada', 500).nullable();
    table.string('place_id', 255).nullable();
    table.timestamp('creado_en').defaultTo(knex.fn.now());

    table.index('usuario_id', 'idx_direcciones_usuario');
    table.index('es_default', 'idx_direcciones_es_default');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('direcciones');
}
