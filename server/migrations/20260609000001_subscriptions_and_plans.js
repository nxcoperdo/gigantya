/**
 * Migración: sistema de planes y suscripciones.
 *
 * Añade al esquema de restaurantes:
 *   - columna `plan` (basico | profesional | premium) — idempotente: si los
 *     scripts sueltos `migrate_subscriptions.js` / `migrate_coupons.js`
 *     ya corrieron en producción, la columna y la tabla ya existen; las
 *     comprobaciones `hasColumn`/`hasTable` evitan que la migración reviente.
 *   - columna `fecha_vencimiento_plan` (cron job la usa para degradar a basico).
 *
 * Tabla nueva `suscripciones` con historial de pagos/cambios de plan.
 * Tabla nueva `producto_imagenes` (galería de hasta 5 fotos en plan Profesional+).
 * Fix de la constraint UNIQUE en `cupones`: pasa de UNIQUE(codigo) global a
 * UNIQUE(restaurante_id, codigo) para que dos restaurantes puedan usar el
 * mismo código (ej. "DESCUENTO10") sin colisionar.
 */
export async function up(knex) {
  // 1. Columnas nuevas en `restaurantes` (idempotente)
  const hasPlan = await knex.schema.hasColumn('restaurantes', 'plan');
  if (!hasPlan) {
    await knex.schema.alterTable('restaurantes', (table) => {
      table.enum('plan', ['basico', 'profesional', 'premium']).defaultTo('basico');
    });
  }

  const hasVencimiento = await knex.schema.hasColumn('restaurantes', 'fecha_vencimiento_plan');
  if (!hasVencimiento) {
    await knex.schema.alterTable('restaurantes', (table) => {
      table.datetime('fecha_vencimiento_plan').nullable();
      table.index(['plan', 'fecha_vencimiento_plan'], 'idx_plan_vencimiento');
    });
  }

  // 2. Tabla `suscripciones` (historial de planes)
  const hasSuscripciones = await knex.schema.hasTable('suscripciones');
  if (!hasSuscripciones) {
    await knex.schema.createTable('suscripciones', (table) => {
      table.increments('id').primary();
      table.integer('restaurante_id').unsigned().notNullable()
        .references('id').inTable('restaurantes').onDelete('CASCADE');
      table.enum('plan', ['basico', 'profesional', 'premium']).notNullable();
      table.datetime('fecha_inicio').notNullable();
      table.datetime('fecha_vencimiento').notNullable();
      table.enum('estado', ['activa', 'vencida', 'cancelada']).defaultTo('activa');
      table.decimal('monto_pagado', 10, 2).nullable();
      table.string('metodo_pago', 50).nullable();
      table.text('notas').nullable();
      table.boolean('recordatorio_enviado').defaultTo(false);
      table.integer('creado_por').unsigned().nullable()
        .references('id').inTable('usuarios').onDelete('SET NULL');
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      table.timestamp('actualizado_en').defaultTo(knex.fn.now());

      table.index('restaurante_id', 'idx_susc_restaurante');
      table.index(['fecha_vencimiento', 'estado'], 'idx_susc_vencimiento');
    });
  }

  // 3. Tabla `producto_imagenes` (galería de fotos)
  const hasProductoImagenes = await knex.schema.hasTable('producto_imagenes');
  if (!hasProductoImagenes) {
    await knex.schema.createTable('producto_imagenes', (table) => {
      table.increments('id').primary();
      table.integer('producto_id').unsigned().notNullable()
        .references('id').inTable('productos').onDelete('CASCADE');
      table.string('imagen_url', 255).notNullable();
      table.integer('orden').defaultTo(0);
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      table.index('producto_id', 'idx_img_producto');
    });
  }

  // 4. Fix constraint UNIQUE de cupones
  // Los scripts sueltos pusieron UNIQUE(codigo) global; el plan dice
  // UNIQUE(restaurante_id, codigo). Si la tabla ya existe con el UNIQUE
  // global, lo migramos.
  const hasCupones = await knex.schema.hasTable('cupones');
  if (hasCupones) {
    // Quitar índice UNIQUE global en codigo
    try {
      await knex.schema.alterTable('cupones', (table) => {
        table.dropUnique(['codigo'], 'codigo_unique');
      });
    } catch (e) {
      // El índice no existía con ese nombre, o ya no estaba. Continuar.
    }

    // Asegurar índice UNIQUE compuesto
    const hasComposite = await knex.raw(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'cupones'
         AND index_name = 'cupones_restaurante_id_codigo_unique'`
    );
    const hasCompositeIndex = hasComposite[0]?.n > 0;
    if (!hasCompositeIndex) {
      await knex.schema.alterTable('cupones', (table) => {
        table.unique(['restaurante_id', 'codigo'], 'cupones_restaurante_id_codigo_unique');
      });
    }
  }
}

export async function down(knex) {
  // Revertir constraint compuesta
  try {
    await knex.schema.alterTable('cupones', (table) => {
      table.dropUnique(['restaurante_id', 'codigo'], 'cupones_restaurante_id_codigo_unique');
    });
  } catch (e) { /* ya no estaba */ }

  await knex.schema.dropTableIfExists('producto_imagenes');
  await knex.schema.dropTableIfExists('suscripciones');

  // Quitar columnas si existen
  const hasVencimiento = await knex.schema.hasColumn('restaurantes', 'fecha_vencimiento_plan');
  if (hasVencimiento) {
    await knex.schema.alterTable('restaurantes', (table) => {
      table.dropIndex(['plan', 'fecha_vencimiento_plan'], 'idx_plan_vencimiento');
      table.dropColumn('fecha_vencimiento_plan');
    });
  }

  // No eliminamos `plan` porque los scripts sueltos la crearon fuera de Knex.
  // Eliminar la columna rompería la app. Se deja en el down a propósito.
}
