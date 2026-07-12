/**
 * Seed: menú completo de la hamburguesería "AMAPOLA".
 *
 * Carga todas las categorías, productos y modificadores del menú de
 * AMAPOLA para el restaurante del usuario con `usuario_id = 17`.
 *
 * Convenciones del proyecto (verificadas en el código y otros seeds):
 *   - `categorias`: UNIQUE (restaurante_id, nombre). Cada categoría va
 *     asociada a `restaurante_id` (no es catálogo transversal).
 *   - `productos`: FK a `categoria_id` (nullable). precio es DECIMAL(10,2).
 *   - `producto_grupos_adiciones` y `producto_adiciones`: definidos por
 *     las migraciones `20260708000001_modificadores_producto.js` y
 *     `20260709000001_modificadores_obligatoriedad.js`.
 *   - `restaurantes.usuario_id` es UNIQUE — un usuario tiene a lo sumo
 *     un restaurante. La resolución de R se hace por `usuario_id = 17`.
 *
 * Decisión de modelado: NO existe tabla de opciones con precio distinto
 * (X1/X2 de salchipapas, P/1L/2L de jugos). Se modelan como PRODUCTOS
 * SEPARADOS en la misma categoría (más simple, decisión del usuario).
 *
 * Idempotencia:
 *   - Antes de cada INSERT se chequea existencia con `.first()`. Si
 *     existe, se skipea con un log. Re-ejecutable sin duplicar.
 *   - NO usa transacciones explícitas — Knex wrappea cada seed.
 *
 * Plan Free:
 *   - Si el restaurante es plan Free, el límite de catálogo es 10
 *     productos activos. Si ya tiene 10+ y este seed metería más,
 *     se aborta con un error explicativo.
 *   - Planes pago: sin límite.
 *
 * UTF-8: el archivo está en UTF-8 para que los strings con tildes
 * ("Pechuga Asada", "Limonada Hierbabuena", "Tequila Sunrise") se
 * persistan correctamente.
 */

// =====================================================================
// CONSTANTES
// =====================================================================

/**
 * Categorías del menú en el orden que pidió el usuario.
 * `key` es el identificador interno (string) que referenciamos desde
 * PRODUCTOS para resolver `categoria_id` por nombre.
 */
const CATEGORIAS = [
  { key: 'costillas',  nombre: 'COSTILLAS BBQ Y ALITAS',  descripcion: 'Costillas y alitas BBQ.',                          orden: 1  },
  { key: 'mazorcadas', nombre: 'MAZORCADAS',              descripcion: 'Mazorcadas y desgranados.',                          orden: 2  },
  { key: 'perros',     nombre: 'PERROS',                  descripcion: 'Perros calientes.',                                  orden: 3  },
  { key: 'entradas',   nombre: 'ENTRADAS',                descripcion: 'Papas americanas, aros de cebolla, dedos de queso.', orden: 4  },
  { key: 'infantil',   nombre: 'MENÚ INFANTIL',           descripcion: 'Opciones para niños.',                               orden: 5  },
  { key: 'picada',     nombre: 'PICADA',                  descripcion: 'Picadas para compartir.',                            orden: 6  },
  { key: 'plancha',    nombre: 'PLANCHA',                 descripcion: 'Carnes y pechugas a la plancha.',                    orden: 7  },
  { key: 'adiciones',  nombre: 'ADICIONES',               descripcion: 'Porciones extra y acompañamientos.',                 orden: 8  },
  { key: 'bebidas',    nombre: 'BEBIDAS',                 descripcion: 'Gaseosas, jugos, limonadas, cervezas y cocteles.',   orden: 9  },
  { key: 'hamburguesas', nombre: 'HAMBURGUESAS',          descripcion: 'Hamburguesas con adiciones opcionales.',             orden: 10 },
  { key: 'salchipapas',  nombre: 'SALCHIPAPAS',           descripcion: 'Salchipapas en sus distintas versiones.',            orden: 11 },
];

