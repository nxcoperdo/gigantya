/**
 * Migración: tabla de auditoría de acciones del admin.
 *
 * Cada vez que un admin (o un sistema) hace una mutación importante
 * (aprobar un local, suspender un usuario, validar un comprobante,
 * cambiar un plan, togglear una modalidad), se inserta una fila acá
 * con un snapshot del antes/después. Permite reconstruir el historial
 * de cambios y hacer forensics si un admin malicioso hace daño.
 *
 * Diseño:
 *  - `admin_id` apunta a usuarios (con ON DELETE RESTRICT para NO
 *    perder historial si se borra un admin).
 *  - `entidad_tipo` es VARCHAR (no FK) porque las entidades son
 *    heterogéneas: 'restaurante', 'usuario', 'comprobante', 'plan',
 *    'modalidad'. Mantenerlo como string permite agregar nuevos
 *    tipos sin migraciones.
 *  - `datos_antes` / `datos_despues` en JSON para diffs visuales
 *    en el tab de Auditoría del panel admin.
 *  - `ip` y `user_agent` para forensics.
 *  - Índices en (admin_id, creado_en), (entidad_tipo, entidad_id)
 *    y (accion, creado_en) para los queries más comunes del panel.
 *
 * Idempotente: si la tabla ya existe, no la tocamos.
 */
export async function up(knex) {
  if (await knex.schema.hasTable('audit_logs')) {
    return;
  }

  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    // int (signed) — `usuarios.id` también es `int` signed. Knex/sequelize
    // por defecto usa `unsigned` para `integer()` por lo que hay que ser
    // explícitos en NO poner .unsigned() o la FK falla.
    table.integer('admin_id').notNullable();
    table.string('accion', 64).notNullable();
    table.string('entidad_tipo', 32).notNullable();
    table.integer('entidad_id').nullable();
    table.json('datos_antes').nullable();
    table.json('datos_despues').nullable();
    table.string('ip', 45).nullable();
    table.string('user_agent', 255).nullable();
    table.timestamp('creado_en').defaultTo(knex.fn.now());

    table.foreign('admin_id').references('id').inTable('usuarios').onDelete('RESTRICT');
    table.index(['admin_id', 'creado_en'], 'idx_audit_admin');
    table.index(['entidad_tipo', 'entidad_id'], 'idx_audit_entidad');
    table.index(['accion', 'creado_en'], 'idx_audit_accion');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
