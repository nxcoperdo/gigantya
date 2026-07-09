/**
 * Migración Golden Plus: ensancha `restaurantes.plan` y `suscripciones.plan`
 * de VARCHAR(20) → VARCHAR(30).
 *
 * Contexto:
 *   'golden_plus' mide 11 chars y entra cómodo en VARCHAR(20), pero
 *   ensanchar previene futuros planes con nombres largos
 *   (ej. 'premium_plus', 'enterprise'). La columna es VARCHAR libre
 *   validada en código (ver `adminController.updateRestaurantPlan` +
 *   `PLANES` en `utils/planFeatures.js`), por eso NO hace falta cambiar
 *   el tipo a ENUM.
 *
 * Idempotencia:
 *   - Verifica `information_schema.columns` para confirmar el tipo actual.
 *   - Si ya es VARCHAR(30) o más ancho, skip.
 *   - Si la tabla no existe, skip silencioso.
 *
 * En producción esta migración se aplica a mano en el VPS usando
 * `database/migrations_manuales/pos_fase9_golden_plus.sql`
 * (ver [[deploy-vps-checklist]]).
 */
export async function up(knex) {
  // 1) restaurantes.plan → VARCHAR(30)
  await widenPlanColumn(knex, 'restaurantes', 'plan', 30);

  // 2) suscripciones.plan → VARCHAR(30)
  await widenPlanColumn(knex, 'suscripciones', 'plan', 30);
}

export async function down(knex) {
  // Reverso: encoger de vuelta a VARCHAR(20). Peligroso si hay filas
  // con `plan` > 20 chars, así que primero validamos. Si alguien dejó
  // un valor largo en producción, MySQL rechaza el MODIFY (modo strict).
  await shrinkPlanColumn(knex, 'restaurantes', 'plan', 20);
  await shrinkPlanColumn(knex, 'suscripciones', 'plan', 20);
}

/**
 * Ensancha una columna `plan` a `newLength` solo si la longitud actual
 * es menor a `newLength` y la tabla/columna existe.
 */
async function widenPlanColumn(knex, tableName, columnName, newLength) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;

  const [rows] = await knex.raw(
    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName],
  );

  if (!rows || rows.length === 0) return;

  const { DATA_TYPE, CHARACTER_MAXIMUM_LENGTH } = rows[0];
  // Solo actuamos si es VARCHAR (o CHAR) y la longitud actual es menor.
  // Si es ENUM, no tocamos (no aplica acá pero defensivo).
  if (DATA_TYPE !== 'varchar' && DATA_TYPE !== 'char') return;
  if (Number(CHARACTER_MAXIMUM_LENGTH) >= Number(newLength)) return;

  // Preservamos el default 'basico' que ya tiene la columna. El `IS_NULLABLE`
  // se infiere del esquema actual (restaurantes.plan es NULLABLE,
  // suscripciones.plan es NOT NULL), así que el MODIFY no fuerza uno nuevo.
  await knex.raw(
    `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` VARCHAR(${newLength}) DEFAULT 'basico'`,
  );
}

async function shrinkPlanColumn(knex, tableName, columnName, newLength) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;

  const [rows] = await knex.raw(
    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName],
  );
  if (!rows || rows.length === 0) return;
  const { DATA_TYPE, CHARACTER_MAXIMUM_LENGTH } = rows[0];
  if (DATA_TYPE !== 'varchar' && DATA_TYPE !== 'char') return;
  if (Number(CHARACTER_MAXIMUM_LENGTH) <= Number(newLength)) return;

  await knex.raw(
    `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` VARCHAR(${newLength}) DEFAULT 'basico'`,
  );
}
