/**
 * Seed: agrega 5 categorías catálogo adicionales para el nicho mercado,
 * basadas en la estructura típica de supermercados colombianos
 * (Éxito / Carulla / Jumbo): Congelados, Snacks, Licores, Bebé, Mascotas.
 *
 * Complementa al seed `20260630000002_seed_categorias_mercado.js` (10
 * categorías base). Es idempotente: cada INSERT se hace solo si no existe
 * ya una fila con ese (nombre, tipo_negocio='mercado').
 *
 * Si más adelante se quieren agregar más categorías, se puede crear un
 * seed adicional con timestamp posterior siguiendo el mismo patrón.
 */

const CATEGORIAS_MERCADO_EXTRA = [
  {
    nombre: 'Congelados',
    descripcion: 'Helados, verduras congeladas, pollo congelado, pescado congelado, platos preparados.',
    orden: 11,
    icon: 'Snowflake',
  },
  {
    nombre: 'Snacks',
    descripcion: 'Galletas, papas fritas, chocolates, dulces, frutos secos, confitería.',
    orden: 12,
    icon: 'Cookie',
  },
  {
    nombre: 'Licores',
    descripcion: 'Vinos, whisky, vodka, ron, aguardiente, cerveza, champaña.',
    orden: 13,
    icon: 'Wine',
  },
  {
    nombre: 'Bebé',
    descripcion: 'Pañales, alimentos infantiles, artículos de aseo para bebé.',
    orden: 14,
    icon: 'Baby',
  },
  {
    nombre: 'Mascotas',
    descripcion: 'Alimento y productos de aseo para perros, gatos y otras mascotas.',
    orden: 15,
    icon: 'PawPrint',
  },
];

export async function seed(knex) {
  for (const cat of CATEGORIAS_MERCADO_EXTRA) {
    const existing = await knex('categorias')
      .where({ nombre: cat.nombre, tipo_negocio: 'mercado' })
      .first();

    if (existing) {
      continue;
    }

    await knex('categorias').insert({
      restaurante_id: null,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: 'mercado',
    });
  }
}
