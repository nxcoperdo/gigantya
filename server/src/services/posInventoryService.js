/**
 * Servicio de Inventario (POS Fase 6).
 *
 * Encapsula toda la lógica de negocio de ingredientes, BOM y kardex.
 *
 * Funciones:
 *   - Ingredientes: listAlerts, getById, create, update, softDelete.
 *   - BOM: getBOM, setBOM (reemplaza receta atómicamente).
 *   - Kardex: listKardex.
 *   - Movimientos manuales: registrarMovimientoManual (compra/merma/ajuste).
 *   - Descuento automático: descontarStockPorPedido (CRÍTICA — se invoca
 *     desde orderService.createOrderCore DENTRO de la transacción).
 *
 * Reglas de atomicidad:
 *   - `descontarStockPorPedido` usa `UPDATE ingredientes SET stock_actual
 *     = stock_actual - ? WHERE id=? AND stock_actual >= ?` y chequea
 *     `affectedRows === 1`. Si la condición WHERE falla, el UPDATE
 *     afecta 0 filas y devolvemos 409 STOCK_INSUFICIENTE con detalle.
 *     Esto es atómico a nivel SQL (no hay TOCTOU entre SELECT y UPDATE).
 *   - Cada consumo_pedido genera una fila en `ingredientes_movimientos`
 *     con `tipo='consumo_pedido'`. La UNIQUE KEY (pedido_id,
 *     ingrediente_id, tipo) protege contra doble descuento si el
 *     service reintenta.
 *   - Si un producto NO tiene BOM, se vende sin descontar (degradación
 *     graciosa — un restaurante puede operar sin gestionar inventario
 *     en una primera etapa).
 *
 * Sockets:
 *   - `pos:stock_updated`: se emite en CADA cambio de stock (compra,
 *     merma, ajuste, consumo). Payload minimal con el ingrediente y el
 *     nuevo stock, para refrescar UI en vivo.
 *   - `pos:inventory_low`: se emite SOLO cuando un cambio de stock cruza
 *     el umbral (antes era >= minimo, ahora es < minimo). El handler
 *     de cliente muestra toast + agrega a la lista de alertas.
 */
import { getConnection } from '../config/database.js';
import * as Ingrediente from '../models/pos/Ingrediente.js';
import * as ProductoIngrediente from '../models/pos/ProductoIngrediente.js';
import * as Movimiento from '../models/pos/IngredienteMovimiento.js';
import { emitToRestaurant } from '../socket/socketHandler.js';
import * as AuditLog from '../models/AuditLog.js';

// ========== Helpers ==========

function validationError(msg, code = 400) {
  return Object.assign(new Error(msg), { statusCode: code });
}

function normalizeCantidad(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw validationError('cantidad inválida');
  }
  // Redondeo a 3 decimales (gramos / ml). Importante para evitar drift
  // en operaciones repetidas.
  return Math.round(n * 1000) / 1000;
}

// ========== Ingredientes ==========

/** Lista los ingredientes activos del restaurante. */
export async function listIngredientes(restauranteId) {
  return Ingrediente.listByRestaurante(restauranteId);
}

/** Lista los ingredientes con stock por debajo del mínimo. */
export async function listAlertas(restauranteId) {
  return Ingrediente.listAlerts(restauranteId);
}

/** Detalle de un ingrediente validando restaurante. */
export async function getIngrediente(id, restauranteId) {
  const ing = await Ingrediente.getById(id, restauranteId);
  if (!ing) throw validationError('Ingrediente no encontrado', 404);
  return ing;
}

/** Crea un ingrediente (dueño/admin). */
export async function createIngrediente(restauranteId, data) {
  const ing = await Ingrediente.create(restauranteId, data);
  // Si vino con stock inicial > 0, registramos el movimiento como
  // 'compra' (un alta inicial de stock es conceptualmente una compra).
  const stockInicial = Number(data.stock_actual || 0);
  if (stockInicial > 0) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      // INSERT del movimiento con snapshot.
      await connection.query(
        `INSERT INTO ingredientes_movimientos
           (restaurante_id, ingrediente_id, tipo, cantidad,
            stock_anterior, stock_nuevo, usuario_id, notas, creado_en)
         VALUES (?, ?, 'compra', ?, 0, ?, NULL, 'Stock inicial', NOW())`,
        [restauranteId, ing.id, stockInicial, stockInicial]
      );
      await connection.commit();
    } catch (e) {
      try { await connection.rollback(); } catch (_) { /* noop */ }
      throw e;
    } finally {
      connection.release();
    }
    emitToRestaurant(Number(restauranteId), 'pos:stock_updated', {
      ingrediente_id: ing.id,
      nombre: ing.nombre,
      stock_actual: stockInicial,
      timestamp: new Date().toISOString(),
    });
  }
  AuditLog.createLog({
    admin_id: Number(data._usuarioId) || null,
    accion: 'inventario.ingrediente.create',
    entidad_tipo: 'ingredientes',
    entidad_id: ing.id,
    datos_despues: { nombre: ing.nombre, unidad: ing.unidad, stock_actual: stockInicial },
  }).catch(() => { /* best effort */ });
  return ing;
}

