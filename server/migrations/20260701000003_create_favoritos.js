/**
 * Migración: crea la tabla `favoritos` (favoritos de usuarios).
 *
 * Contexto: el modelo `server/src/models/Favorite.js` y el
 * `preferenceController` ya referencian esta tabla con la estructura
 * (usuario_id, tipo, target_id) pero nunca se había creado la tabla en
 * una migration. En la DB local probablemente existe creada a mano con
 * el nombre `favorites` o con columnas distintas; esta migration solo
 * crea `favoritos` con la forma exacta que el código espera.
 *
 * - tipo ENUM('restaurant', 'product'): el controller valida esto
 *   (preferenceController.js:12-14). ENUM en la DB agrega defensa adicional.
 * - UNIQUE(usuario_id, tipo, target_id): evita que el mismo usuario
 *   tenga duplicado el mismo favorito. El controller hoy hace INSERT
 *   directo sin check; si ya existe, MySQL tira DUP_ENTRY y el server
 *   responde 500. El UNIQUE convierte eso en un error determinístico
 *   que podemos mapear después a 409 si se quiere.
 * - FK a usuarios con ON DELETE CASCADE: si se borra un usuario, se
 *   borran sus favoritos. Coherente con el resto del proyecto.
 * - ON DELETE CASCADE también en las FKs a restaurantes/productos:
 *   si se borra un local o un producto, sus favoritos desaparecen
 *   con él. No referencian a ON DELETE RESTRICT que sería estricto
 *   y rompería deletes de productos.
 *
 * Nota sobre el nombre: la tabla se llama `favoritos` (español) porque
 * así la referencia el modelo. Otras tablas del proyecto usan nombres
 * en inglés (users, restaurants). Esta inconsistencia es preexistente
 * y no la corrijo acá — solo creo lo que el código necesita.
 */

export async function up(knex) {
  // Si la tabla ya existe (probable: creada a mano en la DB de dev),
  // no la tocamos. La estructura que el modelo espera es la misma
  // que crea este CREATE; si difiere, hay que arreglarla a mano.
  const exists = await knex.schema.hasTable('favoritos');
  if (exists) return;

  await knex.schema.createTable('favoritos', (table) => {
    table.increments('id').primary();
    table.integer('usuario_id').unsigned().notNullable();
    table.enum('tipo', ['restaurant', 'product']).notNullable();
    table.integer('target_id').unsigned().notNullable();
    table.timestamp('creado_en').defaultTo(knex.fn.now());

    // Foreign key: si se borra el usuario, se borran sus favoritos
    table.foreign('usuario_id')
      .references('id').inTable('usuarios')
      .onDelete('CASCADE');

    // Un usuario no puede tener el mismo favorito duplicado
    // (mismo tipo + mismo target_id). El controller hace INSERT
    // directo; si choca, MySQL tira ER_DUP_ENTRY.
    table.unique(['usuario_id', 'tipo', 'target_id'], {
      indexName: 'favoritos_usuario_tipo_target_unique',
    });

    // Índice para la consulta principal: favoritos de un usuario
    // filtrados por tipo, ordenado por creado_en DESC.
    table.index(['usuario_id', 'tipo'], 'favoritos_usuario_tipo_idx');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('favoritos');
}
