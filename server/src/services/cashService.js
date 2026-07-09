/**
 * Service de caja (Fase 5).
 *
 * Encapsula la lógica de negocio de Fase 5:
 *   - `openSesion`: abre una sesión para un cajero.
 *   - `closeSesion`: cierra la sesión con arqueo (requiere idempotencia).
 *   - `getCurrentSesion`: devuelve la sesión abierta del cajero actual.
 *   - `chargeOrder`: cobra un pedido. Acepta pagos mixtos (varios `pagos`).
 *     Valida que la suma de pagos cubra el total, marca el pedido como
 *     'Entregado' y libera la mesa.
 *
 * Transacciones:
 *   - `openSesion` y `chargeOrder` corren en `knex.transaction` para
 *     evitar race conditions (dos cajeros abriendo caja a la vez; dos
 *     cobros simultáneos del mismo pedido).
 *   - `closeSesion` usa `UPDATE … WHERE estado='abierta'` con chequeo
 *     de `affectedRows` para idempotencia atómica a nivel SQL.
 */
import { getConnection, query } from '../config/database.js';
import * as Pago from '../models/pos/Pago.js';
import * as CajaSesion from '../models/pos/CajaSesion.js';
import { ORDER_STATES } from '../models/Order.js';
import { emitToRestaurant } from '../socket/socketHandler.js';
import * as AuditLog from '../models/AuditLog.js';

/** Abre una sesión para el cajero. Falla si ya tiene una abierta. */
export async function openSesion({ restauranteId, usuarioId, montoApertura = 0 }) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    // Lock sobre las sesiones existentes del usuario.
    const [existing] = await connection.query(
      `SELECT id FROM cajas_sesiones
        WHERE usuario_id = ? AND estado = 'abierta'
        FOR UPDATE`,
      [Number(usuarioId)]
    );
    if (existing.length > 0) {
      const err = new Error(`El cajero ya tiene una sesión abierta (#${existing[0].id})`);
      err.statusCode = 409;
      throw err;
    }
    const [r] = await connection.query(
      `INSERT INTO cajas_sesiones
         (restaurante_id, usuario_id, monto_apertura, estado, abierta_en)
       VALUES (?, ?, ?, 'abierta', NOW())`,
      [Number(restauranteId), Number(usuarioId), Number(montoApertura).toFixed(2)]
    );
    await connection.commit();
    const sesion = await CajaSesion.getSesionById(r.insertId);
    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: 'caja.open',
      entidad_tipo: 'cajas_sesiones',
      entidad_id: r.insertId,
      datos_despues: { monto_apertura: montoApertura, restaurante_id: restauranteId },
    }).catch(() => { /* best effort */ });
    return sesion;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Cierra una sesión con arqueo. Si `idempotencyKey` ya tiene respuesta
 *  cacheada, la devuelve sin re-procesar. */
