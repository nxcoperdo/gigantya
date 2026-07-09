/**
 * Migración: Fase 6 — Inventario por ingredientes (BOM + Kardex).
 *
 * Crea 3 tablas:
 *   - `ingredientes`: materia prima (Carne, Pan, Queso…). Pertenece a un
 *     restaurante, tiene stock actual, stock mínimo y unidad de medida.
 *   - `producto_ingredientes`: BOM (bill of materials) = receta de cada
 *     producto. Un producto se "fabrica" con N unidades de cada
 *     ingrediente. UNIQUE (producto_id, ingrediente_id) evita duplicados.
 *   - `ingredientes_movimientos`: kardex. Cada fila es un movimiento de
 *     stock (consumo por pedido, compra, merma, ajuste). UNIQUE
 *     (pedido_id, ingrediente_id, tipo) impide doble descuento del mismo
 *     pedido (defensa de profundidad por si la lógica del service falla).
 *
 * Decisiones de tipos (reglas reales de ESTA BD):
 *   - `restaurantes.id` y `usuarios.id` son `INT` (signed). Las FKs
 *     hacia ellos NO llevan `.unsigned()`.
 *   - `productos.id` y `pedidos.id` son `INT` (signed) en la BD local
 *     (no UNSIGNED). Por eso `producto_id` y `pedido_id` NO llevan
 *     `.unsigned()`. El doc original asumía que eran UNSIGNED, pero la
 *     BD restaurada las tiene signed — el ALTER fallaría con
 *     "incompatible" si dejábamos UNSIGNED.
 *   - `ingredientes.id` y `mesas.id` son `INT UNSIGNED` (las crea
 *     `increments()` en Knex y quedaron así). Las FKs hacia ellos
 *     SÍ llevan `.unsigned()`.
 *   - Las PKs propias son `increments` → `INT UNSIGNED` (Knex default).
 *
 * Decisión de modelo:
 *   - Stock se lleva SOLO en `ingredientes.stock_actual`, NO en
 *     `productos.stock_actual`. Los productos con receta no tienen stock
 *     propio; su disponibilidad se deriva de los ingredientes.
 *   - Adiciones (ej. "queso extra") NO se contabilizan en el BOM en esta
 *     fase. Queda para una iteración futura si el negocio lo pide.
 *
 * Idempotente: cada CREATE TABLE se guarda con `hasTable`. Si la tabla
 * ya existe (restore, segunda corrida), se sale silenciosamente.
 */
