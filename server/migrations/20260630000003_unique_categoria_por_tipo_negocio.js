/**
 * Migración: reemplazar el UNIQUE constraint de `categorias` para que
 * contemple `tipo_negocio`.
 *
 * ¿Por qué?
 *   El UNIQUE original (solo sobre `nombre`) impide que existan categorías
 *   con el mismo nombre en distintos nichos. Por ejemplo, "Bebidas" ya
 *   existe como categoría de restaurante y ahora el catálogo de mercados
 *   también necesita su propia "Bebidas" — el constraint las rechaza.
 *
 * Solución:
 *   Droppear `uk_restaurante_categoria` (UNIQUE sobre `nombre`) y crear
 *   uno nuevo `uq_categoria_tipo_nombre` sobre `(tipo_negocio, nombre)`.
 *   Así cada nicho tiene su propio namespace y los nombres se pueden
 *   repetir entre nichos.
 *
 * Idempotente: si el constraint viejo ya no existe (porque la migración
 * se re-ejecuta) o el nuevo ya existe, no hace nada.
 */
export async function up(knex) {
  // 1. Droppear el UNIQUE viejo (solo sobre `nombre`).
  const oldUniqueExists = await knex.schema.hasColumn('categorias', 'nombre');
  if (oldUniqueExists) {
    const oldIdx = await knex.raw(
      `SHOW INDEX FROM categorias WHERE Key_name = 'uk_restaurante_categoria'`
    );
    const oldHasRow = (oldIdx[0] || []).length > 0;
    if (oldHasRow) {
      await knex.schema.alterTable('categorias', (table) => {
        table.dropUnique(['nombre'], 'uk_restaurante_categoria');
      });
    }
  }

  // 2. Crear el nuevo UNIQUE compuesto sobre (tipo_negocio, nombre).
  //    No-op si ya existe (porque la migración se re-ejecuta).
  const newIdx = await knex.raw(
    `SHOW INDEX FROM categorias WHERE Key_name = 'uq_categoria_tipo_nombre'`
  );
  const newHasRow = (newIdx[0] || []).length > 0;
  if (!newHasRow) {
    await knex.schema.alterTable('categorias', (table) => {
      table.unique(['tipo_negocio', 'nombre'], { indexName: 'uq_categoria_tipo_nombre' });
    });
  }
}

export async function down(knex) {
  // Revertir: drop nuevo, restaurar viejo.
  const newIdx = await knex.raw(
    `SHOW INDEX FROM categorias WHERE Key_name = 'uq_categoria_tipo_nombre'`
  );
  if ((newIdx[0] || []).length > 0) {
    await knex.schema.alterTable('categorias', (table) => {
      table.dropUnique(['tipo_negocio', 'nombre'], 'uq_categoria_tipo_nombre');
    });
  }

  const oldIdx = await knex.raw(
    `SHOW INDEX FROM categorias WHERE Key_name = 'uk_restaurante_categoria'`
  );
  if ((oldIdx[0] || []).length === 0) {
    await knex.schema.alterTable('categorias', (table) => {
      table.unique(['nombre'], { indexName: 'uk_restaurante_categoria' });
    });
  }
}