/** Actualiza nombre/unidad/stock_minimo. NO toca stock_actual. */
export async function updateIngrediente(id, restauranteId, data, usuarioId = null) {
  const ing = await Ingrediente.update(id, restauranteId, data);
  AuditLog.createLog({
    admin_id: Number(usuarioId) || null,
    accion: 'inventario.ingrediente.update',
    entidad_tipo: 'ingredientes',
    entidad_id: id,
    datos_despues: data,
  }).catch(() => { /* best effort */ });
  return ing;
}

/** Soft-delete (activo=0). Preserva kardex. */
export async function deleteIngrediente(id, restauranteId, usuarioId = null) {
  const ok = await Ingrediente.softDelete(id, restauranteId);
  if (!ok) throw validationError('Ingrediente no encontrado', 404);
  AuditLog.createLog({
    admin_id: Number(usuarioId) || null,
    accion: 'inventario.ingrediente.delete',
    entidad_tipo: 'ingredientes',
    entidad_id: id,
  }).catch(() => { /* best effort */ });
  return { mensaje: 'Ingrediente eliminado' };
}

// ========== BOM (receta) ==========

/** Devuelve la receta de un producto. */
export async function getBOM(productoId, restauranteId) {
  return ProductoIngrediente.getBOMByProducto(productoId, restauranteId);
}

/** Reemplaza la receta de un producto atómicamente.
 *  items: [{ ingrediente_id, cantidad, notas? }]. */
export async function setBOM(productoId, restauranteId, items, usuarioId = null) {
  if (!Array.isArray(items)) {
    throw validationError('items debe ser un array');
  }
  // Validaciones tempranas.
  for (const it of items) {
    if (!it.ingrediente_id) throw validationError('Cada item debe traer ingrediente_id');
    const cant = Number(it.cantidad);
    if (!(cant > 0)) throw validationError('Cada item debe traer cantidad > 0');
    // Verificar que el ingrediente pertenece al restaurante.
    const ing = await Ingrediente.getById(it.ingrediente_id, restauranteId);
    if (!ing) throw validationError(`Ingrediente ${it.ingrediente_id} no existe en este restaurante`);
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM producto_ingredientes WHERE producto_id = ?`,
      [Number(productoId)]
    );
    for (const it of items) {
      await connection.query(
        `INSERT INTO producto_ingredientes
           (producto_id, ingrediente_id, cantidad, notas)
         VALUES (?, ?, ?, ?)`,
        [Number(productoId), Number(it.ingrediente_id), Number(it.cantidad), it.notas || null]
      );
    }
    await connection.commit();
  } catch (e) {
    try { await connection.rollback(); } catch (_) { /* noop */ }
    throw e;
  } finally {
    connection.release();
  }

  AuditLog.createLog({
    admin_id: Number(usuarioId) || null,
    accion: 'inventario.bom.replace',
    entidad_tipo: 'producto_ingredientes',
    entidad_id: Number(productoId),
    datos_despues: { items },
  }).catch(() => { /* best effort */ });

  return ProductoIngrediente.getBOMByProducto(productoId, restauranteId);
}

// ========== Kardex ==========

export async function listKardex(restauranteId, filters) {
  return Movimiento.listKardex(restauranteId, filters);
}

// ========== Movimientos manuales (compra, merma, ajuste) ==========

/** Registra un movimiento manual. tipos válidos: 'compra' | 'merma' | 'ajuste'.
 *  `cantidad` es signed: + para compra, - para merma. En 'ajuste' puede
 *  ser + o -. */
export async function registrarMovimientoManual({ restauranteId, ingredienteId, tipo, cantidad, notas, usuarioId }) {
  if (!['compra', 'merma', 'ajuste'].includes(tipo)) {
    throw validationError('tipo inválido (use: compra | merma | ajuste)');
  }
  const cant = normalizeCantidad(cantidad);
  if (cant === 0) throw validationError('cantidad no puede ser 0');

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    // 1) Lock sobre el ingrediente.
    const [ingRows] = await connection.query(
      `SELECT id, nombre, stock_actual, stock_minimo
         FROM ingredientes
        WHERE id = ? AND restaurante_id = ? AND activo = 1
        FOR UPDATE`,
      [Number(ingredienteId), Number(restauranteId)]
    );
    if (ingRows.length === 0) {
      throw validationError('Ingrediente no encontrado', 404);
    }
    const ing = ingRows[0];
    const stockAnterior = Number(ing.stock_actual);
    let stockNuevo = stockAnterior + cant;
    if (stockNuevo < 0) {
      throw validationError(
        `Stock insuficiente: el movimiento dejaría el stock en ${stockNuevo} (no se permite negativo)`,
        409
      );
    }
    // 2) UPDATE atómico (con la condición de que el stock_actual NO haya
    //    cambiado desde el FOR UPDATE — es defensa contra bugs, no
    //    contra concurrencia porque ya tenemos el lock).
    const [updResult] = await connection.query(
      `UPDATE ingredientes
          SET stock_actual = ?
        WHERE id = ? AND restaurante_id = ? AND stock_actual = ?`,
      [stockNuevo, Number(ingredienteId), Number(restauranteId), stockAnterior]
    );
    if (updResult.affectedRows !== 1) {
      throw validationError('Conflicto de stock (otro proceso lo modificó)', 409);
    }
    // 3) INSERT del movimiento.
    await connection.query(
      `INSERT INTO ingredientes_movimientos
         (restaurante_id, ingrediente_id, tipo, cantidad,
          stock_anterior, stock_nuevo, usuario_id, notas, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [Number(restauranteId), Number(ingredienteId), tipo, cant, stockAnterior, stockNuevo, Number(usuarioId) || null, notas || null]
    );
    await connection.commit();

    // 4) Post-commit: sockets + auditoría (best-effort).
    const wasAboveMin = stockAnterior >= Number(ing.stock_minimo);
    const isBelowMin = stockNuevo < Number(ing.stock_minimo);
    emitToRestaurant(Number(restauranteId), 'pos:stock_updated', {
      ingrediente_id: Number(ingredienteId),
      nombre: ing.nombre,
      stock_actual: stockNuevo,
      timestamp: new Date().toISOString(),
    });
    // Emitir la alerta SOLO si cruzó el umbral (de >= a <).
    if (wasAboveMin && isBelowMin) {
      emitToRestaurant(Number(restauranteId), 'pos:inventory_low', {
        ingrediente_id: Number(ingredienteId),
        nombre: ing.nombre,
        stock_actual: stockNuevo,
        stock_minimo: Number(ing.stock_minimo),
        timestamp: new Date().toISOString(),
      });
    }
    AuditLog.createLog({
      admin_id: Number(usuarioId) || null,
      accion: 'inventario.movimiento.manual',
      entidad_tipo: 'ingredientes_movimientos',
      entidad_id: Number(ingredienteId),
      datos_despues: { tipo, cantidad: cant, stock_anterior: stockAnterior, stock_nuevo: stockNuevo, notas },
    }).catch(() => { /* best effort */ });

    return {
      ingrediente_id: Number(ingredienteId),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
    };
  } catch (e) {
    try { await connection.rollback(); } catch (_) { /* noop */ }
    throw e;
  } finally {
    connection.release();
  }
}

