/**
 * Migración POS Fase 5: caja registradora + tabla `pagos`.
 *
 * Crea dos tablas:
 *
 *   - `pagos`: cada fila es un cargo aplicado a un pedido. Un pedido
 *     puede tener VARIAS filas (pago mixto: mitad efectivo, mitad
 *     transferencia). `metodo` es uno de los métodos aceptados por
 *     el POS. Incluye `propina` y `descuento` separados para que el
 *     reporte de cierre pueda desglosarlos.
 *
 *   - `cajas_sesiones`: una "apertura de caja" de un cajero. Mientras
 *     la fila tiene `estado='abierta'`, el cajero puede cobrar pedidos
 *     referenciándola. Al cerrar, se persiste el conteo real de
 *     billetes, el esperado por el sistema, y la diferencia (sobrante
 *     o faltante).
 *
 * Decisiones:
 *   - `metodo` como VARCHAR(20) (no ENUM) para no requerir ALTER si
 *     se agregan métodos (Nequi, Daviplata ya están en la lista
 *     actual, pero podría haber más).
 *   - `items_pagados_json` queda NULL en MVP: Fase 8 (split) lo va a
 *     usar para registrar qué items cubre cada pago cuando se hace
 *     split por ítems. Crear la columna ahora evita migrar después.
 *   - `cajas_sesiones` no tiene `restaurante_id` directo: se infiere
 *     por `usuario_id → usuarios.restaurante_id`. Esto evita un JOIN
 *     extra y mantiene la fuente de verdad única.
 *   - `recibido_por` es FK a `usuarios.id` con `ON DELETE SET NULL`
 *     para no perder el cargo si el staff se desvincula del local.
 *
 * Idempotente: `createTableIfNotExists`风格的 pattern.
 */
export async function up(knex) {
  // Tabla `pagos`.
  if (!(await knex.schema.hasTable('pagos'))) {
    await knex.schema.createTable('pagos', (table) => {
      table.increments('id').primary();
      table.integer('pedido_id').unsigned().notNullable();
      table.integer('restaurante_id').unsigned().notNullable();
      // efectivo | transferencia | tarjeta | mixto | nequi | daviplata
      table.string('metodo', 20).notNullable();
      table.decimal('monto', 10, 2).notNullable();
      table.decimal('propina', 10, 2).notNullable().defaultTo(0);
      table.decimal('descuento', 10, 2).notNullable().defaultTo(0);
      table.string('referencia_externa', 100).nullable();
      // `usuarios.id` es INT (sin UNSIGNED), no usamos `.unsigned()`.
      table.integer('recibido_por').nullable();
      table.integer('caja_sesion_id').unsigned().nullable();
      table.json('items_pagados_json').nullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      table.foreign('pedido_id', 'fk_pagos_pedido')
        .references('id').inTable('pedidos').onDelete('CASCADE');
      table.foreign('restaurante_id', 'fk_pagos_rest')
        .references('id').inTable('restaurantes').onDelete('CASCADE');
      table.foreign('recibido_por', 'fk_pagos_user')
        .references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['pedido_id'], 'idx_pagos_pedido');
      table.index(['restaurante_id', 'creado_en'], 'idx_pagos_rest_fecha');
    });
  }

  // Tabla `cajas_sesiones`.
  if (!(await knex.schema.hasTable('cajas_sesiones'))) {
    await knex.schema.createTable('cajas_sesiones', (table) => {
      table.increments('id').primary();
      // `restaurante_id` denormalizado: el cajero puede ser de otro
      // restaurante y atender cajas de varios en una sesión, pero
      // el modelo de Fase 1 dice "un restaurante = un POS, un cajero
      // pertenece a un restaurante", así que el restaurante de la
      // sesión SIEMPRE es `usuario.restaurante_id`. Lo denormalizamos
      // para que las queries del KDS / cierre no necesiten JOIN.
      table.integer('restaurante_id').unsigned().notNullable();
      table.integer('usuario_id').unsigned().notNullable();
      table.decimal('monto_apertura', 10, 2).notNullable().defaultTo(0);
      table.decimal('monto_cierre_esperado', 10, 2).nullable();
      table.decimal('monto_cierre_real', 10, 2).nullable();
      table.decimal('diferencia', 10, 2).nullable();
      table.json('desglose_billetes').nullable();
      table.text('notas_cierre').nullable();
      table.timestamp('abierta_en').defaultTo(knex.fn.now());
      table.timestamp('cerrada_en').nullable();
      // abierta | cerrada
      table.string('estado', 20).notNullable().defaultTo('abierta');
      table.foreign('restaurante_id', 'fk_caja_rest')
        .references('id').inTable('restaurantes').onDelete('CASCADE');
      // `usuarios.id` es INT (sin UNSIGNED).
      table.foreign('usuario_id', 'fk_caja_user')
        .references('id').inTable('usuarios').onDelete('RESTRICT');
      table.index(['restaurante_id', 'estado'], 'idx_caja_estado');
      table.index(['usuario_id', 'estado'], 'idx_caja_user_estado');
    });
  }

  // FK de pagos → caja_sesion_id (no la puse arriba porque al crear
  // la tabla en el mismo run, la segunda FK no se valida; Knex Schema
  // API igual las procesa en orden). Si por algo el orden falla, la
  // creo aquí con un guard de hasColumn.
  const hasCajaFk = await knex.raw(
    `SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE()
        AND table_name = 'pagos'
        AND constraint_name = 'fk_pagos_caja_sesion'
      LIMIT 1`
  );
  const cajaFkRows = Array.isArray(hasCajaFk) ? hasCajaFk : (hasCajaFk[0] || []);
  if (!cajaFkRows.length) {
    await knex.schema.alterTable('pagos', (table) => {
      table.foreign('caja_sesion_id', 'fk_pagos_caja_sesion')
        .references('id').inTable('cajas_sesiones').onDelete('SET NULL');
    });
  }
}

export async function down(knex) {
  // Drop en orden inverso por las FKs.
  if (await knex.schema.hasTable('pagos')) {
    await knex.schema.dropTable('pagos');
  }
  if (await knex.schema.hasTable('cajas_sesiones')) {
    await knex.schema.dropTable('cajas_sesiones');
  }
}
