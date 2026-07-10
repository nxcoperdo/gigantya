/**
 * Migración POS Fase 12: CMS de banner de Home (tabla `home_media`).
 *
 * El super-admin de GigantYA (rol `usuarios.tipo_usuario='admin'`) puede
 * subir varios archivos (imagen o video) a un "gestor de banners de la
 * home". Elige UNO como activo; la home pública (`/`) lee el activo y
 * lo muestra en el hero.
 *
 * Esto REEMPLAZA el comportamiento hardcodeado de
 * `client/src/pages/HomePage.jsx:14-19` que rotando entre `/banner.mp4`
 * y `/banner2.mp4` día por medio.
 *
 * Decisiones:
 *   - `tipo` como ENUM (no VARCHAR) porque el código solo maneja 2
 *     tipos. Si en el futuro se necesita más (gif, lottie, etc.),
 *     se migra.
 *   - `activo` no tiene UNIQUE constraint porque MySQL no soporta
 *     `UNIQUE WHERE`. El controller `adminHomeMediaController.setActivo`
 *     lo garantiza transaccionalmente (primero desactiva todos,
 *     después activa el elegido). El índice `idx_home_media_activo`
 *     acelera el `SELECT ... WHERE activo=1` del GET público.
 *   - `archivo_path` es relativo a `/uploads/` (no absoluto) para
 *     portabilidad entre local y VPS. El factory `createUploader` de
 *     `server/src/middleware/uploadMiddleware.js:32-80` genera el
 *     path con la subcarpeta `home-media/`.
 *   - `subido_por` es FK a `usuarios.id` SIN UNSIGNED (en este
 *     proyecto las PKs de usuarios son INT, no INT UNSIGNED, ver
 *     migración de Fase 5). ON DELETE RESTRICT: si un admin subió
 *     banners, no se puede borrar su cuenta sin borrar los banners
 *     primero. Defensivo.
 *
 * Idempotente: el patrón `hasTable` evita tirar error si la tabla
 * ya existe.
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable('home_media'))) {
    await knex.schema.createTable('home_media', (table) => {
      table.increments('id').primary();
      table.string('nombre', 150).notNullable();
      table.string('archivo_path', 255).notNullable();
      // ENUM en Knex: se traduce a `ENUM('imagen','video')` en MySQL.
      table.enum('tipo', ['imagen', 'video']).notNullable();
      table.string('mime', 50).notNullable();
      table.integer('size_bytes').unsigned().notNullable();
      table.boolean('activo').notNullable().defaultTo(false);
      // `usuarios.id` es INT (no UNSIGNED) en este proyecto.
      table.integer('subido_por').notNullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      // FK con nombre explícito (consistente con el resto del schema).
      table.foreign('subido_por', 'fk_home_media_user')
        .references('id').inTable('usuarios').onDelete('RESTRICT');
      table.index(['activo'], 'idx_home_media_activo');
      table.index(['creado_en'], 'idx_home_media_creado');
    });
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('home_media')) {
    await knex.schema.dropTable('home_media');
  }
}
