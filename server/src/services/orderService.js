/**
 * Servicio compartido para crear pedidos.
 *
 * ¿Por qué existe?
 *   El proyecto tiene dos flujos distintos para crear un pedido:
 *
 *   - Cliente web: `orderController.createOrder` valida `req.user.tipo_usuario === 'cliente'`,
 *     aplica lógica de cupones, recalcula envío por sector/barrio/coord, valida que
 *     el local ofrezca domicilio/consumo, y crea el pedido. Al final notifica al
 *     restaurante (interna + email).
 *
 *   - Staff POS: `posOrderController.createPosOrder` saltea la mayoría de esa
 *     lógica porque ya se validó en el frontend (el mesero seleccionó la mesa,
 *     la modalidad, los items) y porque el staff es de confianza (no valida
 *     cupones, no geocodifica). Pero al mismo tiempo debe RESERVAR la mesa
 *     (`SELECT ... FOR UPDATE` + `UPDATE mesas SET estado='ocupada'`).
 *
 *   El núcleo de "INSERT pedido + items + adiciones + snapshot de removibles"
 *   ES IDÉNTICO entre ambos flujos. Lo extrajimos a este service para no
 *   duplicarlo y para que cualquier cambio (ej. nuevo campo de auditoría)
 *   toque un solo lugar.
 *
 * ¿Qué hace este service?
 *   - `createOrderCore(orderData, options)`:
 *     1. Abre transacción.
 *     2. SELECT ... FOR UPDATE sobre los productos.
 *     3. Valida adiciones/removibles y hace snapshot.
 *     4. Resuelve cupón (si viene) y costos.
 *     5. Inserta el pedido (con `canal`, `mesa_id`, `creado_por` que el
 *        caller ya calculó).
 *     6. Inserta los items y las adiciones.
 *     7. Hace UPDATE de la mesa (si `mesa_id` y la operación es dine-in).
 *     8. Commit. Devuelve el id del pedido.
 *
 *   - `notificarNuevoPedido(pedidoId)`: dispara la notificación interna
 *     (NotificationModel) y externa (email). Idempotente: si la notificación
 *     falla, el pedido YA está creado y no se hace rollback.
 *
 * Decisiones:
 *   - NO re-validamos la modalidad (`es_retiro_local`, `es_consumo_en_local`):
 *     el caller ya la calculó según la regla del local. Acá solo persistimos.
 *   - La reserva de mesa (`UPDATE mesas SET estado='ocupada'`) se hace SOLO
 *     si `mesa_id` viene y la operación es dine-in. Si la mesa no existe o
 *     ya está ocupada, la transacción hace rollback.
 *   - El `total` se recalcula desde la BD si el frontend no envió uno válido
 *     (mismo fallback que `createOrderWithItems` original). Si lo envió, se
 *     respeta (evita inconsistencias con envío/impuestos ya calculados).
 */
import pool from '../config/database.js';
import { query as queryDirect } from '../config/database.js';
import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as NotificationModel from '../models/Notification.js';
import notificationService from './notificationService.js';
import * as posInventoryService from './posInventoryService.js';
import { emitToRestaurant } from '../socket/socketHandler.js';

const VALID_FORMAS_PAGO = ['contra_entrega', 'nequi', 'daviplata', 'bre_b'];
const VALID_ESTADOS_PEDIDO = ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado'];

