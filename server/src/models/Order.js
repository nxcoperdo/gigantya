import pool, { query, queryOne } from '../config/database.js';
import * as RestauranteEnvioSector from './RestauranteEnvioSector.js';
import * as Barrio from './Barrio.js';
import * as ProductModifier from './ProductModifier.js';
import { resolverSectorPorCoordenadas } from '../utils/geoUtils.js';

/**
 * Estados posibles de un pedido
 */
export const ORDER_STATES = {
  PENDIENTE: 'Pendiente',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  COMPROBANTE_ENVIADO: 'Comprobante Enviado',
  PAGO_CONFIRMADO: 'Pago Confirmado',
  PAGO_RECHAZADO: 'Pago Rechazado'
};

/**
 * Métodos de pago disponibles
 */
export const PAYMENT_METHODS = {
  CONTRA_ENTREGA: 'contra_entrega',
  NEQUI: 'nequi',
  DAVIPLATA: 'daviplata',
  BRE_B: 'bre_b'
};

// Tasa de impuestos por defecto (se puede sobrescribir por restaurante)
const DEFAULT_ORDER_TAX_RATE = Number(process.env.ORDER_TAX_RATE ?? 0.08);

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Normaliza los items del pedido agrupando por FIRMA, no por
 * producto_id. La firma es un JSON estable que incluye:
 *   - producto_id
 *   - adiciones ordenadas por adicion_id (con su cantidad)
 *   - removidos ordenados por id
 *   - nota libre
 *
 * Si dos items del request comparten firma, se suman sus
 * cantidades (mismo producto con misma customización).
 * Si difieren, quedan como dos items_pedido distintos (mismo
 * producto con customización distinta, comportamiento Rappi).
 *
 * Cada item de salida lleva `adiciones`, `removidos` y `notas`
 * en su shape canónica para que el resto del pipeline los
 * consuma directo.
 */
