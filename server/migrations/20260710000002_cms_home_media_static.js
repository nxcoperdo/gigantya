/**
 * Fase 12b — Migración home_media: archivo_path → archivo
 *
 * Cambio de diseño: los banners pasan de subirse a server/uploads/
 * a ser assets estáticos commiteados en client/public/media/.
 * La columna archivo_path (path relativo a /uploads/) se reemplaza
 * por archivo (solo el nombre del archivo).
 *
 * Idempotente: corre sin error si la columna ya fue renombrada.
 *
 *   Up:
 *   1. ADD COLUMN archivo VARCHAR(100) NOT NULL DEFAULT '' (si no existe)
 *   2. UPDATE: copia basename de archivo_path a archivo
 *   3. ADD UNIQUE KEY uq_home_media_archivo (archivo) (si no existe)
 *   4. DROP COLUMN archivo_path (si existe)
 *
 *   Down:
 *   1. ADD COLUMN archivo_path VARCHAR(255) NOT NULL DEFAULT ''
 *   2. UPDATE: concatena 'home-media/' + archivo
 *   3. DROP UNIQUE KEY uq_home_media_archivo
 *   4. DROP COLUMN archivo
 */
export async function up(knex) {
  const hasArchivoPath = await knex.schema.hasColumn('home_media', 'archivo_path');
  const hasArchivo = await knex.schema.hasColumn('home_media', 'archivo');

  // 1) Agregar `archivo` si no existe.
  if (!hasArchivo && hasArchivoPath) {
    await knex.schema.table('home_media', (t) => {
      t.string('archivo', 100).notNullable().defaultTo('').after('nombre');
    });
  }

  // 2) Copiar basename de archivo_path a archivo (si archivo_path existía).
  if (hasArchivoPath) {
    await knex.raw(
      `UPDATE home_media
          SET archivo = SUBSTRING_INDEX(archivo_path, '/', -1)
        WHERE (archivo IS NULL OR archivo = '')
          AND archivo_path IS NOT NULL`
    );
  }

  // 3) UNIQUE KEY en archivo.
  const hasUnique = await knex.raw(
    `SELECT COUNT(*) AS total FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'home_media'
        AND index_name = 'uq_home_media_archivo'`
  );
  if (Number(hasUnique[0]?.[0]?.total || 0) === 0 && hasArchivo) {
    await knex.schema.alterTable('home_media', (t) => {
      t.unique(['archivo'], { indexName: 'uq_home_media_archivo' });
    });
  }

  // 4) DROP archivo_path.
  if (hasArchivoPath) {
    await knex.schema.table('home_media', (t) => {
      t.dropColumn('archivo_path');
    });
  }
}

export async function down(knex) {
  const hasArchivo = await knex.schema.hasColumn('home_media', 'archivo');
  const hasArchivoPath = await knex.schema.hasColumn('home_media', 'archivo_path');

  // 1) Re-agregar archivo_path.
  if (!hasArchivoPath) {
    await knex.schema.table('home_media', (t) => {
      t.string('archivo_path', 255).notNullable().defaultTo('').after('nombre');
    });
  }

  // 2) Reconstruir archivo_path = 'home-media/' + archivo.
  if (hasArchivo) {
    await knex.raw(
      `UPDATE home_media
          SET archivo_path = CONCAT('home-media/', archivo)
        WHERE (archivo_path IS NULL OR archivo_path = '')
          AND archivo IS NOT NULL AND archivo <> ''`
    );
  }

  // 3) DROP UNIQUE KEY.
  const hasUnique = await knex.raw(
    `SELECT COUNT(*) AS total FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'home_media'
        AND index_name = 'uq_home_media_archivo'`
  );
  if (Number(hasUnique[0]?.[0]?.total || 0) > 0) {
    await knex.schema.alterTable('home_media', (t) => {
      t.dropUnique(['archivo'], 'uq_home_media_archivo');
    });
  }

  // 4) DROP archivo.
  if (hasArchivo) {
    await knex.schema.table('home_media', (t) => {
      t.dropColumn('archivo');
    });
  }
}
