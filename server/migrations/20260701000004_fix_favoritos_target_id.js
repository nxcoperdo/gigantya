/**
 * Migración: alinea la tabla `favoritos` con lo que el código espera.
 *
 * Contexto:
 * La tabla `favoritos` existía en la DB antes de esta migration con la
 * estructura:
 *   id, usuario_id, referencia_id, tipo (VARCHAR), creado_en
 *
 * El modelo `Favorite.js` y el controller `preferenceController` esperan
 * la columna `target_id` (no `referencia_id`). Por eso el INSERT tira
 * `ER_BAD_FIELD_ERROR: Unknown column 'target_id'`.
 *
 * Solución: renombrar la columna `referencia_id` → `target_id`.
 * Cero pérdida de datos. Reversible con down().
 *
 * La migration previa `20260701000003_create_favoritos.js` tenía un
 * `if (exists) return` (idempotente para no romper deploys donde la
 * tabla ya existía creada a mano). Esa migration se aplicó pero fue
 * no-op. Esta migration arregla el desfase entre lo que la DB tiene
 * y lo que el código necesita.
 *
 * Decisión: NO cambio el código para usar `referencia_id` (eso crearía
 * una inconsistencia de naming y rompería la convención de `target_id`
 * que es semánticamente más claro). Renombrar la columna es la opción
 * correcta.
 */

export async function up(knex) {
  // Defensa: si la columna ya se llama target_id, no hacer nada
  // (idempotente — si se corre dos veces, no rompe).
  const hasTarget = await knex.schema.hasColumn('favoritos', 'target_id');
  if (hasTarget) return;

  const hasReferencia = await knex.schema.hasColumn('favoritos', 'referencia_id');
  if (!hasReferencia) {
    // Ni target_id ni referencia_id existen. La tabla no tiene la
    // estructura que el código espera; mejor fallar ruidosamente
    // que inventar columnas. No podemos asumir qué tipo/forma tenía.
    throw new Error(
      'Migration 20260701000004_fix_favoritos_target_id: la tabla favoritos ' +
      'no tiene columna target_id ni referencia_id. Revisá la estructura manualmente.'
    );
  }

  await knex.schema.alterTable('favoritos', (table) => {
    table.renameColumn('referencia_id', 'target_id');
  });
}

export async function down(knex) {
  const hasReferencia = await knex.schema.hasColumn('favoritos', 'referencia_id');
  if (hasReferencia) return;

  const hasTarget = await knex.schema.hasColumn('favoritos', 'target_id');
  if (hasTarget) {
    await knex.schema.alterTable('favoritos', (table) => {
      table.renameColumn('target_id', 'referencia_id');
    });
  }
}