export function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('items debe ser un array no vacio');
  }

  const grouped = new Map();

  for (const item of items) {
    const producto_id = Number(item?.producto_id);
    const cantidad = Number(item?.cantidad);

    if (!Number.isInteger(producto_id) || producto_id <= 0) {
      throw createValidationError('Cada item debe tener un producto_id valido');
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw createValidationError('Cada item debe tener una cantidad entera positiva');
    }

    // Normalizar adiciones: [{ adicion_id, cantidad: >= 1 }]
    const adicionesRaw = Array.isArray(item.adiciones) ? item.adiciones : [];
    const adiciones = adicionesRaw
      .map((a) => ({
        adicion_id: Number(a.adicion_id),
        cantidad: Math.max(1, Math.floor(Number(a.cantidad) || 0)),
      }))
      .filter((a) => Number.isInteger(a.adicion_id) && a.adicion_id > 0 && a.cantidad > 0)
      .sort((a, b) => a.adicion_id - b.adicion_id);

    // Normalizar removidos: [{ id, nombre }].
    // Acepta el shape "liviano" (id solo) que viene del cliente y el
    // shape "completo" (con nombre) que ya usamos en otros lugares.
    // El nombre lo resolvemos más abajo (en createOrderWithItems)
    // contra la tabla producto_ingredientes_removibles, porque acá
    // todavía no sabemos el producto_id del item.
    const removidosRaw = Array.isArray(item.removidos_ids)
      ? item.removidos_ids.map((r) => ({ id: Number(r) }))
      : (Array.isArray(item.removidos)
          ? item.removidos.map((r) => (typeof r === 'object' ? { id: Number(r.id) } : { id: Number(r) }))
          : []);
    const removidos = removidosRaw
      .map((r) => ({ id: r.id }))
      .filter((r) => Number.isInteger(r.id) && r.id > 0)
      .sort((a, b) => a.id - b.id);

    // Nota libre: string, máximo 200 caracteres (defensa)
    const notaRaw = typeof item.notas_item === 'string'
      ? item.notas_item
      : (typeof item.nota === 'string' ? item.nota : '');
    const nota = notaRaw.slice(0, 200);

    // Firma estable (JSON string). Los removidos van como array
    // de IDs (forma canónica del CartContext del cliente), no
    // como {id, nombre} — para que la firma matchee entre ambos
    // lados. El nombre se snapshottea en otra parte del pipeline.
    const firma = JSON.stringify({
      id: producto_id,
      ad: adiciones.map((a) => ({ id: a.adicion_id, c: a.cantidad })),
      re: removidos.map((r) => r.id),
      nota,
    });

    const existing = grouped.get(firma);
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      grouped.set(firma, {
        producto_id,
        cantidad,
        adiciones,
        removidos,
        nota,
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Calcular total del pedido con impuestos y envío configurables
 * @param {Array} items - Items del pedido
 * @param {Object} coupon - Cupón aplicado (opcional)
 * @param {Object} taxConfig - Configuración de impuestos { activo, porcentaje }
 * @param {Object} shippingConfig - Configuración de envíos { activo, costo_fijo, envio_gratis_activo, envio_gratis_desde }
 * @param {Object} options - Opciones adicionales { costo_envio_override?: number }
 *   Si se pasa `costo_envio_override`, se usa ese valor directamente como costo de envío
 *   (ignora envio_gratis). Esto permite que el frontend pase el costo ya calculado
 *   cuando conoce el barrio/sector del usuario.
 */
export function calculateOrderTotal(items, coupon = null, taxConfig = { activo: true, porcentaje: 8 }, shippingConfig = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 }, options = {}) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.precio_unitario) * Number(item.cantidad),
    0
  );

  // Calcular descuento del cupón
  let discountAmount = 0;
  if (coupon) {
    if (coupon.tipo_descuento === 'porcentaje') {
      discountAmount = subtotal * (Number(coupon.descuento) / 100);
    } else {
      discountAmount = Number(coupon.descuento);
    }
    // El descuento no puede superar el subtotal
    discountAmount = Math.min(discountAmount, subtotal);
  }

  // Calcular subtotal después del descuento
  const subtotalConDescuento = subtotal - discountAmount;

  // Calcular impuestos (solo si está activo)
  let taxAmount = 0;
  if (taxConfig.activo && taxConfig.porcentaje > 0) {
    taxAmount = subtotalConDescuento * (taxConfig.porcentaje / 100);
  }

  // Calcular envío (solo si está activo)
  let shippingAmount = 0;
  let envioGratisAplicado = false;
  if (shippingConfig.activo) {
    // Verificar si el envío gratis está ACTIVAMENTE habilitado y supera el umbral
    // (estrictamente mayor y umbral > 0 para tener sentido)
    const envioGratisCorresponde =
      shippingConfig.envio_gratis_activo === true &&
      Number(shippingConfig.envio_gratis_desde) > 0 &&
      subtotalConDescuento > Number(shippingConfig.envio_gratis_desde);

    if (envioGratisCorresponde) {
      shippingAmount = 0;
      envioGratisAplicado = true;
    } else if (
      options &&
      options.costo_envio_override !== undefined &&
      options.costo_envio_override !== null &&
      !Number.isNaN(Number(options.costo_envio_override))
    ) {
      // Si el frontend ya calculó el costo específico por sector/barrio, lo respetamos
      shippingAmount = Math.max(0, Number(options.costo_envio_override));
    } else {
      shippingAmount = Number(shippingConfig.costo_fijo) || 0;
    }
  }

  // Total final
  const total = subtotalConDescuento + taxAmount + shippingAmount;

  return {
    total: Number(total.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    descuento: Number(discountAmount.toFixed(2)),
    impuestos: Number(taxAmount.toFixed(2)),
    envio: Number(shippingAmount.toFixed(2)),
    envio_gratis_aplicado: envioGratisAplicado
  };
}

/**
 * Crear nuevo pedido
 */
export async function createOrder(orderData) {
  const {
    usuario_id,
    restaurante_id,
    total,
    notas = '',
    direccion_entrega,
    telefono_contacto
  } = orderData;

  const sql = `
    INSERT INTO pedidos (
      usuario_id,
      restaurante_id,
      total,
      estado,
      notas,
      direccion_entrega,
      telefono_contacto,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      restaurante_id,
      total,
      ORDER_STATES.PENDIENTE,
      notas,
      direccion_entrega,
      telefono_contacto
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando pedido: ${error.message}`);
  }
}

/**
 * Crear pedido completo de forma atomica recalculando precios desde la BD.
 *
 * Acepta opcionalmente los campos de Google Maps:
 *   - `latitud`, `longitud`           → pin exacto del cliente
 *   - `direccion_formateada`           → texto oficial devuelto por Places
 *   - `place_id`                       → ID único del lugar
 *
 * Si vienen `latitud/longitud` y NO se resolvió un sector por `barrio_id`,
 * se intenta resolver el sector más cercano vía `resolverSectorPorCoordenadas`
 * (radio configurable, default 5 km). Si encuentra un sector, recalcula
 * `costo_envio` desde `RestauranteEnvioSector.getCosto`.
 */
