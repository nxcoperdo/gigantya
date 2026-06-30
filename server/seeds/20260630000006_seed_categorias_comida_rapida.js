/**
 * Seed: catálogo transversal de categorías para locales de tipo
 * "Comida rápida".
 *
 * Estas categorías se comparten entre TODOS los locales con
 * `es_comida_rapida = 1`. No están asociadas a ningún restaurante
 * (`restaurante_id = NULL`) y se filtran por `tipo_negocio = 'comida_rapida'`.
 *
 * Idempotente: solo inserta las categorías que aún no existen (chequeo
 * por nombre + tipo_negocio). Re-ejecutable sin duplicar.
 *
 * Patrón: réplica de `server/seeds/20260630000002_seed_categorias_mercado.js`.
 */

const CATEGORIAS_COMIDA_RAPIDA = [
  { nombre: 'Hamburguesas',        descripcion: 'Hamburguesas clásicas, dobles, con queso, BBQ y especiales.',                       orden: 1  },
  { nombre: 'Perros Calientes',    descripcion: 'Perros y hot dogs con diversas salsas y toppings.',                                orden: 2  },
  { nombre: 'Salchipapas',         descripcion: 'Salchipapas, choripapas y combinaciones con papas.',                              orden: 3  },
  { nombre: 'Patacones',           descripcion: 'Patacones rellenos: carne, pollo, mixtos.',                                        orden: 4  },
  { nombre: 'Pizzas Rápidas',      descripcion: 'Pizzas personales y porcionadas, listas en pocos minutos.',                       orden: 5  },
  { nombre: 'Empanadas y Fritos',  descripcion: 'Empanadas, arepas rellenas, buñuelos y demás fritos.',                            orden: 6  },
  { nombre: 'Alitas y Pollo',      descripcion: 'Alitas BBQ, picantes, broaster y presas de pollo.',                               orden: 7  },
  { nombre: 'Combos',              descripcion: 'Combos personales, para dos y familiares.',                                        orden: 8  },
  { nombre: 'Adiciones',           descripcion: 'Papas extra, salsas, queso, tocineta y demás adiciones.',                         orden: 9  },
  { nombre: 'Bebidas',             descripcion: 'Gaseosas, jugos, agua y maltedas.',                                               orden: 10 },
  { nombre: 'Malteadas',           descripcion: 'Malteadas y smoothies.',                                                           orden: 11 },
  { nombre: 'Postres',             descripcion: 'Postres rápidos: helado, tortas, donas.',                                          orden: 12 },
];

export async function seed(knex) {
  for (const cat of CATEGORIAS_COMIDA_RAPIDA) {
    const existing = await knex('categorias')
      .where({ nombre: cat.nombre, tipo_negocio: 'comida_rapida' })
      .first();

    if (existing) continue;

    await knex('categorias').insert({
      restaurante_id: null,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: 'comida_rapida',
    });
  }
}