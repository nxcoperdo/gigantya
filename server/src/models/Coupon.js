import { query, queryOne } from '../config/database.js';

/**
 * Crear nuevo cupón
 */
export async function createCoupon(couponData) {
  const {
    restaurante_id,
    codigo,
    descuento,
    tipo_descuento,
    fecha_expiracion,
    min_compra,
    max_compra,
    usos_maximos
  } = couponData;

  const sql = `
    INSERT INTO cupones (
      restaurante_id,
      codigo,
      descuento,
      tipo_descuento,
      fecha_expiracion,
      min_compra,
      max_compra,
      usos_maximos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const result = await query(sql, [
      restaurante_id,
      codigo.toUpperCase(),
      descuento,
      tipo_descuento,
      fecha_expiracion,
      min_compra ?? null,
      max_compra ?? null,
      usos_maximos
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando cupón: ${error.message}`);
  }
}

/**
 * Obtener cupones de un restaurante
 */
export async function getCouponsByRestaurant(restaurante_id) {
  const sql = 'SELECT * FROM cupones WHERE restaurante_id = ? ORDER BY creado_en DESC';
  return query(sql, [restaurante_id]);
}

/**
 * Validar cupón para un pedido
 *
 * Reglas aplicadas (todas opcionales según la config del cupón):
 *   - Activo (activo = 1)
 *   - No expirado (fecha_expiracion >= hoy, o NULL)
 *   - Usos disponibles (usos_actuales < usos_maximos, o NULL = ilimitado)
 *   - Subtotal/total dentro del rango permitido (min_compra / max_compra)
 *
 * Si el restaurante configuró tanto `min_compra` como `max_compra`, ambos
 * se cumplen y los mensajes son específicos para cada caso.
 */
export async function validateCoupon(codigo, restaurante_id, total_pedido) {
  const sql = `
    SELECT * FROM cupones
    WHERE codigo = ? AND restaurante_id = ? AND activo = 1
    AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURDATE())
    AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
  `;

  const cupon = await queryOne(sql, [codigo.toUpperCase(), restaurante_id]);

  if (!cupon) {
    throw new Error('Cupón inválido, expirado o no disponible para este restaurante');
  }

  // Validar monto mínimo (mínimo del pedido para que el cupón aplique)
  if (cupon.min_compra !== null && cupon.min_compra !== undefined && total_pedido < Number(cupon.min_compra)) {
    throw new Error(`El monto mínimo para usar este cupón es $${Number(cupon.min_compra).toLocaleString('es-CO')}`);
  }

  // Validar monto máximo (tope superior del pedido para que el cupón aplique)
  if (cupon.max_compra !== null && cupon.max_compra !== undefined && total_pedido > Number(cupon.max_compra)) {
    throw new Error(`Este cupón aplica solo para pedidos hasta $${Number(cupon.max_compra).toLocaleString('es-CO')}`);
  }

  return cupon;
}

/**
 * Registrar uso de cupón
 */
export async function recordCouponUsage(couponId) {
  // FIX: la columna es `usos_actuales`. El código tenía un typo
  // (`usos_actualen`) que rompía el conteo silenciosamente.
  const sql = 'UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = ?';
  return query(sql, [couponId]);
}

/**
 * Actualizar cupón
 */
export async function updateCoupon(id, updateData) {
  const allowedFields = ['codigo', 'descuento', 'tipo_descuento', 'fecha_expiracion', 'min_compra', 'max_compra', 'usos_maximos', 'activo'];
  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) throw new Error('No hay campos para actualizar');

  let sql = 'UPDATE cupones SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += field === 'codigo' ? `${field} = ?` : `${field} = ?`;
    values.push(field === 'codigo' ? updateData[field].toUpperCase() : updateData[field]);
  });

  sql += ' WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando cupón: ${error.message}`);
  }
}

/**
 * Eliminar cupón
 */
export async function deleteCoupon(id) {
  const sql = 'DELETE FROM cupones WHERE id = ?';
  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error eliminando cupón: ${error.message}`);
  }
}

export default {
  createCoupon,
  getCouponsByRestaurant,
  validateCoupon,
  recordCouponUsage,
  updateCoupon,
  deleteCoupon
};
