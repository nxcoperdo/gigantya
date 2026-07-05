/**
 * Agrega `ultima_actividad` a la tabla `usuarios` para soportar la feature
 * de "Usuarios Online en Tiempo Real" en el panel admin.
 *
 * La columna se mantiene en NULL para los usuarios existentes: solo se
 * actualizará la primera vez que hagan un request autenticado después del
 * deploy. La ventana "online" filtra con `ultima_actividad > NOW() - INTERVAL
 * 5 MINUTE`, así que un NULL jamás aparecerá como online (comportamiento
 * esperado — un usuario que nunca interactuó NO debe contar como online).
 *
 * El índice acelera la query de listado (`WHERE ultima_actividad > ? AND
 * estado = 'activo' ORDER BY ultima_actividad DESC`) que se ejecutará cada
 * 30s desde el panel admin.
 */
export async function up(knex) {
  await knex.schema.alterTable('usuarios', (table) => {
    table.timestamp('ultima_actividad').nullable().after('actualizado_en');

    // Índice compuesto: la query de "online" filtra por ventana temporal
    // y además restringe a usuarios activos. Sin este índice, MySQL hace
    // full scan sobre toda la tabla de usuarios cada vez que el admin
    // refresca el panel.
    table.index(['ultima_actividad', 'estado'], 'idx_usuarios_ultima_actividad_estado');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('usuarios', (table) => {
    table.dropIndex(['ultima_actividad', 'estado'], 'idx_usuarios_ultima_actividad_estado');
    table.dropColumn('ultima_actividad');
  });
}