export async function closeSesion({ sesionId, montoCierreReal, desgloseBilletes, notasCierre, idempotencyKey }) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    // 1) Lock sobre la sesión para evitar doble-cierre concurrente.
    const [sesionRows] = await connection.query(
      `SELECT * FROM cajas_sesiones WHERE id = ? FOR UPDATE`,
      [Number(sesionId)]
    );
    if (sesionRows.length === 0) {
      const err = new Error('Sesión no encontrada');
      err.statusCode = 404;
      throw err;
    }
    const sesion = sesionRows[0];
    if (sesion.estado !== 'abierta') {
      const err = new Error('La sesión ya está cerrada');
      err.statusCode = 409;
      throw err;
    }
    // 2) Calcular Σ pagos en efectivo desde la apertura de la sesión.
    const [pagosRows] = await connection.query(
      `SELECT COALESCE(SUM(monto), 0) AS total
         FROM pagos
        WHERE caja_sesion_id = ?
          AND metodo = 'efectivo'
          AND creado_en >= ?`,
      [Number(sesionId), sesion.abierta_en]
    );
    const totalEfectivo = Number(pagosRows[0]?.total || 0);
    const montoEsperado = Number(sesion.monto_apertura) + totalEfectivo;
    // 3) Cerrar (el WHERE estado='abierta' + affectedRows es la garantía
    //    atómica — un segundo caller que pase el lock verá affectedRows=0).
    const diferencia = (Number(montoCierreReal) - montoEsperado).toFixed(2);
    const [updateResult] = await connection.query(
      `UPDATE cajas_sesiones
          SET estado = 'cerrada',
              monto_cierre_esperado = ?,
              monto_cierre_real = ?,
              diferencia = ?,
              desglose_billetes = ?,
              notas_cierre = ?,
              cerrada_en = NOW()
        WHERE id = ? AND estado = 'abierta'`,
      [
        montoEsperado.toFixed(2),
        Number(montoCierreReal).toFixed(2),
        diferencia,
        desgloseBilletes ? JSON.stringify(desgloseBilletes) : null,
        notasCierre || null,
        Number(sesionId),
      ]
    );
    if (updateResult.affectedRows !== 1) {
      const err = new Error('La sesión ya fue cerrada por otra request');
      err.statusCode = 409;
      throw err;
    }
    await connection.commit();

    const sesionCerrada = await CajaSesion.getSesionById(sesionId);
    AuditLog.createLog({
      admin_id: sesion.usuario_id,
      accion: 'caja.close',
      entidad_tipo: 'cajas_sesiones',
      entidad_id: sesionId,
      datos_despues: {
        monto_apertura: Number(sesion.monto_apertura),
        monto_esperado: montoEsperado,
        monto_real: montoCierreReal,
        diferencia: sesionCerrada.diferencia,
      },
    }).catch(() => { /* best effort */ });
    return sesionCerrada;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Devuelve la sesión abierta del cajero actual, o null. */
export async function getCurrentSesion(usuarioId) {
  return CajaSesion.getOpenSesionByUser(usuarioId);
}

/** Devuelve un resumen en vivo de la sesión abierta:
 *   - La fila de la sesión.
 *   - `efectivo_acumulado`: Σ pagos en efectivo con `caja_sesion_id = ?`
 *     desde la apertura.
 *   - `esperado_actual`: monto_apertura + efectivo_acumulado.
 *
 *  Sirve para que la UI muestre al cajero cuánto efectivo debería
 *  tener en la caja en este momento. */
export async function getSesionLiveSummary(sesionId) {
  const sesion = await CajaSesion.getSesionById(Number(sesionId));
  if (!sesion) return null;
  const rows = await query(
    `SELECT COALESCE(SUM(monto), 0) AS efectivo
       FROM pagos
      WHERE caja_sesion_id = ?
        AND metodo = 'efectivo'
        AND creado_en >= ?`,
    [Number(sesionId), sesion.abierta_en]
  );
  const efectivo = Number(rows?.[0]?.efectivo || 0);
  return {
    sesion,
    efectivo_acumulado: efectivo,
    esperado_actual: Number(Number(sesion.monto_apertura || 0) + efectivo).toFixed(2),
  };
}

/** Cobra un pedido. Body:
 *    { pagos: [{ metodo, monto, propina?, descuento?, referencia_externa? }],
 *      caja_sesion_id?,                // opcional pero recomendado
 *      aplicar_a_pedido_completo: true } // MVP: siempre true
 *  Devuelve: { pedido, pagos, sesion_id }
 */
