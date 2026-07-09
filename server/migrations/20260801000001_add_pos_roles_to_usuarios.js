/**
 * Migración: agregar roles del POS al ENUM `usuarios.tipo_usuario` y la
 * columna `restaurante_id` para atar al staff (cajero/mesero/cocina)
 * a su local.
 *
 * ¿Por qué este orden?
 *   1) Primero se amplía el ENUM con `MODIFY COLUMN` (operación in-place
 *      en MySQL cuando solo se agregan valores al final, no reescribe
 *      filas). Es seguro en producción con datos existentes.
 *   2) Después se agrega `restaurante_id` como FK nullable — los usuarios
 *      `cliente`/`restaurante`/`admin` existentes quedan con NULL.
 *
 * Patrón idempotente: igual que `20260702000004` y `20260708000001`.
 *
 * Decisión de arquitectura: staff con login propio (no tabla `empleados`
 * separada) por simplicidad. Cada staff pertenece a UN solo restaurante
 * (no multi-sede). El dueño del restaurante se identifica porque
 * `restaurantes.usuario_id === usuarios.id` (mismo campo que ya existe).
 */
export async function up(knex) {
  // 1) Ampliar el ENUM. MySQL acepta MODIFY ENUM con append de valores
  //    sin reescribir filas. Documentado en
  //    https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
  await knex.raw(`
    ALTER TABLE usuarios
    MODIFY COLUMN tipo_usuario
    ENUM('cliente','restaurante','admin','cajero','mesero','cocina')
    NOT NULL
  `);

  // 2) FK restaurante_id para staff. Nullable: cliente/restaurante/admin
  //    existentes quedan con NULL.
  //
  //    IMPORTANTE: NO usar `.unsigned()` aquí. En este schema,
  //    `restaurantes.id` es `INT` (sin UNSIGNED) — usar
  //    `restaurante_id` UNSIGNED provoca un error de MySQL:
  //      "Referencing column 'restaurante_id' and referenced column
  //       'id' in foreign key constraint are incompatible."
  //    Si en el futuro el schema migra a UNSIGNED, revisar esta columna.
  if (!(await knex.schema.hasColumn('usuarios', 'restaurante_id'))) {
    await knex.schema.alterTable('usuarios', (table) => {
      table.integer('restaurante_id').nullable();
      table.foreign('restaurante_id', 'fk_usuarios_restaurante')
        .references('id').inTable('restaurantes').onDelete('SET NULL');
      table.index('restaurante_id', 'idx_usuarios_restaurante');
    });
  }
}

export async function down(knex) {
  // Solo se puede revertir si NINGUNA fila usa cajero/mesero/cocina.
  // Si hay filas, MySQL truncará los valores al primer ENUM válido.
  if (await knex.schema.hasColumn('usuarios', 'restaurante_id')) {
    await knex.schema.alterTable('usuarios', (table) => {
      table.dropForeign('restaurante_id', 'fk_usuarios_restaurante');
      table.dropIndex('restaurante_id', 'idx_usuarios_restaurante');
      table.dropColumn('restaurante_id');
    });
  }
  await knex.raw(`
    ALTER TABLE usuarios
    MODIFY COLUMN tipo_usuario
    ENUM('cliente','restaurante','admin') NOT NULL
  `);
}
