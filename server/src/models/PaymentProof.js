import { query, queryOne } from '../config/database.js';

/**
 * Estados de validación de pago
 */
export const PAYMENT_VALIDATION_STATES = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado'
};

/**
 * Métodos de pago disponibles
 */
export const PAYMENT_METHODS = {
  CONTRA_ENTREGA: 'contra_entrega',
  NEQUI: 'nequi',
  DAVIPLATA: 'daviplata'
};

/**
 * Crear un comprobante de pago
 */
export async function createProof(proofData) {
  const {
    pedido_id,
    url_imagen,
    metodo_pago
  } = proofData;

  const sql = `
    INSERT INTO comprobantes_pago (
      pedido_id,
      url_imagen,
      metodo_pago,
      fecha_subida,
      estado_validacion
    ) VALUES (?, ?, ?, NOW(), 'pendiente')
  `;

  try {
    const result = await query(sql, [pedido_id, url_imagen, metodo_pago]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando comprobante de pago: ${error.message}`);
  }
}

/**
 * Obtener comprobante por ID de pedido
 */
export async function getProofByOrderId(pedido_id) {
  const sql = `
    SELECT
      cp.*,
      u.nombre as validado_por_nombre
    FROM comprobantes_pago cp
    LEFT JOIN usuarios u ON cp.validado_por = u.id
    WHERE cp.pedido_id = ?
  `;

  try {
    const result = await queryOne(sql, [pedido_id]);
    return result;
  } catch (error) {
    throw new Error(`Error obteniendo comprobante: ${error.message}`);
  }
}

/**
 * Obtener comprobante por ID
 */
export async function getProofById(id) {
  const sql = `
    SELECT
      cp.*,
      u.nombre as validado_por_nombre
    FROM comprobantes_pago cp
    LEFT JOIN usuarios u ON cp.validado_por = u.id
    WHERE cp.id = ?
  `;

  try {
    const result = await queryOne(sql, [id]);
    return result;
  } catch (error) {
    throw new Error(`Error obteniendo comprobante: ${error.message}`);
  }
}

/**
 * Actualizar estado de validación del comprobante
 */
export async function updateProofStatus(id, estado, validado_por = null, motivo_rechazo = null) {
  const sql = `
    UPDATE comprobantes_pago
    SET
      estado_validacion = ?,
      validado_por = ?,
      fecha_validacion = ?,
      motivo_rechazo = ?
    WHERE id = ?
  `;

  try {
    await query(sql, [
      estado,
      validado_por,
      estado !== 'pendiente' ? new Date() : null,
      motivo_rechazo,
      id
    ]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando estado del comprobante: ${error.message}`);
  }
}

/**
 * Obtener comprobantes pendientes de validación para un restaurante
 */
export async function getPendingProofs(restaurante_id) {
  const sql = `
    SELECT
      cp.*,
      p.total as pedido_total,
      p.estado as pedido_estado,
      u.nombre as cliente_nombre,
      u.telefono as cliente_telefono
    FROM comprobantes_pago cp
    INNER JOIN pedidos p ON cp.pedido_id = p.id
    INNER JOIN usuarios u ON p.usuario_id = u.id
    WHERE p.restaurante_id = ?
      AND cp.estado_validacion = 'pendiente'
    ORDER BY cp.fecha_subida DESC
  `;

  try {
    return await query(sql, [restaurante_id]);
  } catch (error) {
    throw new Error(`Error obteniendo comprobantes pendientes: ${error.message}`);
  }
}

/**
 * Obtener todos los comprobantes de un restaurante
 */
export async function getProofsByRestaurant(restaurante_id, estado = null) {
  let sql = `
    SELECT
      cp.*,
      p.total as pedido_total,
      p.estado as pedido_estado,
      u.nombre as cliente_nombre,
      u.telefono as cliente_telefono
    FROM comprobantes_pago cp
    INNER JOIN pedidos p ON cp.pedido_id = p.id
    INNER JOIN usuarios u ON p.usuario_id = u.id
    WHERE p.restaurante_id = ?
  `;

  const params = [restaurante_id];

  if (estado) {
    sql += ' AND cp.estado_validacion = ?';
    params.push(estado);
  }

  sql += ' ORDER BY cp.fecha_subida DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo comprobantes: ${error.message}`);
  }
}

/**
 * Obtener configuración de pagos de un restaurante
 */
export async function getRestaurantPaymentConfig(restaurante_id) {
  const sql = `
    SELECT configuracion_pagos
    FROM restaurantes
    WHERE id = ?
  `;

  try {
    const result = await queryOne(sql, [restaurante_id]);
    return result?.configuracion_pagos ? JSON.parse(result.configuracion_pagos) : null;
  } catch (error) {
    throw new Error(`Error obteniendo configuración de pagos: ${error.message}`);
  }
}

/**
 * Actualizar configuración de pagos de un restaurante
 */
export async function updateRestaurantPaymentConfig(restaurante_id, config) {
  const sql = `
    UPDATE restaurantes
    SET configuracion_pagos = ?
    WHERE id = ?
  `;

  try {
    await query(sql, [JSON.stringify(config), restaurante_id]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando configuración de pagos: ${error.message}`);
  }
}

export default {
  PAYMENT_VALIDATION_STATES,
  PAYMENT_METHODS,
  createProof,
  getProofByOrderId,
  getProofById,
  updateProofStatus,
  getPendingProofs,
  getProofsByRestaurant,
  getRestaurantPaymentConfig,
  updateRestaurantPaymentConfig
};