export async function up(knex) {
  // ========== ingredientes ==========
  const ingExists = await knex.schema.hasTable('ingredientes');
  if (!ingExists) {
    await knex.schema.createTable('ingredientes', (table) => {
      table.increments('id').primary();
      // INT (signed) porque restaurantes.id es INT signed.
      table.integer('restaurante_id').notNullable();
      table.string('nombre', 100).notNullable();
      // kg | g | lt | ml | unidad. String corto, no ENUM, por si se
      // agregan unidades sin migración.
      table.string('unidad', 20).notNullable().defaultTo('unidad');
      // DECIMAL(12,3): hasta 999_999_999.999 con precisión de gramo.
      // Suficiente para un restaurante (ej. 12.345 kg de carne).
      table.decimal('stock_actual', 12, 3).notNullable().defaultTo(0);
      table.decimal('stock_minimo', 12, 3).notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      table.timestamp('actualizado_en').defaultTo(knex.fn.now());

      table.foreign('restaurante_id', 'fk_ingredientes_restaurante')
        .references('id').inTable('restaurantes').onDelete('CASCADE');
      table.index(['restaurante_id', 'activo'], 'idx_ingredientes_rest_activo');
    });
  }

  // ========== producto_ingredientes (BOM) ==========
  const bomExists = await knex.schema.hasTable('producto_ingredientes');
  if (!bomExists) {
    await knex.schema.createTable('producto_ingredientes', (table) => {
      table.increments('id').primary();
      // INT (signed): productos.id es INT signed en esta BD.
      table.integer('producto_id').notNullable();
      // INT UNSIGNED: PK de ingredientes es UNSIGNED.
      table.integer('ingrediente_id').unsigned().notNullable();
      // Cantidad de este ingrediente por UNIDAD del producto.
      // Ej: una hamburguesa usa 0.2 kg de carne → cantidad=0.2.
      table.decimal('cantidad', 12, 3).notNullable();
      table.string('notas', 255).nullable();

      table.foreign('producto_id', 'fk_pi_producto')
        .references('id').inTable('productos').onDelete('CASCADE');
      table.foreign('ingrediente_id', 'fk_pi_ingrediente')
        .references('id').inTable('ingredientes').onDelete('CASCADE');
      // Defensa: 1 fila por (producto, ingrediente) en la receta.
      table.unique(['producto_id', 'ingrediente_id'], 'uniq_pi_producto_ingrediente');
      table.index(['producto_id'], 'idx_pi_producto');
      table.index(['ingrediente_id'], 'idx_pi_ingrediente');
    });
  }

  // ========== ingredientes_movimientos (kardex) ==========
  const movExists = await knex.schema.hasTable('ingredientes_movimientos');
  if (!movExists) {
    await knex.schema.createTable('ingredientes_movimientos', (table) => {
      table.increments('id').primary();
      // INT signed: restaurantes.id es signed.
      table.integer('restaurante_id').notNullable();
      // INT UNSIGNED: ingredientes.id es UNSIGNED.
      table.integer('ingrediente_id').unsigned().notNullable();
      // consumo_pedido | compra | merma | ajuste
      // String corto por si se agregan tipos (ej. 'transferencia').
      table.string('tipo', 20).notNullable();
      // Signed: +entra (compra), -sale (consumo/merma). DECIMAL(12,3).
      table.decimal('cantidad', 12, 3).notNullable();
      // Snapshot del stock antes y después. Útil para auditoría y para
      // evitar un JOIN extra a `ingredientes` al mostrar el kardex.
      table.decimal('stock_anterior', 12, 3).notNullable();
      table.decimal('stock_nuevo', 12, 3).notNullable();
      // INT (signed): pedidos.id es INT signed en esta BD. NULL en
      // movimientos manuales (compra/merma/ajuste).
      table.integer('pedido_id').nullable();
      // INT signed: usuarios.id es signed.
      table.integer('usuario_id').nullable();
      table.string('notas', 255).nullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('ingrediente_id', 'fk_mov_ingrediente')
        .references('id').inTable('ingredientes').onDelete('CASCADE');
      table.foreign('pedido_id', 'fk_mov_pedido')
        .references('id').inTable('pedidos').onDelete('SET NULL');
      table.foreign('usuario_id', 'fk_mov_usuario')
        .references('id').inTable('usuarios').onDelete('SET NULL');
      table.foreign('restaurante_id', 'fk_mov_restaurante')
        .references('id').inTable('restaurantes').onDelete('CASCADE');

      // Índices para las consultas del kardex y de reportes.
      table.index(['ingrediente_id', 'creado_en'], 'idx_mov_ingrediente_fecha');
      table.index(['restaurante_id', 'creado_en'], 'idx_mov_restaurante_fecha');
      table.index(['pedido_id'], 'idx_mov_pedido');
      table.index(['tipo', 'creado_en'], 'idx_mov_tipo_fecha');
      // Defensa de profundidad: 1 fila por (pedido, ingrediente) en
      // movimientos de tipo consumo_pedido. Si el service reintenta el
      // INSERT por error, MySQL lo rechaza (la lógica del service
      // también lo evita, pero esta red de seguridad es barata).
      table.unique(['pedido_id', 'ingrediente_id', 'tipo'], 'uniq_mov_consumo_pedido');
    });
  }
}

export async function down(knex) {
  // El down borra en orden inverso por las FKs.
  await knex.schema.dropTableIfExists('ingredientes_movimientos');
  await knex.schema.dropTableIfExists('producto_ingredientes');
  await knex.schema.dropTableIfExists('ingredientes');
}
