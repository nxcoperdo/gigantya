/**
 * Migración: sistema de direcciones por sectores/barrios y envíos por sector.
 *
 * Crea tres tablas nuevas y agrega columnas FK a tablas existentes:
 *   - `sectores`                : sectores globales de la ciudad (Centro, Sur, Norte, etc.)
 *   - `barrios`                 : barrios globales vinculados a un sector
 *   - `restaurante_envios_sector` : costo de envío por restaurante por sector
 *   - `direcciones.barrio_id`   : FK opcional para asociar cada dirección a un barrio
 *   - `pedidos.barrio_id` y `pedidos.sector_id` : snapshot del barrio/sector al momento del pedido
 *
 * Compatibilidad: las direcciones y pedidos existentes quedan con barrio_id = NULL
 * (el sistema sigue funcionando y usa el costo_fijo global como fallback).
 */
export async function up(knex) {
  // 1. Tabla `sectores`
  const hasSectores = await knex.schema.hasTable('sectores');
  if (!hasSectores) {
    await knex.schema.createTable('sectores', (table) => {
      table.increments('id').primary();
      table.string('nombre', 100).notNullable();
      table.string('ciudad', 100).notNullable().defaultTo('GigantYA, Huila');
      table.integer('orden').defaultTo(0);
      table.boolean('activo').defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.unique(['nombre', 'ciudad'], 'uq_sector_ciudad');
    });
  }

  // 2. Tabla `barrios`
  const hasBarrios = await knex.schema.hasTable('barrios');
  if (!hasBarrios) {
    await knex.schema.createTable('barrios', (table) => {
      table.increments('id').primary();
      table.string('nombre', 120).notNullable();
      table.integer('sector_id').unsigned().notNullable()
        .references('id').inTable('sectores').onDelete('CASCADE');
      table.boolean('activo').defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.unique(['nombre', 'sector_id'], 'uq_barrio_sector');
      table.index('sector_id', 'idx_barrio_sector');
    });
  }

  // 3. Tabla `restaurante_envios_sector`
  const hasResEnvios = await knex.schema.hasTable('restaurante_envios_sector');
  if (!hasResEnvios) {
    await knex.schema.createTable('restaurante_envios_sector', (table) => {
      table.increments('id').primary();
      table.integer('restaurante_id').unsigned().notNullable()
        .references('id').inTable('restaurantes').onDelete('CASCADE');
      table.integer('sector_id').unsigned().notNullable()
        .references('id').inTable('sectores').onDelete('CASCADE');
      table.decimal('costo', 10, 2).notNullable().defaultTo(0);
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      table.timestamp('actualizado_en').defaultTo(knex.fn.now());

      table.unique(['restaurante_id', 'sector_id'], 'uq_rest_sector');
      table.index('restaurante_id', 'idx_res_sector');
    });
  }

  // 4. `direcciones.barrio_id` (idempotente)
  const hasBarrioEnDir = await knex.schema.hasColumn('direcciones', 'barrio_id');
  if (!hasBarrioEnDir) {
    await knex.schema.alterTable('direcciones', (table) => {
      table.integer('barrio_id').unsigned().nullable();
      table.foreign('barrio_id', 'fk_direccion_barrio')
        .references('id').inTable('barrios').onDelete('SET NULL');
      table.index('barrio_id', 'idx_direccion_barrio');
    });
  }

  // 5. `pedidos.barrio_id` y `pedidos.sector_id` (idempotente)
  const hasBarrioEnPed = await knex.schema.hasColumn('pedidos', 'barrio_id');
  if (!hasBarrioEnPed) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.integer('barrio_id').unsigned().nullable();
      table.integer('sector_id').unsigned().nullable();
      table.foreign('barrio_id', 'fk_pedido_barrio')
        .references('id').inTable('barrios').onDelete('SET NULL');
      table.foreign('sector_id', 'fk_pedido_sector')
        .references('id').inTable('sectores').onDelete('SET NULL');
      table.index('sector_id', 'idx_pedido_sector');
    });
  }
}

export async function down(knex) {
  // Quitar FKs y columnas de pedidos
  const hasBarrioEnPed = await knex.schema.hasColumn('pedidos', 'barrio_id');
  if (hasBarrioEnPed) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.dropIndex(['sector_id'], 'idx_pedido_sector');
      table.dropForeign(['barrio_id'], 'fk_pedido_barrio');
      table.dropForeign(['sector_id'], 'fk_pedido_sector');
      table.dropColumn('barrio_id');
      table.dropColumn('sector_id');
    });
  }

  // Quitar FK y columna de direcciones
  const hasBarrioEnDir = await knex.schema.hasColumn('direcciones', 'barrio_id');
  if (hasBarrioEnDir) {
    await knex.schema.alterTable('direcciones', (table) => {
      table.dropIndex(['barrio_id'], 'idx_direccion_barrio');
      table.dropForeign(['barrio_id'], 'fk_direccion_barrio');
      table.dropColumn('barrio_id');
    });
  }

  await knex.schema.dropTableIfExists('restaurante_envios_sector');
  await knex.schema.dropTableIfExists('barrios');
  await knex.schema.dropTableIfExists('sectores');
}
