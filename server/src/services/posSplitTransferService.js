/**
 * Service de split bill / transfer / merge (Fase 8).
 *
 * Funciones:
 *   - `addPaymentToOrder({ pedidoId, restauranteId, usuarioId, pagos,
 *                            cajaSesionId, itemsPagados })`:
 *     Carga un pago PARCIAL al pedido. A diferencia de
 *     `cashService.chargeOrder` (que exige la suma == total), esta
 *     función acepta pagos cuya suma + pagos previos <= total.
 *     Si la suma alcanza el total, pasa el pedido a 'Entregado' y
 *     libera la mesa. Si no, lo deja en estado_pago='parcial' y
 *     mantiene la mesa ocupada.
 *
 *   - `splitBillByItems({ pedidoId, restauranteId, usuarioId, itemsPorCuenta })`:
 *     Divide el pedido en N cuentas hijas, cada una con un subset
 *     de los items. El pedido ORIGINAL se marca como 'Cancelado'
 *     con nota explicativa (decisión confirmada por el usuario, ver
 *     plan [[gigantya-pos-mvp]] y `cosmic-bubbling-shell`).
 *
 *   - `transferOrder({ pedidoId, restauranteId, usuarioId, mesaDestinoId })`:
 *     Mueve un pedido de una mesa a otra (caso "el cliente cambia
 *     de mesa"). Graba la huella en `transferido_de_mesa_id`.
 *
 *   - `mergeTables({ restauranteId, usuarioId, mesaOrigenId, mesaDestinoId })`:
 *     Mueve TODOS los pedidos activos de la mesa origen a la
 *     destino. Si la mesa origen tiene un solo pedido, equivale a
 *     transfer; si tiene varios, los movemos uno por uno.
 *
 * Todas las operaciones corren en transacción con `FOR UPDATE` para
 * evitar race conditions (dos cajeros splitteando el mismo pedido,
 * por ejemplo).
 */
import { getConnection } from '../config/database.js';
import { ORDER_STATES } from '../models/Order.js';
import * as PedidoModel from '../models/pos/Pedido.js';
import * as Pago from '../models/pos/Pago.js';
import * as AuditLog from '../models/AuditLog.js';
import { emitToRestaurant } from '../socket/socketHandler.js';

const TOLERANCIA = 0.01; // 1 centavo de tolerancia por redondeo.

function rechazar(mensaje, statusCode = 400) {
  const e = new Error(mensaje);
  e.statusCode = statusCode;
  return e;
}

// ========== A) addPaymentToOrder — pago parcial ==========

