// Login con Google: adapta la tabla `usuarios` para cuentas sin contraseña.
//
//  - contrasena_hash pasa a NULLABLE: los usuarios que entran con Google no
//    tienen contraseña propia (la auth la valida Google).
//  - google_id: el `sub` de Google (id estable de la cuenta). UNIQUE para
//    poder linkear/deduplicar. Permite NULL (MySQL admite múltiples NULL en
//    índice UNIQUE), así que los usuarios locales quedan con google_id NULL.
//  - avatar_url: la foto de perfil de Google (opcional, para la UI).
export async function up(knex) {
  await knex.schema.alterTable('usuarios', (table) => {
    table.string('contrasena_hash').nullable().alter();
    table.string('google_id', 255).nullable();
    table.string('avatar_url', 500).nullable();
  });

  await knex.schema.alterTable('usuarios', (table) => {
    table.unique(['google_id'], { indexName: 'uq_usuarios_google_id' });
  });
}

export async function down(knex) {
  await knex.schema.alterTable('usuarios', (table) => {
    table.dropUnique(['google_id'], 'uq_usuarios_google_id');
    table.dropColumn('google_id');
    table.dropColumn('avatar_url');
  });
  // No revertimos contrasena_hash a NOT NULL: para entonces podrían existir
  // filas de usuarios de Google con hash NULL y el ALTER fallaría.
}
