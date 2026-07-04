/**
 * Migración de datos: catálogo inicial de categorías para el nicho
 * "Panadería y Pastelería".
 *
 * Contexto:
 *   - El nicho se habilitó en la migración
 *     `20260703000001_add_panaderia_pasteleria_nicho.js`, que extendió
 *     el enum `categorias.tipo_negocio` con el valor
 *     'panaderia_pasteleria'.
 *   - Hasta ahora, el HomePage con filtro
 *     `tipo_negocio='panaderia_pasteleria'` no mostraba categorías
 *     porque no había ninguna fila con ese tipo. Esta migración
 *     puebla el catálogo inicial para que el filtro tenga contenido
 *     visible desde el primer despliegue.
 *
 * Estrategia:
 *   - Crea 14 categorías catálogo transversales (compartidas por
 *     todos los locales con `es_panaderia_pasteleria=1`).
 *   - Cada categoría se inserta con `restaurante_id=NULL` y
 *     `tipo_negocio='panaderia_pasteleria'`.
 *   - El UNIQUE constraint actual es
 *     `UNIQUE (restaurante_id, nombre)` → con `restaurante_id=NULL`
 *     MySQL permite múltiples filas con el mismo nombre. NO se
 *     viola el constraint.
 *
 * Idempotencia:
 *   - Antes de insertar, se hace un SELECT para ver qué nombres del
 *     catálogo deseado ya existen. Esos se omiten.
 *   - Si la migración se corre dos veces, la segunda ve los 14 ya
 *     insertados, no-op limpio.
 *   - El down() borra SOLO las filas con `tipo_negocio='panaderia_pasteleria'`
 *     y `restaurante_id IS NULL` para no tocar categorías personalizadas
 *     de locales.
 *
 * Lista confirmada por el dueño del producto (14 nombres):
 *   Pan, Panes Especiales, Tortas, Pasteles, Postres, Galletas,
 *   Empanadas de Horno, Buñuelos, Croissants, Donas, Bebidas,
 *   Combos, Promociones, Acompañamientos.
 */

const CATEGORIAS_PANADERIA = [
  'Pan',
  'Panes Especiales',
  'Tortas',
  'Pasteles',
  'Postres',
  'Galletas',
  'Empanadas de Horno',
  'Buñuelos',
  'Croissants',
  'Donas',
  'Bebidas',
  'Combos',
  'Promociones',
  'Acompañamientos',
];

export async function up(knex) {
  const hasTable = await knex.schema.hasTable('categorias');
  if (!hasTable) return;

  // Caso A: nombres que aún NO existen en el catálogo transversal
  // con tipo_negocio='panaderia_pasteleria' → INSERT.
  // Caso B: nombres que ya existen → no-op.
  const existentesRows = await knex('categorias')
    .select('nombre')
    .whereNull('restaurante_id')
    .where({ tipo_negocio: 'panaderia_pasteleria' })
    .whereIn('nombre', CATEGORIAS_PANADERIA);
  const existentes = new Set(existentesRows.map((r) => r.nombre));

  const aInsertar = CATEGORIAS_PANADERIA
    .filter((nombre) => !existentes.has(nombre))
    // Asignamos un `orden` ascendente según la posición en la lista,
    // para que los chips respeten ese orden en la UI.
    .map((nombre, index) => ({
      restaurante_id: null,
      nombre,
      descripcion: null,
      orden: index,
      tipo_negocio: 'panaderia_pasteleria',
    }));

  if (aInsertar.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[migración] Categorías panadería_pasteleria: ya existen todas, no-op');
    return;
  }

  await knex('categorias').insert(aInsertar);

  // eslint-disable-next-line no-console
  console.log(`[migración] ${aInsertar.length} categorías de panadería/pastelería insertadas`);
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('categorias');
  if (!hasTable) return;

  // Borrar SOLO filas catálogo (restaurante_id IS NULL) del nicho
  // panadería. NO toca categorías personalizadas de locales ni
  // catálogos de otros nichos.
  const deleted = await knex('categorias')
    .whereNull('restaurante_id')
    .where({ tipo_negocio: 'panaderia_pasteleria' })
    .whereIn('nombre', CATEGORIAS_PANADERIA)
    .del();

  // eslint-disable-next-line no-console
  console.log(`[migración rollback] ${deleted} categorías de panadería/pastelería eliminadas`);
}