export async function addPaymentToOrder({
  pedidoId, restauranteId, usuarioId, pagos: pagosInput,
  cajaSesionId = null, itemsPagados = null,
}) {
  if (!Array.isArray(pagosInput) || pagosInput.length === 0) {
    throw rechazar('pagos (array no vacío) es requerido');
  }
  for (const p of pagosInput) {
    if (!p.metodo) throw rechazar('Cada pago debe traer metodo');
    if (!(Number(p.monto) > 0)) throw rechazar('Cada pago debe traer monto > 0');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Lock sobre el pedido.
    const [pedidoRows] = await connection.query(
      `SELECT id, estado, total, mesa_id, restaurante_id, estado_pago
         FROM pedidos
        WHERE id = ? FOR UPDATE`,
      [Number(pedidoId)]
    );
    if (pedidoRows.length === 0) throw rechazar('Pedido no encontrado', 404);
    const pedido = pedidoRows[0];
    if (Number(pedido.restaurante_id) !== Number(restauranteId)) {
      throw rechazar('El pedido no pertenece a este restaurante', 403);
    }
    if (pedido.estado === ORDER_STATES.ENTREGADO || pedido.estado === ORDER_STATES.CANCELADO) {
      throw rechazar(`El pedido ya está "${pedido.estado}", no se puede cobrar`, 409);
    }

    // 2) Calcular suma de pagos previos (en este pedido).
    const [prevRows] = await connection.query(
      `SELECT COALESCE(SUM(monto), 0) AS pagado
         FROM pagos
        WHERE pedido_id = ?`,
      [Number(pedidoId)]
    );
    const pagadoPrevio = Number(prevRows[0]?.pagado || 0);
    const totalPedido = Number(pedido.total);
    const sumaPagos = pagosInput.reduce((s, p) => s + Number(p.monto), 0);
    const sumaAcumulada = pagadoPrevio + sumaPagos;

    // 3) Validar que no se pase del total (tolerancia de 1 centavo).
    if (sumaAcumulada - totalPedido > TOLERANCIA) {
      throw rechazar(
        `Suma acumulada ($${sumaAcumulada.toFixed(2)}) supera el total del pedido ($${totalPedido.toFixed(2)})`,
        400
      );
    }

    // 4) Insertar cada pago nuevo.
    const pagosCreados = [];
    const itemsJson = itemsPagados ? JSON.stringify(itemsPagados) : null;
    for (const p of pagosInput) {
      const [r] = await connection.query(
        `INSERT INTO pagos
           (pedido_id, restaurante_id, metodo, monto, propina, descuento,
            referencia_externa, recibido_por, caja_sesion_id, items_pagados_json, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
          itemsJson,
        ]
      );
      pagosCreados.push(r.insertId);
    }

    // 5) Decidir el nuevo estado de pago y, si corresponde, pasar a Entregado.
    let nuevoEstadoPago = 'parcial';
    let pedidoCompletado = false;
    if (Math.abs(sumaAcumulada - totalPedido) <= TOLERANCIA) {
      nuevoEstadoPago = 'pagado';
      pedidoCompletado = true;
    } else if (sumaAcumulada <= 0) {
      nuevoEstadoPago = 'impago';
    }

    await connection.query(
      `UPDATE pedidos SET estado_pago = ?, actualizado_en = NOW() WHERE id = ?`,
      [nuevoEstadoPago, Number(pedidoId)]
    );

    if (pedidoCompletado) {
      await connection.query(
        `UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?`,
        [ORDER_STATES.ENTREGADO, Number(pedidoId)]
      );
      if (pedido.mesa_id) {
        await connection.query(
          `UPDATE mesas SET estado = 'libre' WHERE id = ? AND estado = 'ocupada'`,
          [pedido.mesa_id]
        );
      }
    }

    await connection.commit();

    // 6) Auditoría + sockets (best-effort, fuera de transacción).
    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: pedidoCompletado ? 'caja.charge' : 'caja.charge_partial',
      entidad_tipo: 'pedidos',
      entidad_id: pedidoId,
      datos_despues: {
        pagos: pagosInput.map((p) => ({ metodo: p.metodo, monto: p.monto })),
        suma_previa: pagadoPrevio,
        suma_nueva: sumaPagos,
        suma_total: sumaAcumulada,
        estado_pago: nuevoEstadoPago,
        items_pagados: itemsPagados || null,
      },
    }).catch(() => { /* best effort */ });

    if (pedidoCompletado) {
      emitToRestaurant(Number(restauranteId), 'pos:order_paid', {
        pedido_id: pedidoId,
        total: totalPedido,
        pagos: pagosCreados.length,
        timestamp: new Date().toISOString(),
      });
    } else {
      emitToRestaurant(Number(restauranteId), 'pos:order_paid_partial', {
        pedido_id: pedidoId,
        suma_acumulada: sumaAcumulada,
        pendiente: totalPedido - sumaAcumulada,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      pedido_id: pedidoId,
      pagos_ids: pagosCreados,
      caja_sesion_id: cajaSesionId,
      estado_pago: nuevoEstadoPago,
      pedido_completado: pedidoCompletado,
      suma_acumulada: sumaAcumulada,
      pendiente: Math.max(0, totalPedido - sumaAcumulada),
    };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

// ========== B) splitBillByItems — dividir por items ==========

/**
 * Divide un pedido en N pedidos hijos. Decisión de UX: el pedido
 * ORIGINAL se cancela con nota "dividido en N cuentas" para que el
 * cajero vea el historial. Los N hijos son pedidos nuevos
 * independientes que el cajero cobra después.
 *
 * `itemsPorCuenta`: array de { cuenta, items: [item_pedido_id, ...] }.
 * Se valida que la unión de items == items del pedido original
 * (no se pierde ni se duplica nada).
 */
export async function splitBillByItems({
  pedidoId, restauranteId, usuarioId, itemsPorCuenta,
}) {
  if (!Array.isArray(itemsPorCuenta) || itemsPorCuenta.length < 2) {
    throw rechazar('itemsPorCuenta debe ser un array de 2+ cuentas', 400);
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Lock sobre el pedido.
    const [pedidoRows] = await connection.query(
      `SELECT p.id, p.estado, p.total, p.mesa_id, p.restaurante_id,
              p.creado_por, p.notas, p.canal
         FROM pedidos p
        WHERE p.id = ? FOR UPDATE`,
      [Number(pedidoId)]
    );
    if (pedidoRows.length === 0) throw rechazar('Pedido no encontrado', 404);
    const pedido = pedidoRows[0];
    if (Number(pedido.restaurante_id) !== Number(restauranteId)) {
      throw rechazar('El pedido no pertenece a este restaurante', 403);
    }
    if (pedido.estado === ORDER_STATES.ENTREGADO || pedido.estado === ORDER_STATES.CANCELADO) {
      throw rechazar(`No se puede dividir un pedido "${pedido.estado}"`, 409);
    }
    if (pedido.estado_pago === 'pagado' || pedido.estado_pago === 'parcial') {
      throw rechazar(`No se puede dividir un pedido con pagos ya registrados (${pedido.estado_pago})`, 409);
    }

    // 2) Traer items del pedido original.
    const [items] = await connection.query(
      `SELECT id, producto_id, cantidad, precio_unitario, subtotal, notas
         FROM items_pedido
        WHERE pedido_id = ?
        ORDER BY id ASC`,
      [Number(pedidoId)]
    );
    const itemsMap = new Map(items.map((it) => [Number(it.id), it]));
    const originalIds = items.map((it) => Number(it.id));

    // 3) Validar que la partición cubre EXACTAMENTE los items originales.
    const asignados = new Set();
    for (const c of itemsPorCuenta) {
      if (!Array.isArray(c.items)) throw rechazar(`Cuenta ${c.cuenta}: items debe ser array`, 400);
      for (const iid of c.items) {
        const id = Number(iid);
        if (!itemsMap.has(id)) {
          throw rechazar(`Item ${id} no pertenece al pedido original`, 400);
        }
        if (asignados.has(id)) {
          throw rechazar(`Item ${id} asignado a más de una cuenta`, 400);
        }
        asignados.add(id);
      }
    }
    for (const id of originalIds) {
      if (!asignados.has(id)) {
        throw rechazar(`Falta asignar item ${id} a alguna cuenta`, 400);
      }
    }

    // 4) Para cada cuenta, crear un pedido hijo con sus items.
    const hijos = [];
    for (const c of itemsPorCuenta) {
      let totalHijo = 0;
      const itemsHijo = [];
      for (const iid of c.items) {
        const it = itemsMap.get(Number(iid));
        totalHijo += Number(it.subtotal);
        itemsHijo.push(it);
      }
      const [rHijo] = await connection.query(
        `INSERT INTO pedidos
           (usuario_id, restaurante_id, mesa_id, total, estado, canal,
            creado_por, notas, estado_pago, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, 'Listo', ?, ?, ?, 'impago', NOW(), NOW())`,
        [
          pedido.usuario_id,            // heredamos el dueño del cliente si lo hay
          Number(restauranteId),
          pedido.mesa_id,               // heredamos la mesa
          totalHijo.toFixed(2),
          pedido.canal || 'pos',
          Number(usuarioId),            // creado_por = staff que dividió
          `Split de pedido #${pedidoId} (cuenta ${c.cuenta})`,
        ]
      );
      const pedidoHijoId = rHijo.insertId;
      for (const it of itemsHijo) {
        await connection.query(
          `INSERT INTO items_pedido
             (pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pedidoHijoId, it.producto_id, it.cantidad, it.precio_unitario, it.subtotal, it.notas]
        );
      }
      hijos.push({ pedido_id: pedidoHijoId, cuenta: c.cuenta, total: totalHijo, items: itemsHijo.length });
    }

    // 5) Marcar el pedido original como Cancelado con nota explicativa.
    await connection.query(
      `UPDATE pedidos
          SET estado = 'Cancelado',
              motivo_cancelacion = ?,
              estado_pago = 'impago',
              actualizado_en = NOW()
        WHERE id = ?`,
      [`Dividido en ${itemsPorCuenta.length} cuentas`, Number(pedidoId)]
    );

    await connection.commit();

    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: 'pedido.split',
      entidad_tipo: 'pedidos',
      entidad_id: pedidoId,
      datos_despues: {
        cuentas: itemsPorCuenta.length,
        hijos: hijos.map((h) => h.pedido_id),
      },
    }).catch(() => { /* best effort */ });

    emitToRestaurant(Number(restauranteId), 'pos:order_split', {
      pedido_original_id: pedidoId,
      hijos: hijos.map((h) => h.pedido_id),
      timestamp: new Date().toISOString(),
    });

    return { pedido_original_id: pedidoId, hijos };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

// ========== C) transferOrder — mover pedido de mesa ==========

export async function transferOrder({
  pedidoId, restauranteId, usuarioId, mesaDestinoId,
}) {
  const mesaDest = Number(mesaDestinoId);
  if (!Number.isInteger(mesaDest) || mesaDest <= 0) {
    throw rechazar('mesaDestinoId es requerido y debe ser entero positivo', 400);
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Lock sobre el pedido.
    const [pedidoRows] = await connection.query(
      `SELECT id, estado, total, mesa_id, restaurante_id, estado_pago
         FROM pedidos
        WHERE id = ? FOR UPDATE`,
      [Number(pedidoId)]
    );
    if (pedidoRows.length === 0) throw rechazar('Pedido no encontrado', 404);
    const pedido = pedidoRows[0];
    if (Number(pedido.restaurante_id) !== Number(restauranteId)) {
      throw rechazar('El pedido no pertenece a este restaurante', 403);
    }
    if (!pedido.mesa_id) {
      throw rechazar('El pedido no está en una mesa (es pickup/domicilio), no se puede transferir', 400);
    }
    if (Number(pedido.mesa_id) === mesaDest) {
      throw rechazar('La mesa destino es la misma que la actual', 400);
    }
    if (pedido.estado === ORDER_STATES.ENTREGADO || pedido.estado === ORDER_STATES.CANCELADO) {
      throw rechazar(`No se puede transferir un pedido "${pedido.estado}"`, 409);
    }

    // 2) Lock sobre la mesa destino.
    const [mesaRows] = await connection.query(
      `SELECT id, estado, restaurante_id FROM mesas WHERE id = ? FOR UPDATE`,
      [mesaDest]
    );
    if (mesaRows.length === 0) throw rechazar('Mesa destino no encontrada', 404);
    const mesa = mesaRows[0];
    if (Number(mesa.restaurante_id) !== Number(restauranteId)) {
      throw rechazar('La mesa destino no pertenece a este restaurante', 403);
    }
    if (mesa.estado !== 'libre') {
      throw rechazar(`La mesa destino está "${mesa.estado}", solo se puede transferir a una mesa libre`, 409);
    }

    const mesaOrigenId = Number(pedido.mesa_id);

    // 3) UPDATE del pedido: nueva mesa + huella de origen.
    await connection.query(
      `UPDATE pedidos
          SET mesa_id = ?, transferido_de_mesa_id = ?, actualizado_en = NOW()
        WHERE id = ?`,
      [mesaDest, mesaOrigenId, Number(pedidoId)]
    );

    // 4) Liberar mesa origen (si no tiene OTROS pedidos activos).
    const [otrosEnOrigen] = await connection.query(
      `SELECT COUNT(*) AS c FROM pedidos
        WHERE mesa_id = ? AND id != ? AND estado NOT IN ('Cancelado','Entregado')`,
      [mesaOrigenId, Number(pedidoId)]
    );
    if (Number(otrosEnOrigen[0]?.c || 0) === 0) {
      await connection.query(
        `UPDATE mesas SET estado = 'libre' WHERE id = ?`,
        [mesaOrigenId]
      );
    }

    // 5) Ocupar mesa destino.
    await connection.query(
      `UPDATE mesas SET estado = 'ocupada' WHERE id = ?`,
      [mesaDest]
    );

    await connection.commit();

    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: 'pedido.transferred',
      entidad_tipo: 'pedidos',
      entidad_id: pedidoId,
      datos_despues: { mesa_origen_id: mesaOrigenId, mesa_destino_id: mesaDest },
    }).catch(() => { /* best effort */ });

    emitToRestaurant(Number(restauranteId), 'pos:order_transferred', {
      pedido_id: pedidoId,
      mesa_origen_id: mesaOrigenId,
      mesa_destino_id: mesaDest,
      timestamp: new Date().toISOString(),
    });

    return {
      pedido_id: pedidoId,
      mesa_origen_id: mesaOrigenId,
      mesa_destino_id: mesaDest,
    };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

// ========== D) mergeTables — fusionar mesas ==========

/**
 * Mueve TODOS los pedidos activos de la mesa origen a la mesa
 * destino. Si la mesa origen tiene 1 solo pedido, es equivalente
 * a transferOrder pero opera en lote (y registra una sola auditoría).
 *
 * Pre-condición:
 *   - mesa origen y destino pertenecen al restaurante
 *   - mesa origen está 'ocupada' (al menos 1 pedido activo)
 *   - mesa destino está 'ocupada' (es la receptora de los pedidos)
 */
export async function mergeTables({
  restauranteId, usuarioId, mesaOrigenId, mesaDestinoId,
}) {
  const origen = Number(mesaOrigenId);
  const destino = Number(mesaDestinoId);
  if (!Number.isInteger(origen) || !Number.isInteger(destino)) {
    throw rechazar('mesaOrigenId y mesaDestinoId son requeridos', 400);
  }
  if (origen === destino) {
    throw rechazar('La mesa origen y destino no pueden ser la misma', 400);
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Lock sobre ambas mesas (en orden ascendente para evitar deadlocks).
    const [ids] = [[origen, destino].sort((a, b) => a - b)];
    await connection.query(
      `SELECT id FROM mesas WHERE id IN (?, ?) FOR UPDATE`,
      [ids[0], ids[1]]
    );

    // 2) Validar que ambas mesas existen y son del restaurante.
    const [mesasRows] = await connection.query(
      `SELECT id, estado, restaurante_id FROM mesas WHERE id IN (?, ?)`,
      [origen, destino]
    );
    if (mesasRows.length !== 2) {
      throw rechazar('Una o ambas mesas no existen', 404);
    }
    const mesaOr = mesasRows.find((m) => Number(m.id) === origen);
    const mesaDe = mesasRows.find((m) => Number(m.id) === destino);
    if (Number(mesaOr.restaurante_id) !== Number(restauranteId) ||
        Number(mesaDe.restaurante_id) !== Number(restauranteId)) {
      throw rechazar('Las mesas no pertenecen a este restaurante', 403);
    }
    if (mesaOr.estado !== 'ocupada') {
      throw rechazar(`La mesa origen está "${mesaOr.estado}", no se puede fusionar`, 409);
    }
    if (mesaDe.estado !== 'ocupada' && mesaDe.estado !== 'libre') {
      throw rechazar(`La mesa destino está "${mesaDe.estado}", no se puede recibir pedidos`, 409);
    }

    // 3) Traer pedidos activos de la mesa origen.
    const [origenPedidos] = await connection.query(
      `SELECT id FROM pedidos
        WHERE mesa_id = ? AND estado NOT IN ('Cancelado','Entregado')`,
      [origen]
    );
    if (origenPedidos.length === 0) {
      throw rechazar('La mesa origen no tiene pedidos activos para mover', 409);
    }

    // 4) Mover cada pedido a la mesa destino, grabando la huella.
    const pedidosMovidos = [];
    for (const { id } of origenPedidos) {
      await connection.query(
        `UPDATE pedidos
            SET mesa_id = ?, transferido_de_mesa_id = ?, actualizado_en = NOW()
          WHERE id = ?`,
        [destino, origen, Number(id)]
      );
      pedidosMovidos.push(Number(id));
    }

    // 5) Mesa origen → libre. Mesa destino → ocupada.
    await connection.query(`UPDATE mesas SET estado = 'libre' WHERE id = ?`, [origen]);
    await connection.query(`UPDATE mesas SET estado = 'ocupada' WHERE id = ?`, [destino]);

    await connection.commit();

    AuditLog.createLog({
      admin_id: Number(usuarioId),
      accion: 'mesas.merged',
      entidad_tipo: 'mesas',
      entidad_id: destino,
      datos_despues: { mesa_origen_id: origen, mesa_destino_id: destino, pedidos_movidos: pedidosMovidos },
    }).catch(() => { /* best effort */ });

    emitToRestaurant(Number(restauranteId), 'pos:tables_merged', {
      mesa_origen_id: origen,
      mesa_destino_id: destino,
      pedidos_movidos: pedidosMovidos,
      timestamp: new Date().toISOString(),
    });

    return { mesa_origen_id: origen, mesa_destino_id: destino, pedidos_movidos: pedidosMovidos };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export default {
  addPaymentToOrder,
  splitBillByItems,
  transferOrder,
  mergeTables,
};
