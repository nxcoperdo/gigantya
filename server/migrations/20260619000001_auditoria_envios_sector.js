/**
 * Migración: auditoría de quién modificó los envíos por sector.
 *
 * Agrega la columna `actualizado_por_usuario_id` (FK a usuarios) a
 * `restaurante_envios_sector` para saber si el último cambio lo hizo
 * el admin o el dueño del restaurante.
 *
 * IMPORTANTE: `usuarios.id` es signed INT (creado con `table.increments`).
 * La nueva columna debe ser signed también para que la FK sea válida en MySQL
 * (de lo contrario: error 3780 - Referencing and referenced columns are incompatible).
 *
 * Idempotente: si la columna o el índice ya existen, no se duplican.
 */
export async function up(knex) {
  const hasCol = await knex.schema.hasColumn('restaurante_envios_sector', 'actualizado_por_usuario_id');
  if (!hasCol) {
    await knex.schema.alterTable('restaurante_envios_sector', (table) => {
      table.integer('actualizado_por_usuario_id').nullable().after('costo');
      table.foreign('actualizado_por_usuario_id', 'fk_res_envio_usuario')
        .references('id').inTable('usuarios').onDelete('SET NULL');
      table.index('actualizado_por_usuario_id', 'idx_res_envio_actualizado_por');
    });
  }
}

export async function down(knex) {
  const hasCol = await knex.schema.hasColumn('restaurante_envios_sector', 'actualizado_por_usuario_id');
  if (hasCol) {
    await knex.schema.alterTable('restaurante_envios_sector', (table) => {
      table.dropIndex(['actualizado_por_usuario_id'], 'idx_res_envio_actualizado_por');
      table.dropForeign(['actualizado_por_usuario_id'], 'fk_res_envio_usuario');
      table.dropColumn('actualizado_por_usuario_id');
    });
  }
}
