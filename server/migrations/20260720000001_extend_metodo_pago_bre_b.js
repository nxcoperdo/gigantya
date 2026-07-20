/**
 * Migración: extender el ENUM `pedidos.metodo_pago` con el valor 'bre_b'.
 *
 * ¿Por qué?
 *   El código JS (Order.PAYMENT_METHODS, ArmarPedidoModal, paymentController)
 *   ya acepta 'bre_b' como método de pago válido, pero la columna en BD no
 *   lo tiene en su ENUM. Cualquier INSERT con metodo_pago='bre_b' revienta
 *   con "Data truncated for column 'metodo_pago'".
 *
 *   Esta migración alinea la BD con la capa de aplicación para que el
 *   método Bre-B funcione end-to-end (mismo fix que se aplicó en código
 *   JS, ahora se baja a la BD).
 *
 * Notas:
 *   - Usamos SQL crudo con ALTER TABLE porque knex.schema no soporta
 *     modificar un ENUM existente (solo crear/eliminar la columna).
 *   - El default se mantiene en 'contra_entrega' para no afectar filas
 *     existentes.
 */
export async function up(knex) {
  await knex.schema.raw(
    "ALTER TABLE pedidos MODIFY COLUMN metodo_pago ENUM('contra_entrega', 'nequi', 'daviplata', 'bre_b') NOT NULL DEFAULT 'contra_entrega'"
  );
}

export async function down(knex) {
  // Antes de hacer rollback, cualquier fila con metodo_pago='bre_b' va a
  // fallar. Las convertimos a 'contra_entrega' para que el down sea seguro.
  await knex.schema.raw(
    "UPDATE pedidos SET metodo_pago = 'contra_entrega' WHERE metodo_pago = 'bre_b'"
  );
  await knex.schema.raw(
    "ALTER TABLE pedidos MODIFY COLUMN metodo_pago ENUM('contra_entrega', 'nequi', 'daviplata') NOT NULL DEFAULT 'contra_entrega'"
  );
}