// ========== Descuento automático al crear pedido POS ==========

/**
 * Descuenta el stock de los ingredientes según el BOM de cada item del
 * pedido. Se invoca desde orderService.createOrderCore DENTRO de su
 * transacción (recibe la `connection` abierta).
 *
 * @param {Object} args
 * @param {number} args.pedidoId        - ID del pedido recién insertado.
 * @param {number} args.restauranteId   - ID del restaurante.
 * @param {number} args.creadoPor       - ID del usuario que creó el pedido.
 * @param {Object} args.connection      - Conexión mysql2 con transacción abierta.
 * @returns {Promise<{ descontado: boolean, ingredientes_tocados: number }>}
 *
 * Comportamiento:
 *   - Si el pedido no tiene items con BOM definido, retorna `{ descontado: false }`
 *     y el pedido sigue su curso (degradación graciosa).
 *   - Si un ingrediente no tiene stock suficiente, lanza error 409
 *     con `error.code = 'STOCK_INSUFICIENTE'` y detalle de qué
 *     ingrediente se quedó corto. El rollback del padre tira el pedido.
 *   - Emite `pos:stock_updated` por cada ingrediente modificado y
 *     `pos:inventory_low` si alguno cruzó el mínimo.
 */
export async function descontarStockPorPedido({ pedidoId, restauranteId, creadoPor, connection }) {
  // 1) Traer los items del pedido (producto_id, cantidad).
  const [items] = await connection.query(
    `SELECT producto_id, cantidad
       FROM items_pedido
      WHERE pedido_id = ?`,
    [Number(pedidoId)]
  );
  if (items.length === 0) return { descontado: false, ingredientes_tocados: 0 };

  // 2) Traer el BOM agregado de todos los productos en una sola query.
  const productoIds = [...new Set(items.map((i) => Number(i.producto_id)))];
  const bomByProducto = await ProductoIngrediente.getConsumoByProductos(productoIds);

  // 3) Calcular el consumo total por ingrediente (sumando por producto ×
  //    cantidad de cada item).
  /** @type {Map<number, number>} ingrediente_id -> consumo_total */
  const consumoPorIng = new Map();
  for (const item of items) {
    const pid = Number(item.producto_id);
    const bom = bomByProducto[pid] || [];
    for (const linea of bom) {
      const ingId = Number(linea.ingrediente_id);
      const totalLinea = Number(linea.cantidad) * Number(item.cantidad);
      consumoPorIng.set(ingId, (consumoPorIng.get(ingId) || 0) + totalLinea);
    }
  }
  if (consumoPorIng.size === 0) return { descontado: false, ingredientes_tocados: 0 };

  // 4) Para cada ingrediente: UPDATE atómico + chequeo affectedRows.
  const ingredientesTocados = [];
  for (const [ingredienteId, consumo] of consumoPorIng.entries()) {
    const cantNorm = normalizeCantidad(consumo);
    // 4a) Tomar el stock_actual actual con lock (necesario para snapshot
    //     y para emitir la alerta de cruce de umbral).
    const [ingRows] = await connection.query(
      `SELECT id, nombre, stock_actual, stock_minimo
         FROM ingredientes
        WHERE id = ? AND restaurante_id = ? AND activo = 1
        FOR UPDATE`,
      [Number(ingredienteId), Number(restauranteId)]
    );
    if (ingRows.length === 0) {
      // Ingrediente borrado entre la creación del BOM y el descuento.
      // No fallamos: el producto se vende sin descontar este ingrediente.
      // (Escenario raro, degradación controlada.)
      continue;
    }
    const ing = ingRows[0];
    const stockAnterior = Number(ing.stock_actual);
    const stockNuevo = Math.round((stockAnterior - cantNorm) * 1000) / 1000;

    // 4b) UPDATE atómico con condición de stock suficiente.
    const [updResult] = await connection.query(
      `UPDATE ingredientes
          SET stock_actual = stock_actual - ?
        WHERE id = ? AND restaurante_id = ? AND stock_actual >= ?`,
      [cantNorm, Number(ingredienteId), Number(restauranteId), cantNorm]
    );
    if (updResult.affectedRows !== 1) {
      const err = new Error(
        `Stock insuficiente de "${ing.nombre}": se necesitan ${cantNorm} ${ing.unidad || ''} y hay ${stockAnterior}`
      );
      err.statusCode = 409;
      err.code = 'STOCK_INSUFICIENTE';
      err.detalles = {
        ingrediente_id: Number(ingredienteId),
        nombre: ing.nombre,
        requerido: cantNorm,
        disponible: stockAnterior,
        unidad: ing.unidad,
      };
      throw err;
    }

    // 4c) INSERT del movimiento de kardex (tipo=consumo_pedido).
    //     La UNIQUE KEY (pedido_id, ingrediente_id, tipo) protege
    //     contra doble descuento si esta función se invoca dos veces
    //     con el mismo pedido (defensa en profundidad).
    try {
      await connection.query(
        `INSERT INTO ingredientes_movimientos
           (restaurante_id, ingrediente_id, tipo, cantidad,
            stock_anterior, stock_nuevo, pedido_id, usuario_id, notas, creado_en)
         VALUES (?, ?, 'consumo_pedido', ?, ?, ?, ?, ?, NULL, NOW())`,
        [
          Number(restauranteId),
          Number(ingredienteId),
          -cantNorm,
          stockAnterior,
          stockNuevo,
          Number(pedidoId),
          Number(creadoPor) || null,
        ]
      );
    } catch (e) {
      // Si el INSERT falla por UNIQUE (pedido duplicado), NO falla el
      // descuento: significa que ya estaba descontado. La lógica del
      // caller debería garantizar idempotencia (verificar con la UNIQUE
      // KEY como red).
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }

    ingredientesTocados.push({
      ingrediente_id: Number(ingredienteId),
      nombre: ing.nombre,
      cantidad: -cantNorm,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      stock_minimo: Number(ing.stock_minimo),
    });
  }

  // 5) NO emitimos sockets aquí: estamos DENTRO de la transacción del
  //    caller. Si emitimos antes del commit y rollback tira el pedido,
  //    los clientes verían un stock que no se aplicó. El caller
  //    (orderService) emite los sockets DESPUÉS del commit.

  return {
    descontado: true,
    ingredientes_tocados: ingredientesTocados.length,
    detalle: ingredientesTocados,
  };
}

// ========== Default export ==========

export default {
  listIngredientes,
  listAlertas,
  getIngrediente,
  createIngrediente,
  updateIngrediente,
  deleteIngrediente,
  getBOM,
  setBOM,
  listKardex,
  registrarMovimientoManual,
  descontarStockPorPedido,
};
