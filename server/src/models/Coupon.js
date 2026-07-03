import { query, queryOne } from '../config/database.js';

/**
 * Crear nuevo cupón.
 *
 * Acepta cupones de local (es_global = false) y cupones globales de
 * plataforma (es_global = true). En el caso global, `restaurante_id`
 * se fuerza a NULL en la fila. La aplicación garantiza el invariante
 * `es_global = 1 ⇔ restaurante_id IS NULL` (también reforzado por
 * un CHECK constraint a nivel DB, ver migración 20260701000005).
 *
 * Si llega una combinación inválida (es_global=true con restaurante_id,
 * o es_global=false sin restaurante_id) se rechaza con error.
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
    usos_maximos,
    es_global = false
  } = couponData;

  // Normalizar y validar el invariante lógico.
  // Importante: primero validamos la combinación QUE LLEGA del caller,
  // sin tocar los valores. Recién después de validar decidimos qué
  // guardar. Si solo validáramos `finalRestauranteId`, estaríamos
  // aceptando combinaciones inválidas silenciosamente (porque
  // `finalRestauranteId` se fuerza a null para los globales).
  const esGlobalBool = es_global === true || es_global === 1 || es_global === '1';
  const tieneRestauranteId = restaurante_id !== null && restaurante_id !== undefined && restaurante_id !== '';

  if (esGlobalBool && tieneRestauranteId) {
    throw new Error('Cupón global no puede tener restaurante_id');
  }
  if (!esGlobalBool && !tieneRestauranteId) {
    throw new Error('Cupón de local requiere restaurante_id');
  }

  const finalRestauranteId = esGlobalBool ? null : restaurante_id;

  // Validar unicidad del código entre cupones globales.
  // (El UNIQUE(restaurante_id, codigo) de MySQL ya cubre el caso
  // local-vs-local; este check cubre global-vs-global porque
  // MySQL trata NULLs como distintos en UNIQUE.)
  if (esGlobalBool) {
    const exists = await codeExistsForGlobal(codigo);
    if (exists) {
      throw new Error('Ya existe un cupón global con ese código');
    }
  } else {
    // Defensa adicional: validar que no choque con un global existente
    // (un local no debería poder tener un código que ya usa la plataforma).
    const globalExists = await codeExistsForGlobal(codigo);
    if (globalExists) {
      throw new Error('Ese código ya está reservado por un cupón global de la plataforma');
    }
  }

  const sql = `
    INSERT INTO cupones (
      restaurante_id,
      codigo,
      descuento,
      tipo_descuento,
      fecha_expiracion,
      min_compra,
      max_compra,
      usos_maximos,
      es_global
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const result = await query(sql, [
      finalRestauranteId,
      codigo.toUpperCase(),
      descuento,
      tipo_descuento,
      fecha_expiracion,
      min_compra ?? null,
      max_compra ?? null,
      usos_maximos,
      esGlobalBool ? 1 : 0
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando cupón: ${error.message}`);
  }
}

/**
 * Obtener cupones de un restaurante.
 *
 * - `includeGlobal = false` (default legacy): solo los cupones del local.
 *   Mantiene la semántica original.
 * - `includeGlobal = true`: además de los del local, suma los cupones
 *   globales de la plataforma. Usado por la vista del panel del local
 *   para que el dueño vea qué promociones de plataforma están activas.
 *
 * El flag `puede_editar` se calcula en SQL: el local solo puede editar
 * los propios (es_global=0); los globales son read-only para él.
 */
export async function getCouponsByRestaurant(restaurante_id, { includeGlobal = false } = {}) {
  if (!includeGlobal) {
    const sql = 'SELECT * FROM cupones WHERE restaurante_id = ? ORDER BY creado_en DESC';
    return query(sql, [restaurante_id]);
  }

  const sql = `
    SELECT
      c.*,
      CASE WHEN c.es_global = 1 THEN 0 ELSE 1 END AS puede_editar
    FROM cupones c
    WHERE c.restaurante_id = ? OR c.es_global = 1
    ORDER BY c.es_global DESC, c.creado_en DESC
  `;
  return query(sql, [restaurante_id]);
}

/**
 * Listar TODOS los cupones de la plataforma (admin).
 *
 * Soporta filtros:
 *   - es_global: 1 / 0
 *   - restaurante_id: número
 *   - activo: 1 / 0
 *   - codigo: LIKE match
 *   - limit, offset: paginación
 *
 * Devuelve una fila con el nombre del local (o NULL si es global)
 * para mostrar "Global" en la UI admin.
 */
