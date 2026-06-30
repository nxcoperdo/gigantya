/**
 * Seed: catálogo transversal de categorías para restaurantes (no solo comida
 * rápida).
 *
 * Estas categorías se comparten entre TODOS los locales con
 * `es_mercado_abarrotes = 0` (es decir, los restaurantes propiamente dichos).
 * No están asociadas a ningún restaurante (`restaurante_id = NULL`) y se
 * filtran por `tipo_negocio = 'restaurante'`.
 *
 * Catálogo paralelo al seed `20260630000002_seed_categorias_mercado.js`
 * (que cubre el nicho mercado y abarrotes). La convivencia entre ambos
 * nichos se garantiza con el UNIQUE constraint `(tipo_negocio, nombre)`
 * que ya está aplicado en la tabla `categorias` (migración
 * `20260630000003_unique_categoria_por_tipo_negocio.js`).
 *
 * Nombres ajustados para NO chocar con categorías propias que los
 * restaurantes ya hayan podido crear (ej. el seed de prueba
 * `create-test-credentials.js` crea "Bebidas", "Postres", "Comidas
 * Principales" propias del restaurante 1). Por eso esta base usa
 * "Bebidas y Jugos", "Postres y Dulces", "Pizzas y Pastas Horneadas",
 * etc. — variaciones que conviven sin romper el UNIQUE.
 *
 * Idempotente: cada INSERT se hace solo si no existe ya una fila con
 * ese `(nombre, tipo_negocio='restaurante')`. Re-ejecutable sin duplicar.
 */

const CATEGORIAS_RESTAURANTE = [
  {
    nombre: 'Entradas y Aperitivos',
    descripcion: 'Empanadas, arepas, patacones, pandebonos, buñuelos y otros pasabocas para abrir el apetito.',
    orden: 1,
  },
  {
    nombre: 'Sopas y Caldos',
    descripcion: 'Ajiaco, sancocho, mondongo, cazuela de mariscos, frijoles y otras sopas tradicionales.',
    orden: 2,
  },
  {
    nombre: 'Platos Fuertes — Carnes',
    descripcion: 'Bandeja paisa, lomo, sobrebarriga, carne asada, churrascos y cortes de res/cerdo.',
    orden: 3,
  },
  {
    nombre: 'Platos Fuertes — Pollo',
    descripcion: 'Pollo asado, pollo a la broaster, sudado de gallina, pollo guisado y preparados de pollo.',
    orden: 4,
  },
  {
    nombre: 'Platos Fuertes — Pescados y Mariscos',
    descripcion: 'Mojarra frita, tilapia, cazuela, ceviche, camarones y demás preparados de mar.',
    orden: 5,
  },
  {
    nombre: 'Platos Típicos Colombianos',
    descripcion: 'Ajiaco, tamales, lechona, mute, viudo de pescado, mucuna y demás platos tradicionales por región.',
    orden: 6,
  },
  {
    nombre: 'Pastas y Lasañas',
    descripcion: 'Lasañas, espaguetis, raviolis, fetuccinis, canelones y demás pastas italianas.',
    orden: 7,
  },
  {
    nombre: 'Pizzas y Pastas Horneadas',
    descripcion: 'Pizzas tradicionales, panzerottis, calzones y demás preparaciones horneadas al estilo italiano.',
    orden: 8,
  },
  {
    nombre: 'Comida Rápida',
    descripcion: 'Hamburguesas, perros calientes, salchipapas, chuzos y otros preparados para entrega rápida.',
    orden: 9,
  },
  {
    nombre: 'Ensaladas y Vegetarianos',
    descripcion: 'Ensaladas frescas, bowls vegetarianos, wraps de verduras y opciones sin carne.',
    orden: 10,
  },
  {
    nombre: 'Guarniciones y Acompañamientos',
    descripcion: 'Arroz, papa criolla, yuca frita, plátano maduro, hogao y demás acompañamientos.',
    orden: 11,
  },
  {
    nombre: 'Bebidas y Jugos',
    descripcion: 'Gaseosas, jugos naturales en agua o leche, agua, hidratantes y demás bebidas frías.',
    orden: 12,
  },
  {
    nombre: 'Postres y Dulces',
    descripcion: 'Tres leches, flan, natilla, brevas con arequipe, bocadillo con queso y dulces artesanales.',
    orden: 13,
  },
  {
    nombre: 'Menú Infantil',
    descripcion: 'Platos pensados para niños: nuggets, mini-pizzas, dedos de queso, porción pequeña de arroz con pollo.',
    orden: 14,
  },
];

export async function seed(knex) {
  for (const cat of CATEGORIAS_RESTAURANTE) {
    const existing = await knex('categorias')
      .where({ nombre: cat.nombre, tipo_negocio: 'restaurante' })
      .first();

    if (existing) continue;

    await knex('categorias').insert({
      restaurante_id: null,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: 'restaurante',
    });
  }
}