export async function createOrderWithItems(orderData) {
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
    // Cuando el local es "solo retiro en mostrador" (ofrece_domicilio=0),
    // forzamos dirección/barrio/sector null y costo_envio 0 aunque el
    // cliente haya enviado valores. La modalidad la decide el local, no
    // el cliente. El default false mantiene compatibilidad con callers
    // que todavía no pasan este flag.
    esRetiroLocal = false,
    // Misma idea que esRetiroLocal, pero para la modalidad "consumo en
    // el local" (comer en la mesa). También es sin envío, sin dirección,
    // sin barrio. La modalidad la decide el cliente en el checkout, y
    // el backend la respeta solo si el local la ofrece.
    esConsumoEnLocal = false,
    total: totalFromRequest = null // Total enviado desde el frontend (opcional)
  } = orderData;

  const normalizedItems = normalizeOrderItems(items);
  const productIds = normalizedItems.map(item => item.producto_id);
  const placeholders = productIds.map(() => '?').join(', ');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [products] = await connection.query(
      `
        SELECT id, restaurante_id, precio, disponible, estado
        FROM productos
        WHERE id IN (${placeholders})
        FOR UPDATE
      `,
      productIds
    );

    if (products.length !== normalizedItems.length) {
      throw createValidationError('Uno o mas productos no existen');
    }

    const productsById = new Map(products.map(product => [Number(product.id), product]));
    const pricedItems = normalizedItems.map(item => {
      const product = productsById.get(item.producto_id);

      if (!product) {
        throw createValidationError('Uno o mas productos no existen');
      }

      if (Number(product.restaurante_id) !== Number(restaurante_id)) {
        throw createValidationError('Todos los productos deben pertenecer al restaurante seleccionado');
      }

      if (product.estado !== 'activo' || Number(product.disponible) !== 1) {
        throw createValidationError('Uno o mas productos no estan disponibles');
      }

      const precioBase = Number(product.precio);
      // El subtotal y la suma de adiciones se aplican DESPUÉS de
      // validar las adiciones (abajo). Acá solo dejamos el precio
      // base para mantener el shape compatible con calculateOrderTotal.
      return {
        ...item,
        precio_unitario: precioBase,
      };
    });

    // Validar adiciones: que existan, que estén activas y que
    // pertenezcan al producto del item. Devuelve la lista con
    // precio_extra snapshot (en el momento del pedido, no se
    // recalcula si el local edita la adición después).
    const validatedItems = await Promise.all(
      pricedItems.map(async (item) => {
        if (!item.adiciones || item.adiciones.length === 0) {
          return { ...item, adiciones_snapshot: [], suma_adiciones: 0 };
        }
        const adicionIds = item.adiciones.map((a) => a.adicion_id);
        const placeholders = adicionIds.map(() => '?').join(',');
        // LEFT JOIN a producto_grupos_adiciones para hacer snapshot
        // del nombre del grupo al momento del pedido. Si la adición
        // no tiene grupo (grupo_id IS NULL), `grupo_nombre` queda NULL
        // — el render del ticket lo trata como "adición suelta".
        const [rows] = await connection.query(
          `SELECT pa.id, pa.producto_id, pa.nombre, pa.precio_extra, pa.grupo_id,
                  pg.nombre AS grupo_nombre
           FROM producto_adiciones pa
           LEFT JOIN producto_grupos_adiciones pg ON pa.grupo_id = pg.id
           WHERE pa.id IN (${placeholders}) AND pa.activo = 1`,
          adicionIds
        );
        const adicionesById = new Map(rows.map((r) => [Number(r.id), r]));
        const snapshot = [];
        for (const a of item.adiciones) {
          const row = adicionesById.get(a.adicion_id);
          if (!row) {
            throw createValidationError(`Adición ${a.adicion_id} no existe o no está activa`);
          }
          if (Number(row.producto_id) !== Number(item.producto_id)) {
            throw createValidationError(
              `La adición ${a.adicion_id} no pertenece al producto ${item.producto_id}`
            );
          }
          const precio = row.precio_extra == null ? 0 : Number(row.precio_extra);
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

        // Validar removibles: que existan, estén activos y pertenezcan
        // al producto. Hacemos snapshot del `nombre` para guardarlo en
        // `removidos_json` como [{id, nombre}] — así el ticket puede
        // renderizar el nombre del ingrediente quitado aunque el local
        // edite o elimine el removible después.
        let removibles_snapshot = [];
        if (item.removidos && item.removidos.length > 0) {
          const removibleIds = item.removidos.map((r) => r.id);
          const remPlaceholders = removibleIds.map(() => '?').join(',');
          const [remRows] = await connection.query(
            `SELECT id, producto_id, nombre
             FROM producto_ingredientes_removibles
             WHERE id IN (${remPlaceholders}) AND activo = 1`,
            removibleIds
          );
          const removiblesById = new Map(remRows.map((r) => [Number(r.id), r]));
          for (const r of item.removidos) {
            const row = removiblesById.get(r.id);
            if (!row) {
              throw createValidationError(
                `Ingrediente removible ${r.id} no existe o no está activo`
              );
            }
            if (Number(row.producto_id) !== Number(item.producto_id)) {
              throw createValidationError(
                `El removible ${r.id} no pertenece al producto ${item.producto_id}`
              );
            }
            removibles_snapshot.push({
              id: r.id,
              nombre: row.nombre,
            });
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

    // Obtener datos del cupón si se proporcionó
    let coupon = null;
    if (coupon_id) {
      // FIX: validar también que el cupón pertenece al mismo restaurante.
      // Sin este filtro, un cupón creado por el restaurante A podría
      // aplicarse a pedidos del restaurante B (vulnerabilidad menor).
      //
      // Excepción: cupones GLOBALES (es_global = 1) no tienen
      // restaurante_id (es NULL) y pueden aplicarse a pedidos de
      // cualquier local. En ese caso, NO aplicamos el filtro
      // restaurante_id y dejamos que la validación pase.
      const [couponResult] = await connection.query(
        `SELECT * FROM cupones
         WHERE id = ?
           AND (es_global = 1 OR restaurante_id = ?)
         LIMIT 1`,
        [coupon_id, restaurante_id]
      );
      coupon = couponResult[0];
      if (!coupon) {
        throw new Error('Cupón no válido para este pedido');
      }
    }

    // Obtener configuración de impuestos y envíos del restaurante
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

    // Resolver sector_id a partir de barrio_id (si viene barrio pero no sector)
    let resolvedSectorId = sector_id ? Number(sector_id) : null;
    if (barrio_id && !resolvedSectorId && !esRetiroLocal) {
      const barrio = await Barrio.getBarrioById(Number(barrio_id));
      if (barrio) resolvedSectorId = Number(barrio.sector_id);
    }

    // Si NO se resolvió sector por barrio pero el cliente envió lat/lng
    // desde Google Maps, intentar geocoding: el sector más cercano dentro
    // de un radio (default 5 km, ver utils/geoUtils.js).
    let geocodedSector = null;
    if (!resolvedSectorId && latitud !== null && longitud !== null && latitud !== undefined && longitud !== undefined && !esRetiroLocal) {
      try {
        geocodedSector = await resolverSectorPorCoordenadas(latitud, longitud);
        if (geocodedSector) {
          resolvedSectorId = geocodedSector.sector_id;
        }
      } catch (geoErr) {
        // No bloquear la creación del pedido si geocoding falla
        console.warn('No se pudo resolver sector por coordenadas:', geoErr.message);
      }
    }

    // Si tenemos sector, intentar resolver el costo específico para ese sector.
    // En pedidos de retiro en mostrador NO se cobra envío: la tabla
    // `restaurante_envios_sector` y `configuracion_envios` no aplican
    // aunque estén configurados (el local no hace domicilios).
    let resolvedCostoEnvio = Number(costo_envio) || 0;
    if (esRetiroLocal) {
      resolvedCostoEnvio = 0;
      resolvedSectorId = null;
    } else if (resolvedSectorId) {
      const sectorCosto = await RestauranteEnvioSector.getCosto(Number(restaurante_id), resolvedSectorId);
      if (sectorCosto !== null && sectorCosto !== undefined) {
        // Solo usar el costo del sector si el cliente no pasó uno explícito,
        // o si el que pasó coincide con este (para soportar costo_envio=0 cuando es gratis).
        if (costo_envio === null || costo_envio === undefined) {
          resolvedCostoEnvio = sectorCosto;
        }
      }
    }

    // Calcular total: SIEMPRE priorizar el total enviado desde el frontend
    // (que ya calculó correctamente con envío e impuestos según la config del restaurante)
    // Solo recalculamos desde la BD como fallback si el frontend no envía total.
    let total;
    if (totalFromRequest !== null && totalFromRequest !== undefined && Number(totalFromRequest) > 0) {
      total = Number(totalFromRequest);
    } else {
      // Para que calculateOrderTotal sume las adiciones al subtotal,
      // le pasamos un shadow de items con `precio_unitario` ya extendido
      // a base + suma_adiciones. El shape que consume calculateOrderTotal
      // es { precio_unitario, cantidad }.
      const pricedForTotal = validatedItems.map((item) => ({
        precio_unitario: item.precio_unitario + item.suma_adiciones,
        cantidad: item.cantidad,
      }));
      const calc = calculateOrderTotal(pricedForTotal, coupon, taxConfig, shippingConfig, {
        costo_envio_override: resolvedCostoEnvio
      });
      total = calc.total;
      // Si la recalculación reveló que el envío es gratis, reflejarlo en costo_envio
      if (calc.envio_gratis_aplicado) {
        resolvedCostoEnvio = 0;
      }
    }

    // Determinar estado inicial según método de pago
    const estadoInicial = metodo_pago === 'contra_entrega'
      ? ORDER_STATES.PENDIENTE
      : ORDER_STATES.COMPROBANTE_ENVIADO;

    // En pedidos sin envío (retiro en mostrador o consumo en el local),
    // dirección y zonas quedan null (override de lo que haya llegado en
    // el body). El costo de envío también queda en 0 aunque el frontend
    // haya enviado algo distinto. Ambas modalidades comparten este path
    // porque ninguna requiere envío ni dirección.
    const esModalidadSinEnvio = esRetiroLocal || esConsumoEnLocal;
    const insertDireccionEntrega = esModalidadSinEnvio ? null : (direccion_entrega ?? null);
    const insertBarrioId = esModalidadSinEnvio ? null : (barrio_id ? Number(barrio_id) : null);
    const insertSectorId = esModalidadSinEnvio ? null : resolvedSectorId;
    const insertCostoEnvio = esModalidadSinEnvio ? 0 : resolvedCostoEnvio;
    const insertLatitud = esModalidadSinEnvio ? null : (latitud !== null && latitud !== undefined ? Number(latitud) : null);
    const insertLongitud = esModalidadSinEnvio ? null : (longitud !== null && longitud !== undefined ? Number(longitud) : null);
    const insertDireccionFormateada = esModalidadSinEnvio ? null : (direccion_formateada || null);
    const insertPlaceId = esModalidadSinEnvio ? null : (place_id || null);

    const [orderResult] = await connection.query(
      `
        INSERT INTO pedidos (
          usuario_id,
          restaurante_id,
          total,
          costo_envio,
          estado,
          metodo_pago,
          estado_validacion_pago,
          cupon_id,
          notas,
          direccion_entrega,
          telefono_contacto,
          barrio_id,
          sector_id,
          latitud,
          longitud,
          direccion_formateada,
          place_id,
          es_retiro_local,
          es_consumo_en_local,
          creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
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
        insertDireccionFormateada,
        insertPlaceId,
        // Persistimos las modalidades al momento de crear el pedido.
        // Estas columnas sobreviven a cambios posteriores de los flags
        // del local (ofrece_domicilio, ofrece_consumo_en_local), así el
        // dashboard siempre sabe cómo fue tomado cada pedido.
        esRetiroLocal ? 1 : 0,
        esConsumoEnLocal ? 1 : 0,
      ]
    );

    const pedidoId = orderResult.insertId;

    for (const item of validatedItems) {
      // precio_unitario = base del producto (se conserva por
      // trazabilidad histórica y compatibilidad con reports).
      // subtotal = (base + suma_adiciones) * cantidad. El frontend
      // ya calculó el total final, así que el `total` del pedido
      // sigue siendo la fuente de verdad para cobrar.
      const subtotal = Number(
        ((item.precio_unitario + item.suma_adiciones) * item.cantidad).toFixed(2)
      );
      const removidosJson = item.removibles_snapshot && item.removibles_snapshot.length > 0
        ? JSON.stringify(item.removibles_snapshot)
        : null;
      const [insertResult] = await connection.query(
        `
          INSERT INTO items_pedido
            (pedido_id, producto_id, cantidad, precio_unitario, subtotal, especificaciones, removidos_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
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
      // Insert de cada adición del item con su snapshot
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

    await connection.commit();
    return pedidoId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Agregar item al pedido
 */
export async function addOrderItem(pedido_id, producto_id, cantidad, precio_unitario) {
  const sql = `
    INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?)
  `;

  const subtotal = cantidad * precio_unitario;

  try {
    const result = await query(sql, [
      pedido_id,
      producto_id,
      cantidad,
      precio_unitario,
      subtotal
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error agregando item al pedido: ${error.message}`);
  }
}

/**
 * Enriquece los items de un pedido con `adiciones[]` y `removidos[]`
 * (parseados desde `removidos_json`). Es la forma única en que el
 * frontend (cliente, local, admin) ve la customización del producto
 * — sin esto, el local no sabría qué pidió el cliente.
 *
 * Recibe los items ya cargados (shape de getOrderById/getOrderWithPaymentInfo)
 * y los MUTA in-place con los nuevos campos. Si no hay adiciones ni
 * removidos, queda con arrays vacíos.
 */
async function enrichItemsWithModifiers(pedidoId, items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const adicionesPorItem = await ProductModifier.getItemsAdicionesByPedido(pedidoId);
  for (const item of items) {
    item.adiciones = adicionesPorItem.get(item.id) || [];
    if (item.removidos_json) {
      try {
        item.removidos = JSON.parse(item.removidos_json);
        if (!Array.isArray(item.removidos)) item.removidos = [];
      } catch {
        item.removidos = [];
      }
    } else {
      item.removidos = [];
    }
  }
  return items;
}

/**
 * Obtener pedido con sus items
 */
export async function getOrderById(id) {
  const sql = `
    SELECT
      p.*,
      r.nombre as restaurante_nombre,
      r.telefono as restaurante_telefono,
      u.nombre as cliente_nombre,
      u.email as cliente_email,
      u.telefono as cliente_telefono,
      c.codigo as cupon_codigo,
      c.descuento as cupon_descuento,
      c.tipo_descuento as cupon_tipo_descuento,
      b.nombre as barrio_nombre,
      s.nombre as sector_nombre
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN cupones c ON p.cupon_id = c.id
    LEFT JOIN barrios b ON p.barrio_id = b.id
    LEFT JOIN sectores s ON p.sector_id = s.id
    WHERE p.id = ?
  `;

  const pedido = await queryOne(sql, [id]);

  if (!pedido) return null;

  // Calcular subtotal y descuento para la vista
  const items = await query(`
    SELECT
      ip.*,
      pr.nombre as producto_nombre,
      pr.descripcion as producto_descripcion,
      pr.imagen_url as producto_imagen
    FROM items_pedido ip
    LEFT JOIN productos pr ON ip.producto_id = pr.id
    WHERE ip.pedido_id = ?
  `, [id]);

  // Enriquece cada item con adiciones[] y removidos[]
  await enrichItemsWithModifiers(id, items);

  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const costoEnvio = Number(pedido.costo_envio) || 0;
  const totalConImpuestos = Number(pedido.total);

  // El total guardado = subtotal - descuento + impuestos + envío
  // Entonces: descuento = subtotal + impuestos + envío - total
  // Necesitamos calcular impuestos desde la config del restaurante
  const [restaurantData] = await query(
    'SELECT configuracion_impuestos FROM restaurantes WHERE id = ?',
    [pedido.restaurante_id]
  );

  const taxConfig = restaurantData?.configuracion_impuestos
    ? (typeof restaurantData.configuracion_impuestos === 'string'
        ? JSON.parse(restaurantData.configuracion_impuestos)
        : restaurantData.configuracion_impuestos)
    : { activo: true, porcentaje: 8 };

  // Si hay cupón, considerar el descuento del cupón como fuente de verdad.
  // Si NO hay cupón, calcular el descuento como delta contra el total guardado
  // (cubre descuentos manuales o redondeos aplicados al crear el pedido).
  let descuento = 0;
  let descuentoDesdeCupon = false;
  if (pedido.cupon_id) {
    const [couponData] = await query(
      'SELECT descuento, tipo_descuento FROM cupones WHERE id = ?',
      [pedido.cupon_id]
    );
    if (couponData) {
      if (couponData.tipo_descuento === 'porcentaje') {
        descuento = subtotal * (Number(couponData.descuento) / 100);
      } else {
        descuento = Number(couponData.descuento);
      }
      descuento = Math.min(descuento, subtotal);
      descuentoDesdeCupon = true;
    }
  }

  const subtotalConDescuento = subtotal - descuento;
  const impuestoPorcentaje = (taxConfig.activo && taxConfig.porcentaje > 0) ? Number(taxConfig.porcentaje) : 0;
  const impuestos = subtotalConDescuento * (impuestoPorcentaje / 100);

  // Solo recalcular el descuento por delta si NO viene del cupón, para no
  // pisar el valor del cupón (que es la fuente de verdad cuando está aplicado).
  if (!descuentoDesdeCupon) {
    const totalEsperadoSinDescuento = subtotal + impuestos + costoEnvio;
    descuento = Math.max(0, totalEsperadoSinDescuento - totalConImpuestos);
  }

  // Agregar descuento al objeto pedido
  pedido.subtotal = subtotal;
  pedido.descuento = descuento;

  pedido.items = items;
  return pedido;
}

/**
 * Obtener pedidos del usuario
 */
export async function getOrdersByUser(usuario_id, limit) {
    // Aseguramos valores numéricos/definidos
    const safeId = usuario_id;
    const safeLimit = parseInt(limit, 10) || 20;

    if (safeId === undefined || safeId === null) {
        throw new Error("El ID del usuario es necesario para consultar pedidos.");
    }

    const sql = `
    SELECT
      p.id, p.usuario_id, p.restaurante_id, p.total, p.estado, p.notas,
      p.direccion_entrega, p.telefono_contacto, p.creado_en, p.actualizado_en,
      p.costo_envio, p.barrio_id, p.sector_id,
      r.nombre as restaurante_nombre,
      b.nombre as barrio_nombre,
      s.nombre as sector_nombre,
      (SELECT COUNT(*) FROM items_pedido WHERE pedido_id = p.id) as items_count
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN barrios b ON p.barrio_id = b.id
    LEFT JOIN sectores s ON p.sector_id = s.id
    WHERE p.usuario_id = ?
    ORDER BY p.creado_en DESC
    LIMIT ?
  `;

    // Forzamos que los parámetros sean estrictamente un array de dos elementos
    return await query(sql, [safeId, safeLimit]);
}
/**
 * Obtener pedidos del restaurante
 */
export async function getOrdersByRestaurant(restaurante_id, filtro = null) {
  let sql = `
    SELECT
      p.*,
      u.nombre as cliente_nombre,
      u.telefono as cliente_telefono,
      r.ofrece_domicilio,
      b.nombre as barrio_nombre,
      s.nombre as sector_nombre,
      COUNT(ip.id) as items_count
    FROM pedidos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN barrios b ON p.barrio_id = b.id
    LEFT JOIN sectores s ON p.sector_id = s.id
    LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
    WHERE p.restaurante_id = ?
  `;

  const params = [restaurante_id];

  if (filtro && filtro !== 'todos') {
    sql += ' AND p.estado = ?';
    params.push(filtro);
  }

  // r.ofrece_domicilio es constante por restaurante_id (mismo r para todos
  // los pedidos), así que agregarlo al GROUP BY es seguro y deja la query
  // válida en MySQL strict mode.
  sql += ' GROUP BY p.id, r.ofrece_domicilio ORDER BY p.creado_en DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo pedidos del restaurante: ${error.message}`);
  }
}

/**
 * Actualizar estado del pedido
 */
export async function updateOrderStatus(id, nuevoEstado) {
  // Validar que sea un estado válido
  if (!Object.values(ORDER_STATES).includes(nuevoEstado)) {
    throw new Error(`Estado inválido: ${nuevoEstado}`);
  }

  const sql = 'UPDATE pedidos SET estado = ?, actualizado_en = NOW() WHERE id = ?';

  try {
    await query(sql, [nuevoEstado, id]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando estado del pedido: ${error.message}`);
  }
}

/**
 * Actualizar estado de validación de pago
 */
export async function updatePaymentValidation(id, estado) {
  const validStates = ['pendiente', 'aprobado', 'rechazado'];
  if (!validStates.includes(estado)) {
    throw new Error(`Estado de validación inválido: ${estado}`);
  }

  const sql = 'UPDATE pedidos SET estado_validacion_pago = ?, actualizado_en = NOW() WHERE id = ?';

  try {
    await query(sql, [estado, id]);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando validación de pago: ${error.message}`);
  }
}

/**
 * Obtener pedido con información de pago
 */
export async function getOrderWithPaymentInfo(id) {
  const sql = `
    SELECT
      p.*,
      r.nombre as restaurante_nombre,
      r.telefono as restaurante_telefono,
      u.nombre as cliente_nombre,
      u.email as cliente_email,
      u.telefono as cliente_telefono,
      cp.url_imagen as comprobante_url,
      cp.estado_validacion as comprobante_estado,
      cp.metodo_pago as comprobante_metodo,
      c.codigo as cupon_codigo,
      c.descuento as cupon_descuento,
      c.tipo_descuento as cupon_tipo_descuento
    FROM pedidos p
    LEFT JOIN restaurantes r ON p.restaurante_id = r.id
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN comprobantes_pago cp ON p.id = cp.pedido_id
    LEFT JOIN cupones c ON p.cupon_id = c.id
    WHERE p.id = ?
  `;

  const pedido = await queryOne(sql, [id]);
  if (!pedido) return null;

  // Obtener items del pedido
  const items = await query(`
    SELECT
      ip.*,
      pr.nombre as producto_nombre,
      pr.descripcion as producto_descripcion,
      pr.imagen_url as producto_imagen
    FROM items_pedido ip
    LEFT JOIN productos pr ON ip.producto_id = pr.id
    WHERE ip.pedido_id = ?
  `, [id]);

  // Enriquece cada item con adiciones[] y removidos[]
  await enrichItemsWithModifiers(id, items);

  // Calcular subtotal y descuento
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const costoEnvio = Number(pedido.costo_envio) || 0;
  const totalConImpuestos = Number(pedido.total);

  // Calcular impuestos desde la config del restaurante
  const [restaurantData2] = await query(
    'SELECT configuracion_impuestos FROM restaurantes WHERE id = ?',
    [pedido.restaurante_id]
  );

  const taxConfig2 = restaurantData2?.configuracion_impuestos
    ? (typeof restaurantData2.configuracion_impuestos === 'string'
        ? JSON.parse(restaurantData2.configuracion_impuestos)
        : restaurantData2.configuracion_impuestos)
    : { activo: true, porcentaje: 8 };

  // Calcular descuento basado en el total y subtotal
  // Si hay cupón, considerar el descuento del cupón
  let descuento = 0;
  if (pedido.cupon_id && pedido.cupon_descuento !== null && pedido.cupon_descuento !== undefined) {
    if (pedido.cupon_tipo_descuento === 'porcentaje') {
      descuento = subtotal * (Number(pedido.cupon_descuento) / 100);
    } else {
      descuento = Number(pedido.cupon_descuento);
    }
    descuento = Math.min(descuento, subtotal);
  } else {
    // Calcular descuento efectivo: total guardado vs total esperado sin descuento
    const subtotalConDescuento = subtotal - descuento;
    const impuestoPorcentaje = (taxConfig2.activo && taxConfig2.porcentaje > 0) ? Number(taxConfig2.porcentaje) : 0;
    const impuestos = subtotalConDescuento * (impuestoPorcentaje / 100);
    const totalEsperado = subtotal + impuestos + costoEnvio;
    descuento = Math.max(0, totalEsperado - totalConImpuestos);
  }

  pedido.subtotal = subtotal;
  pedido.descuento = descuento;

  pedido.items = items;
  return pedido;
}

/**
 * Cancelar pedido
 */
export async function cancelOrder(id, motivo = null) {
  const sql = 'UPDATE pedidos SET estado = ?, motivo_cancelacion = ?, actualizado_en = NOW() WHERE id = ?';
  try {
    await query(sql, [ORDER_STATES.CANCELADO, motivo, id]);
    return true;
  } catch (error) {
    throw new Error(`Error cancelando pedido: ${error.message}`);
  }
}

/**
 * Obtener estadísticas de pedidos
 */
export async function getOrderStats(restaurante_id, days = 30) {
  const sql = `
    SELECT 
      DATE(creado_en) as fecha,
      COUNT(*) as total_pedidos,
      SUM(total) as ingresos,
      AVG(total) as promedio_pedido
    FROM pedidos
    WHERE restaurante_id = ? AND creado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY DATE(creado_en)
    ORDER BY fecha DESC
  `;

  try {
    return await query(sql, [restaurante_id, parseInt(days)]);
  } catch (error) {
    throw new Error(`Error obteniendo estadísticas: ${error.message}`);
  }
}

export default {
  ORDER_STATES,
  PAYMENT_METHODS,
  normalizeOrderItems,
  calculateOrderTotal,
  createOrder,
  createOrderWithItems,
  addOrderItem,
  getOrderById,
  getOrderWithPaymentInfo,
  getOrdersByUser,
  getOrdersByRestaurant,
  updateOrderStatus,
  updatePaymentValidation,
  cancelOrder,
  getOrderStats
};