export async function getAllCouponsForAdmin(filtros = {}) {
  const where = [];
  const params = [];

  if (filtros.es_global !== undefined && filtros.es_global !== null && filtros.es_global !== '') {
    where.push('c.es_global = ?');
    params.push(filtros.es_global === true || filtros.es_global === 1 || filtros.es_global === '1' ? 1 : 0);
  }

  if (filtros.restaurante_id !== undefined && filtros.restaurante_id !== null && filtros.restaurante_id !== '') {
    where.push('c.restaurante_id = ?');
    params.push(Number(filtros.restaurante_id));
  }

  if (filtros.activo !== undefined && filtros.activo !== null && filtros.activo !== '') {
    where.push('c.activo = ?');
    params.push(filtros.activo === true || filtros.activo === 1 || filtros.activo === '1' ? 1 : 0);
  }

  if (filtros.codigo) {
    where.push('c.codigo LIKE ?');
    params.push(`%${filtros.codigo.toUpperCase()}%`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.max(0, Math.min(Number(filtros.limit) || 200, 500));
  const offset = Math.max(0, Number(filtros.offset) || 0);

  const sql = `
    SELECT
      c.*,
      r.nombre AS restaurante_nombre
    FROM cupones c
    LEFT JOIN restaurantes r ON c.restaurante_id = r.id
    ${whereClause}
    ORDER BY c.es_global DESC, c.creado_en DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);
  return query(sql, params);
}

/**
 * Obtener un cupón por id. Devuelve null si no existe.
 * Usado por el controller admin para chequear ownership antes de
 * update/delete.
 */
export async function getCouponById(id) {
  const sql = `
    SELECT c.*, r.nombre AS restaurante_nombre
    FROM cupones c
    LEFT JOIN restaurantes r ON c.restaurante_id = r.id
    WHERE c.id = ?
    LIMIT 1
  `;
  return queryOne(sql, [id]);
}

/**
 * Validar cupón para un pedido.
 *
 * Reglas aplicadas (todas opcionales según la config del cupón):
 *   - Activo (activo = 1)
 *   - No expirado (fecha_expiracion >= hoy, o NULL)
 *   - Usos disponibles (usos_actuales < usos_maximos, o NULL = ilimitado)
 *   - Subtotal/total dentro del rango permitido (min_compra / max_compra)
 *
 * Búsqueda de cupón:
 *   - Caso normal: cupón de local. Filtra por `restaurante_id`.
 *   - Caso global: cupón de plataforma. Se busca sin filtro de
 *     restaurante y se exige `es_global = 1`.
 *
 * `options`:
 *   - es_carrito_multi_local: si true, ignora restaurante_id y
 *     permite tanto locales (de cualquier local) como globales. Útil
 *     para cuando un cliente mete productos de varios locales al carrito.
 *     En la práctica, hoy el carrito es single-local, pero la opción
 *     queda por si el modelo evoluciona.
 *   - forzar_global: si true, SOLO busca cupones globales (ignora
 *     cupones de local aunque coincida restaurante_id). Útil si el
 *     cliente hace checkout multi-local y el frontend quiere reintentar
 *     con un cupón global después de que el local falló.
 *
 * Devuelve el cupón con su flag `es_global` para que el caller sepa
 * qué reglas aplicar.
 */
export async function validateCoupon(codigo, restaurante_id, total_pedido, options = {}) {
  const {
    es_carrito_multi_local = false,
    forzar_global = false
  } = options;

  let sql;
  let params;

  if (forzar_global || es_carrito_multi_local) {
    sql = `
      SELECT * FROM cupones
      WHERE codigo = ? AND es_global = 1 AND activo = 1
      AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURDATE())
      AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
    `;
    params = [codigo.toUpperCase()];
  } else {
    // FIX: la búsqueda unificada por código. Antes filtrábamos
    // `WHERE codigo = ? AND restaurante_id = ?` lo que excluía los
    // cupones globales (cuyo `restaurante_id` es NULL) cuando el
    // cliente llamaba a validate con un restaurante_id concreto.
    //
    // Ahora: busca por código y acepta el cupón si es global O si
    // es del restaurante del caller. Priorizamos el del local con
    // `ORDER BY es_global ASC` por si en el futuro hubiera un
    // choque de códigos (improbable por el UNIQUE constraint, pero
    // defensa explícita).
    sql = `
      SELECT * FROM cupones
      WHERE codigo = ? AND activo = 1
      AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURDATE())
      AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
      AND (
        es_global = 1
        OR (es_global = 0 AND restaurante_id = ?)
      )
      ORDER BY es_global ASC
      LIMIT 1
    `;
    params = [codigo.toUpperCase(), Number(restaurante_id)];
  }

  const cupon = await queryOne(sql, params);

  if (!cupon) {
    // Mensaje específico para que el cliente sepa qué probar.
    if (forzar_global) {
      throw new Error('No existe un cupón global de la plataforma con ese código');
    }
    if (es_carrito_multi_local) {
      throw new Error('Cupón no encontrado. Si querés usar un cupón de un local, sacá los productos de otros locales del carrito');
    }
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
 * Actualizar cupón.
 *
 * Campos permitidos (whitelist):
 *   codigo, descuento, tipo_descuento, fecha_expiracion, min_compra,
 *   max_compra, usos_maximos, activo, es_global, restaurante_id
 *
 * Si se incluye `es_global` o `restaurante_id` en el payload, se
 * normaliza la combinación para mantener el invariante
 * `es_global = 1 ⇔ restaurante_id IS NULL`. No se valida la
 * existencia de restaurante_id si se cambia (eso lo hace el controller
 * con un check de FK manual o con un JOIN).
 */
export async function updateCoupon(id, updateData) {
  const allowedFields = [
    'codigo', 'descuento', 'tipo_descuento', 'fecha_expiracion',
    'min_compra', 'max_compra', 'usos_maximos', 'activo',
    'es_global', 'restaurante_id'
  ];
  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) throw new Error('No hay campos para actualizar');

  // Si cambian es_global o restaurante_id, normalizar el par.
  let nextEsGlobal;
  let nextRestauranteId;
  if (fields.includes('es_global')) {
    nextEsGlobal = updateData.es_global === true || updateData.es_global === 1 || updateData.es_global === '1';
  }
  if (fields.includes('restaurante_id')) {
    nextRestauranteId = updateData.restaurante_id;
  }

  if (nextEsGlobal === true) {
    updateData.restaurante_id = null;
    if (!fields.includes('restaurante_id')) fields.push('restaurante_id');
  } else if (nextEsGlobal === false) {
    // Si pasa a local pero no mandó restaurante_id, lo dejamos como está
    // (el caller tiene que saber qué local asignar).
  }

  let sql = 'UPDATE cupones SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    let value = updateData[field];
    if (field === 'codigo' && value) value = value.toUpperCase();
    // Boolean→int para TINYINT(1)
    if (field === 'es_global') {
      value = (value === true || value === 1 || value === '1') ? 1 : 0;
    }
    sql += `${field} = ?`;
    values.push(value);
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
 * Listar todos los USOS (redenciones) de cupones de la plataforma (admin).
 *
 * Devuelve una fila por pedido que tuvo un cupón aplicado, con info
 * del cupón usado, el cliente, el local (NULL si fue cupón global),
 * el subtotal de los items y el total cobrado. El descuento aplicado
 * se recalcula en JS a partir del cupón (porcentaje o monto) y el
 * subtotal — coherente con la lógica de `Order.getOrderById`.
 *
 * Filtros opcionales:
 *   - cupon_id: filtra por un cupón específico
 *   - restaurante_id: filtra por un local (ignora los cupones globales
 *                     salvo que es_global=1; útil para "qué se usó en mi local")
 *   - es_global: 1/0 — solo cupones globales, o solo de local
 *   - fecha_desde, fecha_hasta: rango de fechas sobre pedidos.creado_en
 *   - limit, offset: paginación
 *
 * Nota: pedidos cuyo cupón fue eliminado (cupon_id → SET NULL) NO
 * aparecen acá porque la query hace `JOIN cupones`, que excluye filas
 * con cupon_id NULL. Es el comportamiento correcto: un cupón borrado
 * no tiene "usos" visibles para el admin.
 */
export async function getCouponUsagesForAdmin(filtros = {}) {
  const where = ['p.cupon_id IS NOT NULL'];
  const params = [];

  if (filtros.cupon_id !== undefined && filtros.cupon_id !== null && filtros.cupon_id !== '') {
    where.push('c.id = ?');
    params.push(Number(filtros.cupon_id));
  }

  if (filtros.es_global !== undefined && filtros.es_global !== null && filtros.es_global !== '') {
    where.push('c.es_global = ?');
    params.push(filtros.es_global === true || filtros.es_global === 1 || filtros.es_global === '1' ? 1 : 0);
  }

  if (filtros.restaurante_id !== undefined && filtros.restaurante_id !== null && filtros.restaurante_id !== '') {
    where.push('p.restaurante_id = ?');
    params.push(Number(filtros.restaurante_id));
  }

  if (filtros.fecha_desde) {
    where.push('p.creado_en >= ?');
    params.push(`${filtros.fecha_desde} 00:00:00`);
  }

  if (filtros.fecha_hasta) {
    where.push('p.creado_en <= ?');
    params.push(`${filtros.fecha_hasta} 23:59:59`);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const limit = Math.max(0, Math.min(Number(filtros.limit) || 100, 500));
  const offset = Math.max(0, Number(filtros.offset) || 0);

  const sql = `
    SELECT
      p.id AS pedido_id,
      p.creado_en AS pedido_creado_en,
      p.total AS pedido_total,
      p.estado AS pedido_estado,
      p.costo_envio AS pedido_costo_envio,
      u.id AS cliente_id,
      u.nombre AS cliente_nombre,
      u.email AS cliente_email,
      r.id AS restaurante_id,
      r.nombre AS restaurante_nombre,
      c.id AS cupon_id,
      c.codigo AS cupon_codigo,
      c.tipo_descuento AS cupon_tipo_descuento,
      c.descuento AS cupon_descuento,
      c.es_global AS cupon_es_global,
      c.min_compra AS cupon_min_compra,
      COALESCE(
        (SELECT SUM(ip.subtotal) FROM items_pedido ip WHERE ip.pedido_id = p.id),
        0
      ) AS subtotal
    FROM pedidos p
    JOIN cupones c ON p.cupon_id = c.id
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    ${whereClause}
    ORDER BY p.creado_en DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows = await query(sql, params);

  // Calcular el descuento aplicado en JS para cada fila, replicando
  // la lógica de Order.calculateOrderTotal (líneas 82-90 de Order.js)
  // y Order.getOrderById (líneas 549-565). Se hace en JS porque la
  // fórmula depende de tipo_descuento y es trivial.
  return rows.map((row) => {
    const subtotal = Number(row.subtotal) || 0;
    const descuentoCfg = Number(row.cupon_descuento) || 0;
    let descuentoAplicado = 0;
    if (row.cupon_tipo_descuento === 'porcentaje') {
      descuentoAplicado = subtotal * (descuentoCfg / 100);
    } else {
      // tipo_descuento === 'monto' (o 'fijo' según el CHECK, ambos cubiertos)
      descuentoAplicado = descuentoCfg;
    }
    // El descuento no puede superar el subtotal (mismo clamp que el checkout)
    descuentoAplicado = Math.min(descuentoAplicado, subtotal);

    return {
      ...row,
      // Devolvemos como string consistente con mysql2 (DECIMAL → string)
      // pero también exponemos un Number para que la UI no tenga que parsear.
      subtotal: Number(subtotal.toFixed(2)),
      descuento_aplicado: Number(descuentoAplicado.toFixed(2)),
    };
  });
}

/**
 * Eliminar cupón. No chequea ownership (eso lo hace el controller).
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

// =============================================================
// Helpers internos
// =============================================================

/**
 * Chequea si ya existe un cupón GLOBAL con ese código.
 * El chequeo es case-insensitive (códigos siempre se guardan en upper).
 * Usado por createCoupon para enforce unicidad entre globales.
 */
async function codeExistsForGlobal(codigo) {
  if (!codigo) return false;
  const sql = 'SELECT id FROM cupones WHERE es_global = 1 AND codigo = ? LIMIT 1';
  const row = await queryOne(sql, [codigo.toUpperCase()]);
  return row !== null && row !== undefined;
}

export default {
  createCoupon,
  getCouponsByRestaurant,
  getAllCouponsForAdmin,
  getCouponById,
  getCouponUsagesForAdmin,
  validateCoupon,
  recordCouponUsage,
  updateCoupon,
  deleteCoupon
};