/**
 * Crea un pedido en transacción.
 *
 * @param {Object} orderData
 * @param {number} orderData.usuario_id          - cliente que pide (siempre presente)
 * @param {number} orderData.restaurante_id
 * @param {Array}  orderData.items               - [{ producto_id, cantidad, adiciones?, removidos?, nota? }]
 * @param {string} [orderData.notas]
 * @param {string} [orderData.direccion_entrega]
 * @param {string} [orderData.telefono_contacto]
 * @param {number} [orderData.cupon_id]
 * @param {string} [orderData.metodo_pago='contra_entrega']
 * @param {number} [orderData.costo_envio=0]
 * @param {number} [orderData.barrio_id]
 * @param {number} [orderData.sector_id]
 * @param {number} [orderData.latitud]
 * @param {number} [orderData.longitud]
 * @param {string} [orderData.direccion_formateada]
 * @param {string} [orderData.place_id]
 * @param {boolean}[orderData.esRetiroLocal=false]
 * @param {boolean}[orderData.esConsumoEnLocal=false]
 * @param {number} [orderData.total]            - total enviado por frontend (opcional)
 * @param {string} orderData.canal              - 'web' | 'pos' | 'kiosko'
 * @param {number} [orderData.mesa_id]          - POS dine-in: id de la mesa
 * @param {number} [orderData.creado_por]       - POS: id del staff
 *
 * @param {Object} [options]
 * @param {string} [options.clientSource]       - 'web' | 'pos' — para logs
 *
 * @returns {Promise<number>} id del pedido creado
 */
