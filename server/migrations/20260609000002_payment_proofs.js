/**
 * Migración para módulo de pagos Fase 1
 * - Agrega método de pago a pedidos
 * - Crea tabla de comprobantes de pago
 */

export async function up(knex) {
  // 1. Agregar columna de método de pago a pedidos (si no existe)
  const hasPaymentMethod = await knex.schema.hasColumn('pedidos', 'metodo_pago');

  if (!hasPaymentMethod) {
    await knex.schema.table('pedidos', (table) => {
      table.enum('metodo_pago', ['contra_entrega', 'nequi', 'daviplata'])
        .defaultTo('contra_entrega')
        .comment('Método de pago del pedido');
    });
  }

  // 2. Agregar estado de validación de pago a pedidos
  const hasPaymentValidation = await knex.schema.hasColumn('pedidos', 'estado_validacion_pago');

  if (!hasPaymentValidation) {
    await knex.schema.table('pedidos', (table) => {
      table.enum('estado_validacion_pago', ['pendiente', 'aprobado', 'rechazado'])
        .defaultTo('pendiente')
        .comment('Estado de validación del pago');
    });
  }

  // 3. Crear tabla de comprobantes de pago
  await knex.schema.createTable('comprobantes_pago', (table) => {
    table.increments('id').primary();
    table.integer('pedido_id').unsigned().notNullable();
    table.string('url_imagen').notNullable();
    table.timestamp('fecha_subida').defaultTo(knex.fn.now());
    table.enum('estado_validacion', ['pendiente', 'aprobado', 'rechazado'])
      .defaultTo('pendiente');
    table.integer('validado_por').unsigned().nullable();
    table.timestamp('fecha_validacion').nullable();
    table.text('motivo_rechazo').nullable();
    table.string('metodo_pago').notNullable();

    // Foreign keys
    table.foreign('pedido_id').references('id').inTable('pedidos').onDelete('CASCADE');
    table.foreign('validado_por').references('id').inTable('usuarios').onDelete('SET NULL');

    // Índices
    table.index('pedido_id');
    table.index('estado_validacion');
  });

  // 4. Agregar configuración de métodos de pago a restaurantes
  const hasPaymentConfig = await knex.schema.hasColumn('restaurantes', 'configuracion_pagos');

  if (!hasPaymentConfig) {
    await knex.schema.table('restaurantes', (table) => {
      table.json('configuracion_pagos').nullable()
        .comment('Configuración JSON para Nequi/Daviplata: { nequi: { telefono, titular }, daviplata: { telefono, titular } }');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('comprobantes_pago');

  await knex.schema.table('pedidos', (table) => {
    table.dropColumn('metodo_pago');
    table.dropColumn('estado_validacion_pago');
  });

  await knex.schema.table('restaurantes', (table) => {
    table.dropColumn('configuracion_pagos');
  });
}
