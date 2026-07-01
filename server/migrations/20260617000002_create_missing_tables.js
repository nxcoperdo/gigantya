/**
 * Migración: crea las tablas que faltan en el schema Knex pero existen
 * en producción (vía database/schema.sql o creadas a mano).
 *
 * Cuando el commit 154abe8 cambió CI para correr las migraciones Knex
 * desde cero (sin usar database/schema.sql), 4 tablas quedaron sin
 * migration propia. El test-helper.js hace TRUNCATE de todas y los
 * tests fallan con ER_NO_SUCH_TABLE, lo que a su vez hace que el
 * seed (crear usuarios admin/restaurante/cliente) falle, y los
 * tests de auth.login/register devuelvan 400/500 en cascada.
 *
 * Tablas que crea esta migration:
 *   1. cupones                → estructura del schema.sql + columnas
 *                                agregadas por las migrations 0300001
 *                                (max_compra) y 0700005 (es_global).
 *                                El UNIQUE(restaurante_id, codigo) lo
 *                                define la migration 0609000001 (que
 *                                ya pasó sin error: usa hasTable guard).
 *                                Acá lo creamos nosotros directamente
 *                                para que la tabla sea autocontenida
 *                                y la migration 0609000001 haga su
 *                                ALTER idempotente (no-op porque ya
 *                                existe el UNIQUE). Para evitar el
 *                                ALTER redundante, NO definimos el
 *                                UNIQUE acá: la 0609000001 lo crea
 *                                y queda en una sola fuente de verdad.
 *   2. cupones_usados         → tabla referenciada por test-helper.js
 *                                (TRUNCATE) y por convención del
 *                                proyecto. Estructura mínima razonable
 *                                (cupon_id, usuario_id, pedido_id,
 *                                usado_en). Cubre el registro de
 *                                "un usuario usó un cupón en un
 *                                pedido" — patrón estándar.
 *   3. password_reset_tokens  → estructura de database/schema.sql:247
 *                                (id, usuario_id UNIQUE, token,
 *                                expira_en, creado_en, FK CASCADE).
 *   4. historial_busquedas    → estructura del modelo
 *                                server/src/models/SearchHistory.js:
 *                                (id, usuario_id, termino, creado_en,
 *                                FK CASCADE a usuarios).
 *
 * Idempotente: si cualquiera de las tablas ya existe, no la tocamos
 * (caso raro: DB de dev creada a mano con schema.sql).
 *
 * Orden cronológico: timestamp 20260617000002 (entre la 17000001 de
 * direcciones y la 18000001 de sectores_y_barrios). No toca ninguna
 * otra migration.
 */
export async function up(knex) {
  // 1. CUPONES
  if (!(await knex.schema.hasTable('cupones'))) {
    await knex.schema.createTable('cupones', (table) => {
      table.increments('id').primary();
      // restaurante_id NULL para cupones globales (es_global = 1).
      // La FK a restaurantes la crea y dropea la migration
      // 0700005_add_es_global_to_cupones; acá la dejamos nullable
      // y sin FK para que la 0900001 y la 0700005 manejen su ciclo
      // de vida sin chocarse.
      table.integer('restaurante_id').unsigned().nullable();
      table.string('codigo', 50).notNullable();
      table.decimal('descuento', 10, 2).notNullable();
      table.enum('tipo_descuento', ['porcentaje', 'monto']).notNullable();
      table.date('fecha_expiracion').nullable();
      table.decimal('min_compra', 10, 2).nullable();
      table.decimal('max_compra', 10, 2).nullable();
      table.integer('usos_maximos').nullable();
      table.integer('usos_actuales').defaultTo(0);
      table.boolean('activo').defaultTo(true);
      table.boolean('es_global').notNullable().defaultTo(false);
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.index('restaurante_id', 'idx_cupones_restaurante_id');
      table.index('codigo', 'idx_cupones_codigo');
      table.index('es_global', 'idx_cupones_es_global');
    });
  }

  // 2. CUPONES_USADOS
  if (!(await knex.schema.hasTable('cupones_usados'))) {
    await knex.schema.createTable('cupones_usados', (table) => {
      table.increments('id').primary();
      table.integer('cupon_id').unsigned().notNullable();
      table.integer('usuario_id').unsigned().notNullable();
      table.integer('pedido_id').unsigned().nullable();
      table.timestamp('usado_en').defaultTo(knex.fn.now());

      // FKs a las tablas existentes. CASCADE para mantener
      // coherencia con el resto del schema (si se borra el cupón,
      // se borra su historial; si se borra el usuario, lo mismo).
      table.foreign('cupon_id', 'fk_cupones_usados_cupon')
        .references('id').inTable('cupones').onDelete('CASCADE');
      table.foreign('usuario_id', 'fk_cupones_usados_usuario')
        .references('id').inTable('usuarios').onDelete('CASCADE');
      table.foreign('pedido_id', 'fk_cupones_usados_pedido')
        .references('id').inTable('pedidos').onDelete('SET NULL');

      table.index('cupon_id', 'idx_cupones_usados_cupon');
      table.index('usuario_id', 'idx_cupones_usados_usuario');
    });
  }

  // 3. PASSWORD_RESET_TOKENS
  if (!(await knex.schema.hasTable('password_reset_tokens'))) {
    await knex.schema.createTable('password_reset_tokens', (table) => {
      table.increments('id').primary();
      // UNIQUE en usuario_id: un usuario solo puede tener un token
      // de reseteo activo a la vez (coherente con schema.sql:249).
      table.integer('usuario_id').unsigned().notNullable().unique();
      table.string('token', 255).notNullable();
      table.timestamp('expira_en').notNullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('usuario_id', 'fk_password_reset_tokens_usuario')
        .references('id').inTable('usuarios').onDelete('CASCADE');
      table.index('token', 'idx_password_reset_tokens_token');
      table.index('expira_en', 'idx_password_reset_tokens_expira_en');
    });
  }

  // 4. HISTORIAL_BUSQUEDAS
  if (!(await knex.schema.hasTable('historial_busquedas'))) {
    await knex.schema.createTable('historial_busquedas', (table) => {
      table.increments('id').primary();
      table.integer('usuario_id').unsigned().notNullable();
      table.string('termino', 255).notNullable();
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      table.foreign('usuario_id', 'fk_historial_busquedas_usuario')
        .references('id').inTable('usuarios').onDelete('CASCADE');
      table.index('usuario_id', 'idx_historial_busquedas_usuario');
      table.index('creado_en', 'idx_historial_busquedas_creado_en');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('historial_busquedas');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('cupones_usados');
  await knex.schema.dropTableIfExists('cupones');
}
