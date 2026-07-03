/**
 * Migración: agregar campo `es_restaurante` a la tabla `restaurantes`.
 *
 * Contexto:
 *   El producto tiene tres nichos que el admin asigna con flags booleanos
 *   independientes: `es_restaurante` (este), `es_comida_rapida` y
 *   `es_mercado_abarrotes`. Hasta esta migración el "nicho restaurante" se
 *   modelaba implícitamente como la AUSENCIA de los otros dos flags
 *   (`es_comida_rapida = 0 AND es_mercado_abarrotes = 0`). Eso no permite
 *   distinguir "solo restaurante" de "restaurante + comida rápida" (combo):
 *   los dos casos comparten el mismo estado booleano.
 *
 * ¿Para qué sirve este flag?
 *   Hace explícito el bit "este local participa del nicho restaurante", lo
 *   que combinado con `es_comida_rapida` y `es_mercado_abarrotes` permite
 *   los cuatro estados de la matriz de la sección de contexto del plan:
 *
 *     (es_restaurante, es_comida_rapida) → nicho resultante
 *     (1, 0)                            → solo restaurante
 *     (1, 1)                            → restaurante + comida rápida (combo)
 *     (0, 1)                            → solo comida rápida
 *     (0, 0)                            → sin nicho (caso degenerado; el
 *                                          local queda oculto de los tres
 *                                          filtros — no debería existir en
 *                                          producción).
 *
 *   `es_mercado_abarrotes` sigue siendo mutuamente excluyente con los otros
 *   dos: un mercado no puede combinar con restaurante ni con comida rápida.
 *
 * Default:
 *   - `TRUE` (NOT NULL DEFAULT 1) → los locales existentes siguen siendo
 *     "restaurantes" por default. Sólo los que ya estaban marcados como
 *     `es_comida_rapida = 1` se migran a `es_restaurante = 0` (asumiendo
 *     "solo comida rápida"; el admin los corrige si eran combos).
 *
 * Patrón idempotente: la creación de la columna se envuelve en `hasColumn`
 * y la data migration filtra con `WHERE es_restaurante = 1` para no pisar
 * correcciones manuales del admin tras el primer deploy.
 */
export async function up(knex) {
  await ensureColumn(knex, 'restaurantes', 'es_restaurante', (table) => {
    table.boolean('es_restaurante').notNullable().defaultTo(true);
  });

  await migrarSoloComidaRapida(knex);
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, agrega la
 * columna ejecutando el callback recibido (que declara la columna sobre
 * `table`). Réplica del helper usado en
 * 20260629000002_add_es_mercado_abarrotes_to_restaurantes.js.
 */
async function ensureColumn(knex, tableName, columnName, declare) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    declare(table);
  });
}

/**
 * Data migration: para los locales que la confirmación del dueño del
 * producto marcó como "solo comida rápida" (tienen `es_comida_rapida = 1`
 * y NO son mercado), se les pone `es_restaurante = 0`. Es idempotente
 * porque filtra por `es_restaurante = 1` — si el admin ya corrigió
 * manualmente un combo a `es_restaurante = 1` con `es_comida_rapida = 1`,
 * el UPDATE no lo toca.
 *
 * NO se tocan los locales con `es_mercado_abarrotes = 1`: un mercado sigue
 * siendo mercado excluyente y queda con `es_restaurante` en su default
 * (TRUE), pero la lógica de filtrado en el modelo los excluye de los feeds
 * "Restaurantes" y "Comida rápida".
 */
async function migrarSoloComidaRapida(knex) {
  const hasTable = await knex.schema.hasTable('restaurantes');
  if (!hasTable) return;

  const updated = await knex('restaurantes')
    .where({ es_comida_rapida: 1, es_mercado_abarrotes: 0 })
    // whereNull no es necesario: el default del flag es 0/1 explícito,
    // no NULL. Filtramos por es_mercado_abarrotes = 0 en su lugar.
    .where('es_restaurante', 1)
    .update({ es_restaurante: 0 });

  // eslint-disable-next-line no-console
  console.log(
    `[migración] ${updated} locales marcados como es_comida_rapida=1 migrados ` +
    `a es_restaurante=0 (asumidos 'solo comida rápida').`
  );
}

export async function down(knex) {
  if (await knex.schema.hasTable('restaurantes')) {
    await dropColumnIfExists(knex, 'restaurantes', 'es_restaurante');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
