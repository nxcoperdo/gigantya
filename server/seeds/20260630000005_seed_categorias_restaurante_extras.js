/**
 * Seed: 6 categorías catálogo adicionales para el nicho restaurante,
 * basadas en la estructura típica de cartas colombianas (restaurantes
 * a la carta, cafeterías y menú del día).
 *
 * Complementa al seed `20260630000004_seed_categorias_restaurante.js`
 * (14 categorías base). Idempotente: cada INSERT se hace solo si no
 * existe ya una fila con `(nombre, tipo_negocio='restaurante')`.
 *
 * Si más adelante se quieren agregar más categorías, se puede crear un
 * seed adicional con timestamp posterior siguiendo el mismo patrón.
 */

const CATEGORIAS_RESTAURANTE_EXTRA = [
  {
    nombre: 'Desayunos',
    descripcion: 'Calentado, huevos pericos, arepa con queso, pan con chocolate y demás opciones de desayuno.',
    orden: 15,
  },
  {
    nombre: 'Almuerzos Ejecutivos',
    descripcion: 'Menú del día o almuerzo ejecutivo: sopa, principio, carne, arroz, ensalada y bebida.',
    orden: 16,
  },
  {
    nombre: 'Comida Vegana',
    descripcion: 'Opciones 100% veganas (sin ingredientes de origen animal): bowls, hamburguesas de lenteja, leches vegetales.',
    orden: 17,
  },
  {
    nombre: 'Café y Bebidas Calientes',
    descripcion: 'Café colombiano, tinto, aromática, chocolate caliente con queso, té, infusiones.',
    orden: 18,
  },
  {
    nombre: 'Cócteles y Jugos Naturales',
    descripcion: 'Cócteles sin alcohol, limonadas, jugos de frutas tropicales, smoothies y batidos.',
    orden: 19,
  },
  {
    nombre: 'Piqueos y Pasabocas',
    descripcion: 'Platos para compartir: nachos, alitas, dedos de queso, mini-empanadas, chips de yuca.',
    orden: 20,
  },
];

export async function seed(knex) {
  for (const cat of CATEGORIAS_RESTAURANTE_EXTRA) {
    const existing = await knex('categorias')
      .where({ nombre: cat.nombre, tipo_negocio: 'restaurante' })
      .first();

    if (existing) {
      continue;
    }

    await knex('categorias').insert({
      restaurante_id: null,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: 'restaurante',
    });
  }
}