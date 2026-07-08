/**
 * Migración: modificadores de producto (estilo Rappi/PedidosYa).
 *
 * Crea la infraestructura para que el local pueda configurar por
 * producto:
 *   - Grupos opcionales de adiciones (ej. "Salsas", "Extras").
 *   - Adiciones sueltas o agrupadas (ej. "Mayo", "Queso extra"
 *     con precio_extra nullable = gratis).
 *   - Ingredientes removibles (ej. "Cebolla", "Tomate") que el
 *     cliente puede desmarcar.
 *
 * Y para que el pedido guarde de forma estructurada las elecciones
 * del cliente (en vez de notas de texto libre):
 *   - items_pedido_adiciones: snapshot de cada adición elegida con
 *     cantidad y precio (necesita trazabilidad histórica porque
 *     factura).
 *   - items_pedido.removidos_json: JSON con los removibles
 *     desmarcdos (no factura, JSON alcanza).
 *   - items_pedido.especificaciones: ya existía, lo empezamos a
 *     poblar con la nota libre del item.
 *
 * Idempotente: si cualquier tabla/columna ya existe, no la tocamos.
 * Caso raro: DB de dev con schema.sql viejo.
 */
export async function up(knex) {
  // 1. PRODUCTO_GRUPOS_ADICIONES
  if (!(await knex.schema.hasTable('producto_grupos_adiciones'))) {
    await knex.schema.createTable('producto_grupos_adiciones', (table) => {
      table.increments('id').primary();
      table.integer('producto_id').unsigned().notNullable();
      table.string('nombre', 100).notNullable();
      table.integer('orden').notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('producto_id', 'fk_grupos_ad_producto')
        .references('id').inTable('productos').onDelete('CASCADE');
      table.index(['producto_id', 'orden'], 'idx_grupo_ad_producto');
    });
  }

  // 2. PRODUCTO_ADICIONES
  if (!(await knex.schema.hasTable('producto_adiciones'))) {
    await knex.schema.createTable('producto_adiciones', (table) => {
      table.increments('id').primary();
      table.integer('producto_id').unsigned().notNullable();
      // grupo_id NULL = adición suelta (sin grupo)
      table.integer('grupo_id').unsigned().nullable();
      table.string('nombre', 150).notNullable();
      // precio_extra NULL = gratis (ej. "Con limón"). Decimal para
      // soportar pesos colombianos sin problemas de redondeo.
      table.decimal('precio_extra', 10, 2).nullable();
      table.integer('orden').notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('producto_id', 'fk_adiciones_producto')
        .references('id').inTable('productos').onDelete('CASCADE');
      // SET NULL: si el local borra el grupo, las adiciones sueltas
      // sobreviven (pasan a ser sueltas).
      table.foreign('grupo_id', 'fk_adiciones_grupo')
        .references('id').inTable('producto_grupos_adiciones').onDelete('SET NULL');
      table.index(['producto_id', 'orden'], 'idx_ad_producto');
      table.index('grupo_id', 'idx_ad_grupo');
    });
  }

  // 3. PRODUCTO_INGREDIENTES_REMOVIBLES
  if (!(await knex.schema.hasTable('producto_ingredientes_removibles'))) {
    await knex.schema.createTable('producto_ingredientes_removibles', (table) => {
      table.increments('id').primary();
      table.integer('producto_id').unsigned().notNullable();
      table.string('nombre', 150).notNullable();
      table.integer('orden').notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('producto_id', 'fk_removibles_producto')
        .references('id').inTable('productos').onDelete('CASCADE');
      table.index(['producto_id', 'orden'], 'idx_rem_producto');
    });
  }

  // 4. ITEMS_PEDIDO_ADICIONES
  // Snapshot: guardamos nombre y precio al momento del pedido
  // (en vez de JOIN a producto_adiciones) para que un cambio
  // posterior del local no altere el pedido histórico.
  if (!(await knex.schema.hasTable('items_pedido_adiciones'))) {
    await knex.schema.createTable('items_pedido_adiciones', (table) => {
      table.increments('id').primary();
      table.integer('item_pedido_id').unsigned().notNullable();
      table.integer('adicion_id').unsigned().notNullable();
      table.string('nombre', 150).notNullable();
      // Snapshot del nombre del grupo de la adición al momento del
      // pedido (NULL = adición suelta, sin grupo). El render del
      // ticket lo usa para mostrar el heading del grupo. Si el local
      // edita el nombre del grupo después, el pedido histórico no se
      // ve afectado — mismo principio que `nombre` y `precio_extra`.
      table.string('grupo_nombre', 100).nullable();
      table.decimal('precio_unitario_adicion', 10, 2).notNullable();
      table.integer('cantidad').notNullable().defaultTo(1);
      table.decimal('subtotal', 10, 2).notNullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('item_pedido_id', 'fk_item_pedido_ad_item')
        .references('id').inTable('items_pedido').onDelete('CASCADE');
      // RESTRICT: no se puede borrar una adición que ya está
      // referenciada en pedidos. La baja se hace con activo=0.
      table.foreign('adicion_id', 'fk_item_pedido_ad_adicion')
        .references('id').inTable('producto_adiciones').onDelete('RESTRICT');
      table.index('item_pedido_id', 'idx_item_pedido_ad');
      table.index('adicion_id', 'idx_adicion_en_items');
    });
  } else if (!(await knex.schema.hasColumn('items_pedido_adiciones', 'grupo_nombre'))) {
    // Tabla ya existía (creada por la versión anterior de la migración
    // o por SQL manual) → agregamos la columna sin tocar el resto.
    await knex.schema.alterTable('items_pedido_adiciones', (table) => {
      table.string('grupo_nombre', 100).nullable();
    });
  }

  // 5. items_pedido.removidos_json
  // JSON con [{id, nombre}] de los ingredientes removibles que el
  // cliente quitó. No factura, así que no necesita tabla propia.
  if (!(await knex.schema.hasColumn('items_pedido', 'removidos_json'))) {
    await knex.schema.alterTable('items_pedido', (table) => {
      table.text('removidos_json').nullable();
    });
  }
}

export async function down(knex) {
  if (await knex.schema.hasColumn('items_pedido', 'removidos_json')) {
    await knex.schema.alterTable('items_pedido', (table) => {
      table.dropColumn('removidos_json');
    });
  }
  if (await knex.schema.hasColumn('items_pedido_adiciones', 'grupo_nombre')) {
    await knex.schema.alterTable('items_pedido_adiciones', (table) => {
      table.dropColumn('grupo_nombre');
    });
  }
  await knex.schema.dropTableIfExists('items_pedido_adiciones');
  await knex.schema.dropTableIfExists('producto_ingredientes_removibles');
  await knex.schema.dropTableIfExists('producto_adiciones');
  await knex.schema.dropTableIfExists('producto_grupos_adiciones');
}
