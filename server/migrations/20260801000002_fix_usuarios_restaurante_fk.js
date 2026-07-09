/**
 * Fix-up: la migración `20260801000001_add_pos_roles_to_usuarios` quedó
 * parcialmente aplicada: el ENUM se amplió y la columna `restaurante_id`
 * se creó como `INT UNSIGNED`, pero la FK falló porque
 * `restaurantes.id` es `INT` (no UNSIGNED) y MySQL rechaza FKs entre
 * columnas de tipos incompatibles. El resultado: columna sin FK, sin
 * índice — el código del POS no podría usarla confiablemente.
 *
 * Este fix-up:
 *   1) Verifica el estado actual.
 *   2) Borra la columna rota.
 *   3) La vuelve a crear como `INT` (no UNSIGNED) y agrega la FK + índice.
 *
 * Es seguro correrlo múltiples veces (idempotente via information_schema).
 */
export async function up(knex) {
  // Solo actuamos si la columna existe Y está unsigned (estado roto) o no
  // tiene FK. Lo más simple: dropear si existe y recrear limpio.
  const hasCol = await knex.schema.hasColumn('usuarios', 'restaurante_id');
  if (!hasCol) {
    // Si no existe, la añadimos limpia desde el principio
    await knex.schema.alterTable('usuarios', (table) => {
      table.integer('restaurante_id').nullable();
      table.foreign('restaurante_id', 'fk_usuarios_restaurante')
        .references('id').inTable('restaurantes').onDelete('SET NULL');
      table.index('restaurante_id', 'idx_usuarios_restaurante');
    });
    return;
  }

  // Existe: dropear índice y FK si están, y dropear la columna, y recrear.
  // MySQL 8 NO soporta `DROP FOREIGN KEY IF EXISTS` ni `DROP INDEX IF EXISTS`
  // en una sola sentencia. Vamos 1 query por operación, con guards en JS.
  const hasFk = await knex.raw(`
    SELECT COUNT(*) AS n
      FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE()
       AND constraint_name = 'fk_usuarios_restaurante'
  `);
  if (hasFk[0][0].n > 0) {
    await knex.raw(`ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_restaurante`);
  }
  const hasIdx = await knex.raw(`
    SELECT COUNT(*) AS n
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'usuarios'
       AND index_name = 'idx_usuarios_restaurante'
  `);
  if (hasIdx[0][0].n > 0) {
    await knex.raw(`ALTER TABLE usuarios DROP INDEX idx_usuarios_restaurante`);
  }
  await knex.raw(`ALTER TABLE usuarios DROP COLUMN restaurante_id`);

  await knex.schema.alterTable('usuarios', (table) => {
    table.integer('restaurante_id').nullable();
    table.foreign('restaurante_id', 'fk_usuarios_restaurante')
      .references('id').inTable('restaurantes').onDelete('SET NULL');
    table.index('restaurante_id', 'idx_usuarios_restaurante');
  });
}

export async function down(knex) {
  // Revertir a estado "columna sin FK" (que es lo que quedó tras la
  // migración original fallida). Útil para diagnóstico.
  if (await knex.schema.hasColumn('usuarios', 'restaurante_id')) {
    const hasFk = await knex.raw(`
      SELECT COUNT(*) AS n
        FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE()
         AND constraint_name = 'fk_usuarios_restaurante'
    `);
    if (hasFk[0][0].n > 0) {
      await knex.raw(`ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_restaurante`);
    }
    await knex.schema.alterTable('usuarios', (table) => {
      table.dropColumn('restaurante_id');
    });
  }
}