export async function createOrderCore(orderData, options = {}) {
  const {
    usuario_id,
    restaurante_id,
    items,
    notas = '',
    direccion_entrega,
    telefono_contacto,
    coupon_id = null,
    metodo_pago = 'contra_entrega',
    costo_envio = 0,
    barrio_id = null,
    sector_id = null,
    latitud = null,
    longitud = null,
    direccion_formateada = null,
    place_id = null,
    esRetiroLocal = false,
    esConsumoEnLocal = false,
    total: totalFromRequest = null,
    canal = 'web',
    mesa_id = null,
    creado_por = null,
  } = orderData;

  // Validaciones tempranas (antes de pedir la conexión al pool).
  if (!restaurante_id) throw createValidationError('restaurante_id es requerido');
  if (!usuario_id)    throw createValidationError('usuario_id es requerido (cliente walk-in o registrado)');
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('items (array no vacío) es requerido');
  }
  if (!VALID_FORMAS_PAGO.includes(metodo_pago)) {
    throw createValidationError(`metodo_pago inválido. Use: ${VALID_FORMAS_PAGO.join(', ')}`);
  }
  if (canal && !['web', 'pos', 'kiosko'].includes(canal)) {
    throw createValidationError(`canal inválido: ${canal}`);
  }
  if (esRetiroLocal && esConsumoEnLocal) {
    throw createValidationError('El pedido no puede ser retiro Y consumo en el local a la vez');
  }

  const normalizedItems = OrderModel.normalizeOrderItems(items);
  const productIds = normalizedItems.map((i) => i.producto_id);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1) SELECT ... FOR UPDATE sobre los productos del pedido.
    const placeholders = productIds.map(() => '?').join(', ');
    const [products] = await connection.query(
      `SELECT id, restaurante_id, precio, disponible, estado
         FROM productos
        WHERE id IN (${placeholders})
        FOR UPDATE`,
      productIds
    );
    if (products.length !== normalizedItems.length) {
      throw createValidationError('Uno o más productos no existen');
    }
    const productsById = new Map(products.map((p) => [Number(p.id), p]));
    const pricedItems = normalizedItems.map((item) => {
      const product = productsById.get(item.producto_id);
      if (!product) {
        throw createValidationError(`Producto ${item.producto_id} no existe`);
      }
      if (Number(product.restaurante_id) !== Number(restaurante_id)) {
        throw createValidationError('Todos los productos deben pertenecer al restaurante seleccionado');
      }
      if (product.estado !== 'activo' || Number(product.disponible) !== 1) {
        throw createValidationError('Uno o más productos no están disponibles');
      }
      return { ...item, precio_unitario: Number(product.precio) };
    });

    // 2) Validar adiciones + removibles y armar snapshot (idéntico a Order.js original).
    const validatedItems = await validateAdicionesYRemovibles(connection, pricedItems);

    // 3) Cupón: si viene `coupon_id`, validar que pertenece al local (o es global).
    let coupon = null;
    if (coupon_id) {
      const [couponResult] = await connection.query(
        `SELECT * FROM cupones
          WHERE id = ?
            AND (es_global = 1 OR restaurante_id = ?)
          LIMIT 1`,
        [coupon_id, restaurante_id]
      );
      coupon = couponResult[0];
      if (!coupon) {
        throw createValidationError('Cupón no válido para este pedido');
      }
    }

    // 4) Config del restaurante (impuestos + envíos) — solo para el fallback de total.
    const [restaurantData] = await connection.query(
      'SELECT configuracion_impuestos, configuracion_envios FROM restaurantes WHERE id = ?',
      [restaurante_id]
    );
    const taxConfig = restaurantData?.configuracion_impuestos
      ? JSON.parse(restaurantData.configuracion_impuestos)
      : { activo: true, porcentaje: 8 };
    const shippingConfig = restaurantData?.configuracion_envios
      ? JSON.parse(restaurantData.configuracion_envios)
      : { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };

    // 5) Resolver costo de envío.
    //    Para POS: se respeta el costo_envio que el frontend calculó (si viene)
    //    y se ignora la geocodificación / sectores (el cliente web no está
    //    en la POS; el POS no usa lógica de envío salvo `costo_envio=0`
    //    explícito para dine-in/retiro).
    let resolvedCostoEnvio = Number(costo_envio) || 0;
    if (esRetiroLocal || esConsumoEnLocal) {
      resolvedCostoEnvio = 0;
    }
    let resolvedSectorId = sector_id ? Number(sector_id) : null;
    if (esRetiroLocal || esConsumoEnLocal) {
      resolvedSectorId = null;
    }

    // 6) Total: si el frontend lo mandó válido, lo respetamos.
    let total;
    if (totalFromRequest !== null && totalFromRequest !== undefined && Number(totalFromRequest) > 0) {
      total = Number(totalFromRequest);
    } else {
      const pricedForTotal = validatedItems.map((item) => ({
        precio_unitario: item.precio_unitario + item.suma_adiciones,
        cantidad: item.cantidad,
      }));
      const calc = OrderModel.calculateOrderTotal(
        pricedForTotal, coupon, taxConfig, shippingConfig, { costo_envio_override: resolvedCostoEnvio }
      );
      total = calc.total;
      if (calc.envio_gratis_aplicado) resolvedCostoEnvio = 0;
    }

    // 7) Determinar estado inicial.
    const estadoInicial = metodo_pago === 'contra_entrega'
      ? 'Pendiente'
      : 'Comprobante_enviado';

    // 8) Si es POS dine-in, RESERVAR la mesa (FOR UPDATE + UPDATE).
    if (mesa_id && esConsumoEnLocal) {
      const [mesaRows] = await connection.query(
        `SELECT id, estado FROM mesas WHERE id = ? AND restaurante_id = ? FOR UPDATE`,
        [mesa_id, restaurante_id]
      );
      if (!mesaRows[0]) {
        throw createValidationError(`Mesa ${mesa_id} no existe o no pertenece al restaurante`);
      }
      // Solo permitimos sentar la mesa si está `libre` o `reservada`. Si está
      // `ocupada`, alguien más la tomó primero (race condition evitada por FOR UPDATE).
      if (mesaRows[0].estado === 'ocupada') {
        throw createValidationError(`Mesa ${mesa_id} ya está ocupada`);
      }
      await connection.query(
        `UPDATE mesas SET estado = 'ocupada' WHERE id = ? AND restaurante_id = ?`,
        [mesa_id, restaurante_id]
      );
    }

    // 9) INSERT del pedido.
    const esModalidadSinEnvio = esRetiroLocal || esConsumoEnLocal;
    const insertDireccionEntrega = esModalidadSinEnvio ? null : (direccion_entrega ?? null);
    const insertBarrioId        = esModalidadSinEnvio ? null : (barrio_id ? Number(barrio_id) : null);
    const insertSectorId        = esModalidadSinEnvio ? null : resolvedSectorId;
    const insertCostoEnvio      = esModalidadSinEnvio ? 0 : resolvedCostoEnvio;
    const insertLatitud         = esModalidadSinEnvio ? null : (latitud ?? null);
    const insertLongitud        = esModalidadSinEnvio ? null : (longitud ?? null);
    const insertDireccionForm   = esModalidadSinEnvio ? null : (direccion_formateada || null);
    const insertPlaceId         = esModalidadSinEnvio ? null : (place_id || null);

    const [orderResult] = await connection.query(
      `INSERT INTO pedidos (
         usuario_id, restaurante_id, total, costo_envio, estado, metodo_pago,
         estado_validacion_pago, cupon_id, notas, direccion_entrega, telefono_contacto,
         barrio_id, sector_id, latitud, longitud, direccion_formateada, place_id,
         es_retiro_local, es_consumo_en_local, mesa_id, canal, creado_por,
         creado_en
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        usuario_id,
        restaurante_id,
        total,
        insertCostoEnvio,
        estadoInicial,
        metodo_pago,
        metodo_pago === 'contra_entrega' ? 'aprobado' : 'pendiente',
        coupon_id,
        notas,
        insertDireccionEntrega,
        telefono_contacto,
        insertBarrioId,
        insertSectorId,
        insertLatitud,
        insertLongitud,
        insertDireccionForm,
        insertPlaceId,
        esRetiroLocal ? 1 : 0,
        esConsumoEnLocal ? 1 : 0,
        mesa_id ? Number(mesa_id) : null,
        canal,
        creado_por ? Number(creado_por) : null,
      ]
    );
    const pedidoId = orderResult.insertId;

    // 10) INSERT de los items + adiciones.
    for (const item of validatedItems) {
      const subtotal = Number(
        ((item.precio_unitario + item.suma_adiciones) * item.cantidad).toFixed(2)
      );
      const removidosJson = item.removibles_snapshot && item.removibles_snapshot.length > 0
        ? JSON.stringify(item.removibles_snapshot)
        : null;
      const [insertResult] = await connection.query(
        `INSERT INTO items_pedido
           (pedido_id, producto_id, cantidad, precio_unitario, subtotal, especificaciones, removidos_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          subtotal,
          item.nota || null,
          removidosJson,
        ]
      );
      const itemPedidoId = insertResult.insertId;
      for (const ad of item.adiciones_snapshot) {
        await connection.query(
          `INSERT INTO items_pedido_adiciones
            (item_pedido_id, adicion_id, nombre, grupo_nombre, precio_unitario_adicion, cantidad, subtotal, creado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            itemPedidoId,
            ad.adicion_id,
            ad.nombre,
            ad.grupo_nombre || null,
            ad.precio_unitario_adicion,
            ad.cantidad,
            ad.subtotal,
          ]
        );
      }
    }

    // 11) Fase 6 — descontar stock de ingredientes según el BOM de cada
    //     item. Se hace DENTRO de la misma transacción: si algún
    //     ingrediente no tiene stock suficiente, este llamado lanza 409
    //     y el rollback del padre tira abajo el pedido entero.
    //
    //     La función devuelve un resumen con el detalle de ingredientes
    //     tocados (incluye stock_anterior / stock_nuevo / stock_minimo)
    //     que usamos post-commit para emitir los sockets. NO emitimos
    //     sockets acá porque estamos dentro de la transacción.
    const descuentoStock = await posInventoryService.descontarStockPorPedido({
      pedidoId,
      restauranteId: Number(restaurante_id),
      creadoPor: Number(creado_por) || null,
      connection,
    });

    await connection.commit();

    // 11.b) Post-commit: emitir sockets de inventario si el descuento
    //       efectivamente ocurrió. Si no, no se emite nada (no hay
    //       cambio de stock que reportar).
    if (descuentoStock.descontado && descuentoStock.detalle) {
      for (const ing of descuentoStock.detalle) {
        emitToRestaurant(Number(restaurante_id), 'pos:stock_updated', {
          ingrediente_id: ing.ingrediente_id,
          nombre: ing.nombre,
          stock_actual: ing.stock_nuevo,
          timestamp: new Date().toISOString(),
        });
        // Alerta: emitir SOLO si cruzó el umbral (antes >= min, ahora < min).
        if (ing.stock_nuevo < ing.stock_minimo) {
          emitToRestaurant(Number(restaurante_id), 'pos:inventory_low', {
            ingrediente_id: ing.ingrediente_id,
            nombre: ing.nombre,
            stock_actual: ing.stock_nuevo,
            stock_minimo: ing.stock_minimo,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return pedidoId;
  } catch (err) {
    try { await connection.rollback(); } catch (_) { /* noop */ }
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Notifica al restaurante (interna + email) por un pedido nuevo.
 * Idempotente: si falla, logueamos y seguimos (el pedido ya está creado).
 *
 * Pedidos POS (canal='pos') NO disparan esta notificación: el staff del
 * local ya está viendo el NewOrderToast en su pantalla del POS, y
 * además tiene el KDS refrescándose cada 10s. La notificación del
 * NotificationCenter está pensada para el dueño/admin cuando NO está
 * físicamente en el POS (ej: está revisando su dashboard desde otro lado).
 * Si la disparáramos para POS, sería duplicada con el toast.
 *
 * Si quieres que el dueño también la vea en su NotificationCenter cuando
 * está en el POS, el camino a usar es el `pos:order_created` por socket
 * (el frontend puede decidir si encolar ahí también).
 */
export async function notificarNuevoPedido(pedidoId) {
  try {
    const pedido = await OrderModel.getOrderById(pedidoId);
    if (!pedido) return;
    // Cortar acá si es un pedido POS. Ver JSDoc arriba.
    if (pedido.canal === 'pos') return;

    const restauranteData = await RestaurantModel.getRestaurantById(pedido.restaurante_id);
    if (!restauranteData?.usuario_id) return;

    await NotificationModel.createNotification({
      usuario_id: restauranteData.usuario_id,
      tipo: 'pedido',
      titulo: 'Nuevo Pedido Recibido',
      mensaje: `Has recibido un nuevo pedido #${pedidoId}`,
      data: { pedido_id: pedidoId },
    });

    const restauranteUsuario = await RestaurantModel.getRestaurantUser(pedido.restaurante_id);
    if (restauranteUsuario?.email || restauranteUsuario?.telefono) {
      // Necesitamos el email del cliente que pidió.
      const cliente = await queryDirect(
        'SELECT email FROM usuarios WHERE id = ? LIMIT 1',
        [pedido.usuario_id]
      );
      notificationService.notifyNewOrder({
        pedido,
        restauranteEmail: restauranteUsuario.email,
        restauranteTelefono: restauranteUsuario.telefono,
        clienteEmail: cliente[0]?.email || null,
      }).catch((err) => console.error('Error enviando notificaciones de nuevo pedido:', err));
    }
  } catch (err) {
    console.error('Error notificando nuevo pedido:', err);
  }
}

