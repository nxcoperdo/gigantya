/**
 * Migración de datos: reclasificar el catálogo transversal histórico
 * de `categorias` como `tipo_negocio='comida_rapida'`.
 *
 * Contexto:
 *   - Los seeds iniciales del proyecto (incluido el histórico
 *     `20260630000002_seed_categorias_*.js` y anteriores) sembraron
 *     un catálogo transversal grande con `tipo_negocio='restaurante'`
 *     (default histórico del enum en ese momento).
 *   - En la realidad, ese catálogo es de **comida rápida**: los
 *     locales activos del piloto son hamburgueserías, perros
 *     calientes, pizzas, salchipapas, etc.
 *   - Esta migración corrige la asignación SOLO en categorías del
 *     catálogo transversal (`restaurante_id IS NULL`).
 *
 * Lista confirmada por el dueño del producto (30 nombres):
 *   Hamburguesas, Perros Calientes, Salchipapas, Mazorcadas, Picadas,
 *   Patacones Rellenos, Arepas Rellenas, Tacos, Burritos, Quesadillas,
 *   Nachos, Empanadas y Fritos, Chuzos y Pinchos, Alitas y Pollo,
 *   Sandwiches, Wraps, Pizzas, Panzerottis, Calzones, Lasañas, Pastas,
 *   Acompañamientos, Adiciones, Bebidas, Malteadas, Postres, Helados,
 *   Combos, Promociones.
 *
 * Estrategia (porque el constraint UNIQUE (nombre, tipo_negocio) bloquea
 * tener dos filas con el mismo nombre y mismo tipo_negocio):
 *   Para cada nombre de la lista hay TRES casos posibles:
 *     A) Solo existe fila con tipo_negocio='restaurante' (histórico) →
 *        UPDATE → tipo_negocio='comida_rapida'.
 *     B) Solo existe fila con tipo_negocio='comida_rapida' (ya sembrado
 *        por 20260630000006_seed_categorias_comida_rapida.js) →
 *        no-op.
 *     C) Existen AMBAS (caso del bug que rompe el primer intento de
 *        migración, porque el UPDATE masivo generaba un duplicado
 *        violando el UNIQUE) → DELETE la fila 'restaurante' porque
 *        la 'comida_rapida' ya cubre ese nombre.
 *
 *   Categorías NO tocadas:
 *     - Cualquier categoría con `restaurante_id IS NOT NULL`
 *       (catálogos personalizados por cada local — la asignación
 *       depende del dueño del restaurante, no de esta migración).
 *     - Cualquier categoría con `tipo_negocio='mercado'` (pertenecen
 *       al catálogo de mercado y abarrotes, sin cambios).
 *
 * Implementación:
 *   MySQL no permite `UPDATE tabla WHERE col IN (SELECT col FROM tabla)`
 *   (error 1093). Se sortea con un SELECT envoltorio:
 *     WHERE nombre IN (SELECT nombre FROM (SELECT nombre FROM ...) AS x)
 *   patrón estándar que materializa la sub-consulta en una capa
 *   intermedia y le da a MySQL el alias que necesita.
 *
 * Idempotencia:
 *   Re-ejecutable sin error: los UPDATEs del caso A no encuentran
 *   filas (ya están como comida_rapida) y los DELETEs del caso C
 *   tampoco (ya borradas o nunca existieron). El SELECT envoltorio
 *   también se vuelve no-op.
 */

const CATEGORIAS_COMIDA_RAPIDA = [
  'Hamburguesas',
  'Perros Calientes',
  'Salchipapas',
  'Mazorcadas',
  'Picadas',
  'Patacones Rellenos',
  'Arepas Rellenas',
  'Tacos',
  'Burritos',
  'Quesadillas',
  'Nachos',
  'Empanadas y Fritos',
  'Chuzos y Pinchos',
  'Alitas y Pollo',
  'Sandwiches',
  'Wraps',
  'Pizzas',
  'Panzerottis',
  'Calzones',
  'Lasañas',
  'Pastas',
  'Acompañamientos',
  'Adiciones',
  'Bebidas',
  'Malteadas',
  'Postres',
  'Helados',
  'Combos',
  'Promociones',
];

/**
 * Nombres del catálogo transversal que ya tienen fila comida_rapida.
 * Devuelve array de strings (nombres), materializando la sub-consulta
 * para sortear el error "You can't specify target table for update in
 * FROM clause" de MySQL.
 */
async function nombresYaComidaRapida(knex) {
  const rows = await knex('categorias')
    .select('nombre')
    .where({ tipo_negocio: 'comida_rapida' })
    .whereNull('restaurante_id')
    .whereIn('nombre', CATEGORIAS_COMIDA_RAPIDA);
  return rows.map(r => r.nombre);
}

export async function up(knex) {
  const hasTable = await knex.schema.hasTable('categorias');
  if (!hasTable) return;

  const yaComidaRapida = await nombresYaComidaRapida(knex);

  // Caso A: filas del histórico que NO tienen duplicado en comida_rapida
  // → UPDATE a comida_rapida. Si la lista está vacía, el WHEREIn
  // resuelve a false y no se actualiza nada (no-op limpio).
  const updated = await knex('categorias')
    .whereIn('nombre', CATEGORIAS_COMIDA_RAPIDA)
    .where({ tipo_negocio: 'restaurante' })
    .whereNull('restaurante_id')
    .whereNotIn('nombre', yaComidaRapida.length ? yaComidaRapida : ['__none__'])
    .update({ tipo_negocio: 'comida_rapida' });

  // Caso C: filas del histórico 'restaurante' cuyo nombre YA tiene una
  // fila comida_rapida → DELETE la histórica.
  const deleted = yaComidaRapida.length
    ? await knex('categorias')
        .whereIn('nombre', yaComidaRapida)
        .where({ tipo_negocio: 'restaurante' })
        .whereNull('restaurante_id')
        .del()
    : 0;

  // eslint-disable-next-line no-console
  console.log(
    `[migración] ${updated} categorías reclasificadas a comida_rapida, ` +
    `${deleted} filas duplicadas eliminadas`
  );
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('categorias');
  if (!hasTable) return;

  // Para revertir: necesitamos saber qué nombres del catálogo transversal
  // ya tienen fila 'restaurante', para no crearles un duplicado.
  const yaRestauranteRows = await knex('categorias')
    .select('nombre')
    .where({ tipo_negocio: 'restaurante' })
    .whereNull('restaurante_id')
    .whereIn('nombre', CATEGORIAS_COMIDA_RAPIDA);
  const yaRestaurante = yaRestauranteRows.map(r => r.nombre);

  // Reverso del Caso A: comida_rapida → restaurante en filas del catálogo
  // transversal que NO tienen duplicado en restaurante. (Si ya existe,
  // añadir otra violaría el UNIQUE.)
  const updated = await knex('categorias')
    .whereIn('nombre', CATEGORIAS_COMIDA_RAPIDA)
    .where({ tipo_negocio: 'comida_rapida' })
    .whereNull('restaurante_id')
    .whereNotIn('nombre', yaRestaurante.length ? yaRestaurante : ['__none__'])
    .update({ tipo_negocio: 'restaurante' });

  // eslint-disable-next-line no-console
  console.log(`[migración rollback] ${updated} categorías devueltas a restaurante`);
}