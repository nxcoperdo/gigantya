/**
 * Seed: catálogo transversal de categorías para locales de tipo
 * "Mercado y abarrotes".
 *
 * Estas categorías se comparten entre TODOS los locales con
 * `es_mercado_abarrotes = 1`. No están asociadas a ningún restaurante
 * (`restaurante_id = NULL`) y se filtran por `tipo_negocio = 'mercado'`.
 *
 * Idempotente: solo inserta las categorías que aún no existen (chequeo
 * por nombre + tipo_negocio). Re-ejecutable sin duplicar.
 */

const CATEGORIAS_MERCADO = [
  { nombre: 'Abarrotes',     descripcion: 'Productos de despensa general: arroz, aceite, granos, enlatados.', orden: 1  },
  { nombre: 'Verduras',      descripcion: 'Verduras frescas y de temporada.',                       orden: 2  },
  { nombre: 'Frutas',        descripcion: 'Frutas frescas y de temporada.',                         orden: 3  },
  { nombre: 'Lácteos',       descripcion: 'Leche, queso, yogurt y derivados.',                      orden: 4  },
  { nombre: 'Carnicería',    descripcion: 'Carnes rojas, pollo y cerdo frescos.',                   orden: 5  },
  { nombre: 'Panadería',     descripcion: 'Pan, arepas y productos de panadería.',                  orden: 6  },
  { nombre: 'Bebidas',       descripcion: 'Gaseosas, jugos, agua y bebidas en general.',            orden: 7  },
  { nombre: 'Limpieza',      descripcion: 'Productos de aseo para el hogar.',                       orden: 8  },
  { nombre: 'Aseo personal', descripcion: 'Productos de higiene personal.',                         orden: 9  },
  { nombre: 'Granos',        descripcion: 'Frijol, lenteja, garbanzo y otros granos secos.',        orden: 10 },
];

export async function seed(knex) {
  for (const cat of CATEGORIAS_MERCADO) {
    const existing = await knex('categorias')
      .where({ nombre: cat.nombre, tipo_negocio: 'mercado' })
      .first();

    if (existing) continue;

    await knex('categorias').insert({
      restaurante_id: null,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: 'mercado',
    });
  }
}