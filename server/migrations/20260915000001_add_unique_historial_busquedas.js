/**
 * Migración: UNIQUE INDEX funcional sobre `historial_busquedas(usuario_id, LOWER(termino))`.
 *
 * Contexto:
 *   El modelo `SearchHistory.addSearch` hace un INSERT simple, lo que permite
 *   que un mismo usuario acumule N filas con el mismo término (variando
 *   mayúsculas/minúsculas, o re-búsquedas). Para soportar el nuevo endpoint
 *   `POST /api/preferences/search-history` con dedup atómico vía
 *   `INSERT ... ON DUPLICATE KEY UPDATE creado_en = NOW()`, la tabla necesita
 *   una UNIQUE KEY que case-insensitive sobre el término por usuario.
 *
 * MySQL 8 soporta índices funcionales sobre expresiones, así que usamos
 * `LOWER(termino)` para que "Pizza" y "pizza" cuenten como duplicado.
 *
 * Antes de crear el índice, la migración borra los duplicados preexistentes
 * (deja solo la fila más reciente por (usuario_id, LOWER(termino))). Si la
 * tabla ya tiene miles de duplicados, este DELETE puede tardar en producción
 * — es esperable para una migración one-shot.
 *
 * Si la tabla no existe (entornos muy viejos), la migración se saltea sin
 * error para no romper el deploy.
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('historial_busquedas');
  if (!hasTable) return;

  // 1) Eliminar duplicados preexistentes: dejar la fila más reciente por
  //    (usuario_id, LOWER(termino)). Usamos self-join con `>` sobre creado_en
  //    para identificar las filas "viejas" y borrarlas.
  await knex.raw(`
    DELETE h1 FROM historial_busquedas h1
    INNER JOIN historial_busquedas h2
      ON h1.usuario_id = h2.usuario_id
     AND LOWER(h1.termino) = LOWER(h2.termino)
     AND h1.id <> h2.id
     AND h1.creado_en < h2.creado_en
  `);

  // 2) Crear el UNIQUE INDEX funcional. Si por algún motivo ya existe (migración
  //    re-corrida en local), la saltea para no romper el deploy.
  const [rows] = await knex.raw(
    `SELECT INDEX_NAME
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'historial_busquedas'
        AND index_name = 'uk_historial_busquedas_usuario_termino'
      LIMIT 1`,
  );
  const exists = Array.isArray(rows) ? rows.length > 0 : Boolean(rows && rows[0]);
  if (exists) return;

  await knex.raw(`
    CREATE UNIQUE INDEX uk_historial_busquedas_usuario_termino
      ON historial_busquedas (usuario_id, (LOWER(termino)))
  `);
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('historial_busquedas');
  if (!hasTable) return;

  // Si quedan duplicados que violarían el UNIQUE, este DROP falla. Es el
  // comportamiento esperado: el reverso deja la tabla en estado válido.
  await knex.raw(`DROP INDEX uk_historial_busquedas_usuario_termino ON historial_busquedas`);
}
