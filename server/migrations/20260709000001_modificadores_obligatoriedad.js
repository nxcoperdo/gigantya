/**
 * Migración: extender `producto_grupos_adiciones` con obligatoriedad y
 * min/max de selección (Fase 10 — Modificadores configurables).
 *
 * ¿Para qué sirve?
 *   Hoy un grupo de adiciones es un simple contenedor de opciones que el
 *   cliente puede elegir o no, sin reglas. Con estas 3 columnas, el local
 *   puede configurar reglas tipo Rappi/PedidosYa:
 *
 *     - obligatorio TINYINT(1)   → si es 1, el cliente DEBE elegir al menos
 *                                 `min_selecciones` opciones del grupo antes
 *                                 de poder agregar el producto al carrito.
 *     - min_selecciones INT      → cantidad mínima de opciones a elegir del
 *                                 grupo. Para obligatorios, >= 1.
 *     - max_selecciones INT      → cantidad máxima. 99 = sin tope efectivo.
 *
 *   La validación de obligatoriedad y min/max se hace en dos lugares:
 *     1. Frontend: el botón "Agregar" del `ProductCustomizationModal`
 *        queda disabled si algún grupo obligatorio está incompleto.
 *     2. Backend: `validateAdicionesYRemovibles` en `orderService.js` es
 *        la defensa de profundidad. Web y POS pasan por ahí.
 *
 * Compatibilidad:
 *   - Defaults `0 / 0 / 99` reproducen EXACTAMENTE el comportamiento
 *     anterior (grupo opcional, sin mínimo, sin máximo efectivo). Cero
 *     impacto en productos sin la nueva config.
 *   - Patrón idempotente con `hasColumn` (estilo del resto de migraciones
 *     del proyecto).
 */
export async function up(knex) {
  await ensureColumn(knex, 'producto_grupos_adiciones', 'obligatorio', (table) => {
    table.boolean('obligatorio').notNullable().defaultTo(false);
  });
  await ensureColumn(knex, 'producto_grupos_adiciones', 'min_selecciones', (table) => {
    table.integer('min_selecciones').notNullable().defaultTo(0);
  });
  await ensureColumn(knex, 'producto_grupos_adiciones', 'max_selecciones', (table) => {
    table.integer('max_selecciones').notNullable().defaultTo(99);
  });
}

export async function down(knex) {
  // Drop en orden inverso. Los checks idempotentes con hasColumn evitan
  // tirar error si la columna ya no está (re-run de down, dev, etc.).
  const drops = [
    ['max_selecciones', 'INT NOT NULL DEFAULT 99'],
    ['min_selecciones', 'INT NOT NULL DEFAULT 0'],
    ['obligatorio',      'TINYINT(1) NOT NULL DEFAULT 0'],
  ];
  for (const [colName, colType] of drops) {
    if (await knex.schema.hasTable('producto_grupos_adiciones')) {
      const hasColumn = await knex.schema.hasColumn('producto_grupos_adiciones', colName);
      if (hasColumn) {
        await knex.schema.alterTable('producto_grupos_adiciones', (table) => {
          table.dropColumn(colName);
        });
      }
    }
  }
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, la agrega.
 *
 * @param {import('knex').Knex} knex
 * @param {string} tableName
 * @param {string} columnName
 * @param {(table: import('knex').CreateTableBuilder) => void} declare
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
