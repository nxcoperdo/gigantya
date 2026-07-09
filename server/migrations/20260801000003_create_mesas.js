/**
 * Migración: tabla `mesas` para el plano del POS (Fase 2).
 *
 * Cada mesa pertenece a un restaurante y tiene coordenadas (pos_x, pos_y),
 * tamaño, forma y estado. El estado `ocupada` se setea al crear un pedido
 * POS (Fase 3) y se libera al cobrar (Fase 5).
 *
 * Decisiones:
 *   - `forma` y `estado` son strings cortos, no ENUM: el admin podría
 *     querer nuevos estados en el futuro (e.g. 'reservada_proxima') y
 *     evitar ALTER TABLE innecesarios.
 *   - `capacidad`, `pos_x/y`, `ancho/alto` son `INT` (no DECIMAL): las
 *     coordenadas son pixeles en un canvas virtual; submáscara de 1px
 *     no aporta valor y simplifica los `<Rnd>` de react-rnd.
 *   - Soft-delete: NO se borran filas; el endpoint DELETE marca
 *     `estado='mantenimiento'` y `nombre='(mesa eliminada)'` para
 *     preservar el FK de `pedidos.mesa_id` y el historial.
 *
 * Idempotente: si la tabla ya existe (caso restore sobre BD con la fase
 * ya aplicada), el script se sale silenciosamente.
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('mesas');
  if (exists) return;

  await knex.schema.createTable('mesas', (table) => {
    table.increments('id').primary();
    table.integer('restaurante_id').notNullable();
    table.string('nombre', 50).notNullable();
    table.integer('capacidad').notNullable().defaultTo(4);
    table.integer('pos_x').notNullable().defaultTo(100);
    table.integer('pos_y').notNullable().defaultTo(100);
    table.integer('ancho').notNullable().defaultTo(120);
    table.integer('alto').notNullable().defaultTo(120);
    table.string('forma', 20).notNullable().defaultTo('rectangle');
    // libre | ocupada | reservada | mantenimiento
    table.string('estado', 20).notNullable().defaultTo('libre');
    table.timestamp('creado_en').defaultTo(knex.fn.now());
    table.timestamp('actualizado_en').defaultTo(knex.fn.now());

    table.foreign('restaurante_id', 'fk_mesas_restaurante')
      .references('id').inTable('restaurantes').onDelete('CASCADE');
    table.index(['restaurante_id', 'estado'], 'idx_mesas_rest_estado');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('mesas');
}