/**
 * Productos del menú. Cada uno referencia la categoría por `key`
 * (mapeo al inicio del seed).
 *
 * ⚠️ CONVENCIÓN DE PRECIOS: el menú del local expresa los precios en
 * miles de pesos colombianos ("$15k" = 15.000 COP). Como la columna
 * `precio` es DECIMAL(10,2) y guarda el valor REAL en pesos, todos los
 * precios de este array van multiplicados por 1000. Ej: $15k → 15000.00.
 * NO usar separador de miles ni símbolo "$" — es un número plano.
 */
const PRODUCTOS = [
  // COSTILLAS BBQ Y ALITAS
  { categoria_key: 'costillas',  nombre: 'Costillas BBQ',            precio: 24000.00 },
  { categoria_key: 'costillas',  nombre: 'Alas BBQ o Miel Mostaza',  precio: 22000.00 },

  // MAZORCADAS
  { categoria_key: 'mazorcadas', nombre: 'Mazorcada',                precio: 24000.00 },
  { categoria_key: 'mazorcadas', nombre: 'Desgranado',               precio: 26000.00 },

  // PERROS
  { categoria_key: 'perros',     nombre: 'Perro Clásico',            precio: 13000.00 },
  { categoria_key: 'perros',     nombre: 'Perro Criollo',            precio: 16000.00 },
  { categoria_key: 'perros',     nombre: 'Perro Mexicano',           precio: 18000.00 },

  // ENTRADAS
  { categoria_key: 'entradas',   nombre: 'Papas Americanas',         precio: 8000.00  },
  { categoria_key: 'entradas',   nombre: 'Aros de Cebolla',          precio: 8000.00  },
  { categoria_key: 'entradas',   nombre: 'Dedos de Queso',           precio: 9000.00  },

  // MENÚ INFANTIL
  { categoria_key: 'infantil',   nombre: 'Burger Junior',            precio: 13000.00 },
  { categoria_key: 'infantil',   nombre: 'Nuggets',                  precio: 13000.00 },

  // PICADA
  { categoria_key: 'picada',     nombre: 'Picada Cremosa x2',        precio: 44000.00 },
  { categoria_key: 'picada',     nombre: 'Butifarra (5 und)',        precio: 15000.00 },

  // PLANCHA
  { categoria_key: 'plancha',    nombre: 'Churrasco',                precio: 34000.00 },
  { categoria_key: 'plancha',    nombre: 'Pechuga Asada',            precio: 26000.00 },
  { categoria_key: 'plancha',    nombre: 'Pechuga Gratinada',        precio: 30000.00 },
  { categoria_key: 'plancha',    nombre: 'Pechuga Hawaiana',         precio: 32000.00 },

  // ADICIONES (vendibles como productos sueltos)
  { categoria_key: 'adiciones',  nombre: 'Porción de Papa',          precio: 5000.00  },
  { categoria_key: 'adiciones',  nombre: 'Carne Burguer',            precio: 6000.00  },
  { categoria_key: 'adiciones',  nombre: 'Huevo',                    precio: 1500.00  },
  { categoria_key: 'adiciones',  nombre: 'Tocineta',                 precio: 2000.00  },
  { categoria_key: 'adiciones',  nombre: 'Chorizo',                  precio: 5000.00  },
  { categoria_key: 'adiciones',  nombre: 'Jalapeño',                 precio: 2000.00  },
  { categoria_key: 'adiciones',  nombre: 'Salsa de la Casa',         precio: 2000.00  },

  // BEBIDAS
  { categoria_key: 'bebidas',    nombre: 'Botella Agua',             precio: 4000.00  },
  { categoria_key: 'bebidas',    nombre: 'Bretaña',                  precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Limonada Coco',            precio: 13000.00 },
  { categoria_key: 'bebidas',    nombre: 'Limonada Cerezada',        precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Limonada Tradicional',     precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Limonada Hierbabuena',     precio: 7000.00  },
  { categoria_key: 'bebidas',    nombre: 'Coca-Cola 1.5L',           precio: 10000.00 },
  { categoria_key: 'bebidas',    nombre: 'Gaseosa Personal',         precio: 4500.00  },
  { categoria_key: 'bebidas',    nombre: 'Hit Caja Litro',           precio: 10000.00 },
  { categoria_key: 'bebidas',    nombre: 'Hit Personal',             precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Soda Maracuyá',            precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Soda Frutos Rojos',        precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Soda Cereza',              precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Cerveza Águila',           precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Cerveza Club',             precio: 6000.00  },
  { categoria_key: 'bebidas',    nombre: 'Cerveza Corona',           precio: 9000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Maracuyá P',          precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Maracuyá 1L',         precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Maracuyá 2L',         precio: 14000.00 },
  { categoria_key: 'bebidas',    nombre: 'Jugo Cholupa P',           precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Cholupa 1L',          precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Cholupa 2L',          precio: 14000.00 },
  { categoria_key: 'bebidas',    nombre: 'Jugo Limonada P',          precio: 5000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Limonada 1L',         precio: 8000.00  },
  { categoria_key: 'bebidas',    nombre: 'Jugo Limonada 2L',         precio: 14000.00 },
  { categoria_key: 'bebidas',    nombre: 'Mojito Clásico',           precio: 18000.00 },
  { categoria_key: 'bebidas',    nombre: 'Mojito Maracuyá',          precio: 20000.00 },
  { categoria_key: 'bebidas',    nombre: 'Tequila Sunrise',          precio: 17000.00 },

  // HAMBURGUESAS (todas reciben luego un grupo "Adiciones" con 7 items)
  { categoria_key: 'hamburguesas', nombre: 'Clásica',               precio: 15500.00 },
  { categoria_key: 'hamburguesas', nombre: 'Texas',                precio: 17500.00 },
  { categoria_key: 'hamburguesas', nombre: 'Brooklyn',             precio: 19000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Mexicana',             precio: 19000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Montana',              precio: 21000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Kentucky',             precio: 19500.00 },
  { categoria_key: 'hamburguesas', nombre: 'New York',             precio: 20000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Buti Hot',             precio: 20000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Crispy Crunch',        precio: 20000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Pork BBQ (NEW)',       precio: 20000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Emperatriz',           precio: 21500.00 },
  { categoria_key: 'hamburguesas', nombre: 'Crispy Pollo Ranch',   precio: 22000.00 },
  { categoria_key: 'hamburguesas', nombre: 'Doble Suprema',        precio: 23500.00 },
  { categoria_key: 'hamburguesas', nombre: 'Trilogía',             precio: 23000.00 },

  // SALCHIPAPAS (X1 / X2 modelados como productos separados)
  { categoria_key: 'salchipapas',  nombre: 'Clásica',             precio: 14000.00 },
  { categoria_key: 'salchipapas',  nombre: 'De la Casa X1',       precio: 21500.00 },
  { categoria_key: 'salchipapas',  nombre: 'De la Casa X2',       precio: 39000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Mexicana X1',         precio: 21500.00 },
  { categoria_key: 'salchipapas',  nombre: 'Mexicana X2',         precio: 39000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Ranchera X1',         precio: 24000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Ranchera X2',         precio: 44000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Chicharrón X1',       precio: 23000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Chicharrón X2',       precio: 42000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Carnívora X1',        precio: 23000.00 },
  { categoria_key: 'salchipapas',  nombre: 'Carnívora X2',        precio: 40000.00 },
];

/**
 * Adiciones estándar de cada hamburguesa.
 * El orden en este array es el `orden` que recibe cada adición dentro
 * del grupo "Adiciones" de cada hamburguesa.
 *
 * ⚠️ Misma convención que en PRODUCTOS: precios en pesos colombianos
 * (ya multiplicados por 1000). Ej: $1.5k → 1500.00.
 */
const ADICIONES_HAMBURGUESA = [
  { nombre: 'Huevo',            precio_extra: 1500.00, orden: 0 },
  { nombre: 'Tocineta',         precio_extra: 2000.00, orden: 1 },
  { nombre: 'Chorizo',          precio_extra: 5000.00, orden: 2 },
  { nombre: 'Jalapeño',         precio_extra: 2000.00, orden: 3 },
  { nombre: 'Salsa de la Casa', precio_extra: 2000.00, orden: 4 },
  { nombre: 'Carne Burguer',    precio_extra: 6000.00, orden: 5 },
  { nombre: 'Porción de Papa',  precio_extra: 5000.00, orden: 6 },
];

// =====================================================================
// SEED
// =====================================================================

/**
 * Ejecuta el seed. Knex lo llama con la instancia configurada del
 * `knexfile.js`. La función es async; los INSERTs se encadenan
 * secuencialmente.
 */
export async function seed(knex) {
  // -----------------------------------------------------------------
  // a) Resolver restaurante del usuario 17 (sin hardcodear IDs)
  // -----------------------------------------------------------------
  const usuario = await knex('usuarios').where({ id: 17 }).first();
  if (!usuario) {
    throw new Error('No existe usuario 17');
  }

  const restaurante = await knex('restaurantes').where({ usuario_id: 17 }).first();
  if (!restaurante) {
    throw new Error('Usuario 17 no tiene restaurante');
  }

  const R = restaurante.id;

  // Detectar el nicho del restaurante para asignar correctamente el
  // `tipo_negocio` de las categorías que vamos a crear/reusar. El UNIQUE
  // de la tabla es (tipo_negocio, nombre), así que si el restaurante es
  // comida rápida las categorías van con tipo_negocio='comida_rapida'
  // y reusan las globales (Hamburguesas, Salchipapas, Bebidas, etc.).
  // El orden de prioridad es comida_rapida > mercado > restaurante,
  // porque un local no suele ser mercado y comida rápida al mismo tiempo.
  let tipoNegocio = 'restaurante';
  if (restaurante.es_comida_rapida) {
    tipoNegocio = 'comida_rapida';
  } else if (restaurante.es_mercado_abarrotes) {
    tipoNegocio = 'mercado';
  }
  console.log(
    `[seed_amapola] Restaurante id=${R}, plan='${restaurante.plan}', ` +
    `es_comida_rapida=${restaurante.es_comida_rapida || 0}, ` +
    `es_mercado_abarrotes=${restaurante.es_mercado_abarrotes || 0}, ` +
    `es_restaurante=${restaurante.es_restaurante || 0} → tipo_negocio='${tipoNegocio}'`
  );

  // Si el restaurante NO tiene ningún flag de nicho puesto, es un caso
  // anómalo (el admin debería haber marcado el nicho). No fallamos
  // (es un seed, no un script crítico), pero dejamos WARNING visible
  // para que el usuario lo arregle desde el panel admin.
  if (!restaurante.es_comida_rapida && !restaurante.es_mercado_abarrotes && !restaurante.es_restaurante) {
    console.warn(
      `[seed_amapola] El restaurante ${R} no tiene NINGÚN flag de nicho ` +
      `(es_comida_rapida, es_mercado_abarrotes, es_restaurante). Las categorías ` +
      `se crearán con tipo_negocio='${tipoNegocio}' por default. Marcá el nicho ` +
      `correspondiente desde el panel admin.`
    );
  }

  if (restaurante.nombre !== 'AMAPOLA') {
    console.warn(
      `[seed_amapola] Restaurante del usuario 17 se llama "${restaurante.nombre}", se esperaba AMAPOLA. Continuando de todas formas.`,
    );
  }

  // -----------------------------------------------------------------
  // b) Check plan Free (límite de 10 productos activos)
  // -----------------------------------------------------------------
  if (restaurante.plan === 'free') {
    const [{ total }] = await knex('productos')
      .where({ restaurante_id: R, estado: 'activo' })
      .count({ total: '*' });
    const yaTiene = Number(total) || 0;
    const aInsertar = PRODUCTOS.length;
    if (yaTiene + aInsertar > 10) {
      throw new Error(
        `[seed_amapola] El restaurante del usuario 17 es plan Free. ` +
        `Ya tiene ${yaTiene} productos activos y este seed intentaría ` +
        `insertar ${aInsertar} más (total ${yaTiene + aInsertar}), lo que ` +
        `supera el límite de 10 del plan Free. Cambiá a un plan pago o ` +
        `eliminá productos antes de correr este seed.`,
      );
    }
    console.log(
      `[seed_amapola] Plan Free: ${yaTiene} productos preexistentes, ${aInsertar} a insertar = ${yaTiene + aInsertar} (límite 10). OK.`,
    );
  }

  // -----------------------------------------------------------------
  // c) Insertar categorías (idempotente por tipo_negocio + nombre)
  //
  //    ⚠️ El UNIQUE de la tabla es (tipo_negocio, nombre), NO
  //    (restaurante_id, nombre). El seed debe:
  //    1. Buscar la categoría por (tipo_negocio, nombre) case-insensitive
  //       usando el nicho detectado del restaurante.
  //    2. Si existe, REUTILIZAR su id (sea global con restaurante_id=NULL
  //       o propia del restaurante con restaurante_id=R).
  //    3. Si NO existe, crearla con tipo_negocio=<nicho del restaurante>
  //       y restaurante_id=R.
  //
  //    Beneficio: Amapola (comida_rapida) reusa las categorías globales
  //    del catálogo de comida_rapida (Hamburguesas, Salchipapas, Bebidas,
  //    etc.) sin chocar con el UNIQUE.
  // -----------------------------------------------------------------
  const categoriaIdByKey = {};
  let catInsertadas = 0;
  let catExistentes = 0;

  for (const cat of CATEGORIAS) {
    // Búsqueda case-insensitive con collation utf8mb4_unicode_ci (default).
    // MySQL ya es case-insensitive por default, pero usamos LOWER() para
    // ser explícitos y robustos.
    const existing = await knex('categorias')
      .where({ tipo_negocio: tipoNegocio })
      .whereRaw('LOWER(nombre) = ?', [cat.nombre.toLowerCase()])
      .first();
    if (existing) {
      categoriaIdByKey[cat.key] = existing.id;
      catExistentes += 1;
      console.log(
        `[seed_amapola] Categoría ya existente (reusada, id=${existing.id}, ` +
        `restaurante_id=${existing.restaurante_id ?? 'NULL'}): ${cat.nombre}`
      );
      continue;
    }
    const [insertedId] = await knex('categorias').insert({
      restaurante_id: R,
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      orden: cat.orden,
      tipo_negocio: tipoNegocio,
    });
    categoriaIdByKey[cat.key] = insertedId;
    catInsertadas += 1;
    console.log(`[seed_amapola] Insertada categoría: ${cat.nombre} (orden ${cat.orden})`);
  }

  // -----------------------------------------------------------------
  // d) Insertar productos (idempotente por restaurante_id + nombre)
  // -----------------------------------------------------------------
  const productoIdByName = {};
  let prodInsertados = 0;
  let prodExistentes = 0;

  for (const prod of PRODUCTOS) {
    const categoriaId = categoriaIdByKey[prod.categoria_key];
    if (!categoriaId) {
      throw new Error(
        `[seed_amapola] Categoría "${prod.categoria_key}" no resuelta. ` +
        `Esto no debería pasar si CATEGORIAS está bien definido.`,
      );
    }
    const existing = await knex('productos')
      .where({ restaurante_id: R, nombre: prod.nombre })
      .first();
    if (existing) {
      productoIdByName[prod.nombre] = existing.id;
      prodExistentes += 1;
      console.log(`[seed_amapola] Producto ya existente, skip: ${prod.nombre}`);
      continue;
    }
    const [insertedId] = await knex('productos').insert({
      restaurante_id: R,
      categoria_id: categoriaId,
      nombre: prod.nombre,
      descripcion: null,
      precio: prod.precio,
      imagen_url: null,
      disponible: true,
      estado: 'activo',
    });
    productoIdByName[prod.nombre] = insertedId;
    prodInsertados += 1;
    console.log(`[seed_amapola] Insertado producto: ${prod.nombre} ($${prod.precio.toFixed(2)})`);
  }

  // -----------------------------------------------------------------
  // e) Para cada hamburguesa: grupo "Adiciones" + 7 adiciones
  //    Idempotencia: si ya existe el grupo "Adiciones" para ese
  //    producto_id, lo reutilizamos y skipeamos la creación de
  //    adiciones faltantes que también estén por nombre.
  // -----------------------------------------------------------------
  let gruposCreados = 0;
  let gruposExistentes = 0;
  let adicionesCreadas = 0;
  let adicionesExistentes = 0;

  const hamburguesas = PRODUCTOS.filter((p) => p.categoria_key === 'hamburguesas');

  for (const h of hamburguesas) {
    const productoId = productoIdByName[h.nombre];
    if (!productoId) continue; // skip silencioso: hamburguesa no insertada

    // ¿Ya existe el grupo "Adiciones" para este producto?
    let grupo = await knex('producto_grupos_adiciones')
      .where({ producto_id: productoId, nombre: 'Adiciones' })
      .first();

    if (grupo) {
      gruposExistentes += 1;
    } else {
      const [grupoId] = await knex('producto_grupos_adiciones').insert({
        producto_id: productoId,
        nombre: 'Adiciones',
        orden: 0,
        activo: true,
        obligatorio: false,
        min_selecciones: 0,
        max_selecciones: 99,
      });
      grupo = { id: grupoId };
      gruposCreados += 1;
      console.log(`[seed_amapola] Insertado grupo "Adiciones" en hamburguesa: ${h.nombre}`);
    }

    // Adiciones del grupo (idempotente por (producto_id, nombre))
    for (const ad of ADICIONES_HAMBURGUESA) {
      const existingAd = await knex('producto_adiciones')
        .where({ producto_id: productoId, nombre: ad.nombre })
        .first();
      if (existingAd) {
        // Si existe pero no estaba en este grupo, lo re-asignamos
        // (migrar el grupo_id). Esto pasa si el seed se corre una
        // segunda vez con estado inconsistente.
        if (existingAd.grupo_id !== grupo.id) {
          await knex('producto_adiciones')
            .where({ id: existingAd.id })
            .update({ grupo_id: grupo.id, orden: ad.orden, activo: true });
        }
        adicionesExistentes += 1;
        continue;
      }
      await knex('producto_adiciones').insert({
        producto_id: productoId,
        grupo_id: grupo.id,
        nombre: ad.nombre,
        precio_extra: ad.precio_extra,
        orden: ad.orden,
        activo: true,
      });
      adicionesCreadas += 1;
    }
  }

  // -----------------------------------------------------------------
  // Resumen final
  // -----------------------------------------------------------------
  console.log(
    `\n[seed_amapola] Resumen: ${catInsertadas + catExistentes} categorías ` +
    `(${catInsertadas} nuevas, ${catExistentes} existentes), ` +
    `${prodInsertados + prodExistentes} productos ` +
    `(${prodInsertados} nuevos, ${prodExistentes} existentes), ` +
    `${gruposCreados + gruposExistentes} grupos de adiciones ` +
    `(${gruposCreados} nuevos, ${gruposExistentes} existentes), ` +
    `${adicionesCreadas + adicionesExistentes} adiciones ` +
    `(${adicionesCreadas} nuevas, ${adicionesExistentes} existentes).\n`,
  );
}