// ========== Helpers privados ==========

async function validateAdicionesYRemovibles(connection, pricedItems) {
  return Promise.all(
    pricedItems.map(async (item) => {
      // Si el item no tiene adiciones, aún así tenemos que validar
      // obligatoriedad de Fase 10: un grupo obligatorio con count=0
      // es justamente el error que queremos detectar. Por eso la query
      // de grupos corre SIEMPRE (no solo cuando hay adiciones).
      const adiciones = item.adiciones || [];

      // 1) Traer los grupos del producto (config de obligatoriedad/min/max).
      //    Es la misma query para todos los items del producto, pero como
      //    pricedItems es chico (típico 1-5 items) no vale la pena cachear.
      const [grupoRows] = await connection.query(
        `SELECT id, nombre, obligatorio, min_selecciones, max_selecciones
           FROM producto_grupos_adiciones
          WHERE producto_id = ? AND activo = 1`,
        [item.producto_id]
      );
      // Map<grupo_id, { count, cfg }> para acumular cuántas adiciones
      // eligió el cliente por grupo. Solo los grupos que efectivamente
      // aparecen en `adiciones` van al map; los demás se quedan con count=0
      // y se validan abajo.
      const gruposById = new Map(
        grupoRows.map((g) => [Number(g.id), {
          id: Number(g.id),
          nombre: g.nombre,
          obligatorio: !!g.obligatorio,
          min: Number(g.min_selecciones) || 0,
          max: Number(g.max_selecciones) || 99,
          count: 0,
        }])
      );

      if (adiciones.length === 0) {
        // Sin adiciones: validamos obligatoriedad de los grupos del producto.
        for (const g of gruposById.values()) {
          if (g.obligatorio && g.count < g.min) {
            throw createValidationError(
              `Grupo "${g.nombre}": debe elegir al menos ${g.min} opción(es) (eligió 0)`
            );
          }
        }
        return { ...item, adiciones_snapshot: [], removibles_snapshot: [], suma_adiciones: 0 };
      }

      const adicionIds = adiciones.map((a) => a.adicion_id);
      const adPlaceholders = adicionIds.map(() => '?').join(',');
      const [rows] = await connection.query(
        `SELECT pa.id, pa.producto_id, pa.nombre, pa.precio_extra, pa.grupo_id,
                pg.nombre AS grupo_nombre
           FROM producto_adiciones pa
           LEFT JOIN producto_grupos_adiciones pg ON pa.grupo_id = pg.id
          WHERE pa.id IN (${adPlaceholders}) AND pa.activo = 1`,
        adicionIds
      );
      const adicionesById = new Map(rows.map((r) => [Number(r.id), r]));
      const snapshot = [];
      for (const a of adiciones) {
        const row = adicionesById.get(a.adicion_id);
        if (!row) {
          throw createValidationError(`Adición ${a.adicion_id} no existe o no está activa`);
        }
        if (Number(row.producto_id) !== Number(item.producto_id)) {
          throw createValidationError(`La adición ${a.adicion_id} no pertenece al producto ${item.producto_id}`);
        }
        const precio = row.precio_extra == null ? 0 : Number(row.precio_extra);
        // Acumular en el grupo correspondiente (si la adición está en un
        // grupo). Adiciones sueltas (grupo_id null) no entran al map.
        if (row.grupo_id != null) {
          const g = gruposById.get(Number(row.grupo_id));
          if (g) g.count += Number(a.cantidad) || 0;
        }
        snapshot.push({
          adicion_id: a.adicion_id,
          cantidad: a.cantidad,
          nombre: row.nombre,
          grupo_nombre: row.grupo_nombre || null,
          precio_unitario_adicion: precio,
          subtotal: Number((precio * a.cantidad).toFixed(2)),
        });
      }
      const sumaAdiciones = snapshot.reduce((s, a) => s + a.subtotal, 0);

      // 2) Validar min/max por grupo (Fase 10). Recorremos los grupos del
      //    producto, no solo los que el cliente eligió, así detectamos
      //    obligatorios vacíos.
      for (const g of gruposById.values()) {
        if (g.obligatorio && g.count < g.min) {
          throw createValidationError(
            `Grupo "${g.nombre}": debe elegir al menos ${g.min} opción(es) (eligió ${g.count})`
          );
        }
        if (g.count > g.max) {
          throw createValidationError(
            `Grupo "${g.nombre}": puede elegir como máximo ${g.max} opción(es) (eligió ${g.count})`
          );
        }
      }

      let removibles_snapshot = [];
      if (item.removidos && item.removidos.length > 0) {
        const remIds = item.removidos.map((r) => r.id);
        const remPlaceholders = remIds.map(() => '?').join(',');
        const [remRows] = await connection.query(
          `SELECT id, producto_id, nombre
             FROM producto_ingredientes_removibles
            WHERE id IN (${remPlaceholders}) AND activo = 1`,
          remIds
        );
        const remById = new Map(remRows.map((r) => [Number(r.id), r]));
        for (const r of item.removidos) {
          const row = remById.get(r.id);
          if (!row) throw createValidationError(`Removible ${r.id} no existe o no está activo`);
          if (Number(row.producto_id) !== Number(item.producto_id)) {
            throw createValidationError(`El removible ${r.id} no pertenece al producto ${item.producto_id}`);
          }
          removibles_snapshot.push({ id: r.id, nombre: row.nombre });
        }
      }
      return {
        ...item,
        adiciones_snapshot: snapshot,
        removibles_snapshot,
        suma_adiciones: Number(sumaAdiciones.toFixed(2)),
      };
    })
  );
}

function createValidationError(message) {
  const err = new Error(message);
  err.name = 'ValidationError';
  err.statusCode = 400;
  return err;
}