export async function chargeOrder({ pedidoId, restauranteId, usuarioId, pagos: pagosInput, cajaSesionId = null }) {
  if (!Array.isArray(pagosInput) || pagosInput.length === 0) {
    const err = new Error('pagos (array no vacío) es requerido');
    err.statusCode = 400;
    throw err;
  }
  // Validar cada item del array.
  for (const p of pagosInput) {
    if (!p.metodo) {
      const err = new Error('Cada pago debe traer metodo');
      err.statusCode = 400;
      throw err;
    }
    if (!(Number(p.monto) > 0)) {
      const err = new Error('Cada pago debe traer monto > 0');
      err.statusCode = 400;
      throw err;
    }
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Lock sobre el pedido y carga de datos necesarios.
    const [pedidoRows] = await connection.query(
      `SELECT p.id, p.estado, p.total, p.mesa_id, p.restaurante_id
         FROM pedidos p
        WHERE p.id = ? FOR UPDATE`,
      [Number(pedidoId)]
    );
    if (pedidoRows.length === 0) {
      const err = new Error('Pedido no encontrado');
      err.statusCode = 404;
      throw err;
    }
    const pedido = pedidoRows[0];
    if (Number(pedido.restaurante_id) !== Number(restauranteId)) {
      const err = new Error('El pedido no pertenece a este restaurante');
      err.statusCode = 403;
      throw err;
    }
    if (pedido.estado === ORDER_STATES.ENTREGADO || pedido.estado === ORDER_STATES.CANCELADO) {
      const err = new Error(`El pedido ya está en estado "${pedido.estado}", no se puede cobrar`);
      err.statusCode = 409;
      throw err;
    }

    // 2) Calcular suma de pagos vs total. Las propinas/descuentos se
    //    almacenan pero NO se restan del monto cobrado (la propina
    //    es INDEPENDIENTE del cobro, el descuento YA está descontado
    //    del `total` del pedido al crearse).
    const sumaPagos = pagosInput.reduce((s, p) => s + Number(p.monto), 0);
    const totalPedido = Number(pedido.total);
    // Diferencia tolerable: 1 centavo por redondeo.
    if (Math.abs(sumaPagos - totalPedido) > 0.01) {
      const err = new Error(
        `La suma de pagos ($${sumaPagos.toFixed(2)}) no coincide con el total del pedido ($${totalPedido.toFixed(2)})`
      );
      err.statusCode = 400;
      throw err;
    }

    // 3) Insertar cada pago.
    const pagosCreados = [];
    for (const p of pagosInput) {
      const [r] = await connection.query(
        `INSERT INTO pagos
           (pedido_id, restaurante_id, metodo, monto, propina, descuento,
            referencia_externa, recibido_por, caja_sesion_id, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          Number(pedidoId),
          Number(restauranteId),
          p.metodo,
          Number(p.monto).toFixed(2),
          Number(p.propina || 0).toFixed(2),
          Number(p.descuento || 0).toFixed(2),
          p.referencia_externa || null,
          Number(usuarioId),
          cajaSesionId ? Number(cajaSesionId) : null,
        ]
      );
      pagosCreados.push(r.insertId);
    }

    // 4) Pasar el pedido a 'Entregado' (cocina puede pasarlo a 'Listo'
    //    antes; el cobro lo termina).
    await connection.query(
      `UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?`,
      [ORDER_STATES.ENTREGADO, Number(pedidoId)]
    );

    // 5) Liberar la mesa (si la tiene y está ocupada).
    if (pedido.mesa_id) {
      await connection.query(
        `UPDATE mesas SET estado = 'libre' WHERE id = ? AND estado = 'ocupada'`,
        [pedido.mesa_id]
      );
    }

    await connection.commit();

    // 6) Auditoría + socket (best-effort, fuera de la transacción).
    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: 'caja.charge',
      entidad_tipo: 'pedidos',
      entidad_id: pedidoId,
      datos_despues: {
        pagos: pagosInput.map((p) => ({ metodo: p.metodo, monto: p.monto })),
        caja_sesion_id: cajaSesionId,
        total: totalPedido,
      },
    }).catch(() => { /* best effort */ });
    emitToRestaurant(Number(restauranteId), 'pos:order_paid', {
      pedido_id: pedidoId,
      total: totalPedido,
      pagos: pagosCreados.length,
      timestamp: new Date().toISOString(),
    });
    emitToRestaurant(Number(restauranteId), 'pos:order_status_changed', {
      pedido_id: pedidoId,
      estado: ORDER_STATES.ENTREGADO,
      estado_anterior: pedido.estado,
      timestamp: new Date().toISOString(),
    });

    return {
      pedido_id: pedidoId,
      pagos_ids: pagosCreados,
      caja_sesion_id: cajaSesionId,
    };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Helper para registrar pagos de un pedido ya cobrado (no usado en MVP,
 *  queda para Fase 8 split). */
export async function getPedidoPagos(pedidoId) {
  return Pago.getPagosByPedido(pedidoId);
}

export default {
  openSesion,
  closeSesion,
  getCurrentSesion,
  getSesionLiveSummary,
  chargeOrder,
  getPedidoPagos,
};
