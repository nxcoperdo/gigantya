/**
 * Modelo de Reportes POS (Fase 7).
 *
 * Funciones puras de queries agregadas. No toca conexiones, no emite
 * sockets, no escribe audit logs — solo devuelve datos. Toda la
 * lógica de auth / formateo vive en `posReportsService.js` y en el
 * controller.
 *
 * Convenciones:
 *   - Todas las funciones filtran por `restaurante_id` (defensa de
 *     tenant — un dueño no puede leer reportes de OTRO restaurante).
 *   - Los filtros temporales (`desde`/`hasta`) son opcionales. Si
 *     vienen como string ISO o Date, se pasan directo al placeholder
 *     de mysql2; si no vienen, NO se filtran (puede ser pesado si la
 *     BD es grande — el controller debe validar al menos un límite).
 *   - Las queries usan `canal = 'pos'` para excluir los pedidos web
 *     (que es otro negocio). `metodo_pago` legacy de pedidos web se
 *     ignora; usamos `pagos.metodo` que es el del POS.
 *   - Los estados contables para los reportes son:
 *       'Entregado' (cobrado) y 'Listo' (aún no cobrado pero
 *       confirmado). 'Pendiente' y 'Preparando' se excluyen (no
 *       cuentan como venta todavía). 'Cancelado' se excluye.
 */
import { query, queryOne } from '../../config/database.js';

// Estados contables de un pedido (los que cuentan como venta para
// los reportes). 'Listo' cuenta porque la cocina ya confirmó la
// preparación, y la venta se considera válida aunque el cajero aún
// no haya pasado a cobrar.
const ESTADOS_CONTABLES = ['Entregado', 'Listo'];

/** Normaliza `desde`/`hasta` a string Date o null. Sirve para que
 *  mysql2 convierta correctamente y no haya off-by-one. */
function normalizeDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  // Acepta "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss" o cualquier ISO.
  return String(v).replace('T', ' ').slice(0, 19);
}

/** Top N productos más vendidos en una ventana temporal.
 *  Filtra por `canal = 'pos'` (excluye web) y estados contables.
 *  Devuelve: [{ producto_id, nombre, unidades_vendidas, revenue, pedidos_count }]. */
export async function getTopProductos(restauranteId, { desde = null, hasta = null, limite = 20 } = {}) {
  // Mismo orden de placeholders que en getRevenuePorPeriodo:
  //   restaurante_id, estado_1, estado_2, [desde], [hasta], limite
  const estados = ESTADOS_CONTABLES.map((s) => String(s));
  const rango = [];
  if (desde) rango.push(normalizeDate(desde));
  if (hasta) rango.push(normalizeDate(hasta));
  const params = [Number(restauranteId), ...estados, ...rango, Number(limite) || 20];

  const placeholders = estados.map(() => '?').join(',');
  const extra = (desde ? ' AND p2.creado_en >= ?' : '')
              + (hasta ? ' AND p2.creado_en <= ?' : '');
  const rows = await query(
    `SELECT p.id            AS producto_id,
            p.nombre        AS nombre,
            SUM(ip.cantidad)        AS unidades_vendidas,
            SUM(ip.subtotal)        AS revenue,
            COUNT(DISTINCT ip.pedido_id) AS pedidos_count
       FROM items_pedido ip
       JOIN pedidos  p2 ON p2.id = ip.pedido_id
       JOIN productos p  ON p.id  = ip.producto_id
      WHERE p2.restaurante_id = ?
        AND p2.canal = 'pos'
        AND p2.estado IN (${placeholders})${extra}
      GROUP BY p.id, p.nombre
      ORDER BY unidades_vendidas DESC, revenue DESC
      LIMIT ?`,
    params
  );
  // Normalización de tipos (mysql2 devuelve DECIMAL como string).
  return rows.map((r) => ({
    producto_id: Number(r.producto_id),
    nombre: r.nombre,
    unidades_vendidas: Number(r.unidades_vendidas || 0),
    revenue: Number(r.revenue || 0),
    pedidos_count: Number(r.pedidos_count || 0),
  }));
}

/** Revenue agrupado por día (default), semana o mes en una ventana
 *  temporal. Devuelve: [{ fecha, revenue, pedidos_count }].
 *
 *  `agrupadoPor` ∈ {'dia', 'semana', 'mes'}.
 *  - dia: DATE(p.creado_en) → 2026-07-09
 *  - semana: YEARWEEK(p.creado_en, 1) → 202627 (año + número de semana)
 *  - mes: DATE_FORMAT(p.creado_en, '%Y-%m') → 2026-07
 *
 *  Para 'semana' y 'mes' el `fecha` se devuelve como string con el
 *  formato descrito (lo renderiza el frontend directamente). */
export async function getRevenuePorPeriodo(restauranteId, { desde = null, hasta = null, agrupadoPor = 'dia' } = {}) {
  const params = [Number(restauranteId)];
  let extra = '';
  if (desde) { extra += ' AND p.creado_en >= ?'; params.push(normalizeDate(desde)); }
  if (hasta) { extra += ' AND p.creado_en <= ?'; params.push(normalizeDate(hasta)); }

  // IMPORTANTE: el orden de los `?` en el SQL final es
  //   restaurante_id, estado_1, estado_2, [desde], [hasta]
  // y los placeholders del IN deben matchear. Por eso insertamos los
  // estados en `params` ANTES de los placeholders de rango.
  const estados = ESTADOS_CONTABLES.map((s) => String(s));
  const fechas = params.slice(1);            // desde, hasta
  const orderedParams = [Number(restauranteId), ...estados, ...fechas];
  const placeholders = estados.map(() => '?').join(',');
  let groupExpr, orderExpr, selectFecha;
  switch (agrupadoPor) {
    case 'semana':
      selectFecha = 'YEARWEEK(p.creado_en, 1)';
      groupExpr = selectFecha;
      orderExpr = 'YEARWEEK(p.creado_en, 1) ASC';
      break;
    case 'mes':
      selectFecha = "DATE_FORMAT(p.creado_en, '%Y-%m')";
      groupExpr = selectFecha;
      orderExpr = selectFecha + ' ASC';
      break;
    case 'dia':
    default:
      selectFecha = 'DATE(p.creado_en)';
      groupExpr = selectFecha;
      orderExpr = 'DATE(p.creado_en) ASC';
      break;
  }

  const rows = await query(
    `SELECT ${selectFecha}             AS fecha,
            SUM(p.total)               AS revenue,
            COUNT(*)                   AS pedidos_count
       FROM pedidos p
      WHERE p.restaurante_id = ?
        AND p.canal = 'pos'
        AND p.estado IN (${placeholders})${extra}
      GROUP BY ${groupExpr}
      ORDER BY ${orderExpr}`,
    orderedParams
  );
  return rows.map((r) => ({
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha),
    revenue: Number(r.revenue || 0),
    pedidos_count: Number(r.pedidos_count || 0),
  }));
}

/** Resumen de pagos por método (efectivo, transferencia, etc.) en una
 *  ventana temporal. Devuelve: [{ metodo, total, pagos_count }].
 *
 *  IMPORTANTE: este reporte NO filtra por `canal = 'pos'`. Los pagos
 *  son del POS (la tabla `pagos` SOLO se popula desde el POS en el
 *  MVP). Si más adelante hay pagos web, habría que filtrar. */
export async function getMetodosPagoSummary(restauranteId, { desde = null, hasta = null } = {}) {
  const params = [Number(restauranteId)];
  let extra = '';
  if (desde) { extra += ' AND pg.creado_en >= ?'; params.push(normalizeDate(desde)); }
  if (hasta) { extra += ' AND pg.creado_en <= ?'; params.push(normalizeDate(hasta)); }

  const rows = await query(
    `SELECT pg.metodo        AS metodo,
            SUM(pg.monto)     AS total,
            COUNT(*)          AS pagos_count
       FROM pagos pg
      WHERE pg.restaurante_id = ?${extra}
      GROUP BY pg.metodo
      ORDER BY total DESC`,
    params
  );
  return rows.map((r) => ({
    metodo: r.metodo,
    total: Number(r.total || 0),
    pagos_count: Number(r.pagos_count || 0),
  }));
}

/** Detalle de cierre de UNA sesión de caja.
 *  Devuelve: { sesion, cajero, total_cobrado, por_metodo, pedidos_cobrados }.
 *
 *  `por_metodo`: [{ metodo, total, pagos_count }].
 *  `pedidos_cobrados`: número entero (no la lista — sería pesada). */
export async function getSesionDetalle(sesionId) {
  // 1) Traer la sesión + nombre del cajero.
  const sesion = await queryOne(
    `SELECT cs.*, u.nombre AS cajero_nombre, u.email AS cajero_email
       FROM cajas_sesiones cs
       JOIN usuarios u ON u.id = cs.usuario_id
      WHERE cs.id = ?
      LIMIT 1`,
    [Number(sesionId)]
  );
  if (!sesion) return null;

  // 2) Breakdown por método (solo pagos de la sesión).
  const porMetodo = await query(
    `SELECT metodo,
            SUM(monto)  AS total,
            COUNT(*)    AS pagos_count
       FROM pagos
      WHERE caja_sesion_id = ?
      GROUP BY metodo
      ORDER BY total DESC`,
    [Number(sesionId)]
  );

  // 3) KPIs: total cobrado, total pedidos, propinas, descuentos.
  const kpis = await queryOne(
    `SELECT COALESCE(SUM(monto), 0)      AS total_cobrado,
            COALESCE(SUM(propina), 0)     AS total_propinas,
            COALESCE(SUM(descuento), 0)   AS total_descuentos,
            COUNT(DISTINCT pedido_id)     AS pedidos_cobrados,
            COUNT(*)                      AS pagos_count
       FROM pagos
      WHERE caja_sesion_id = ?`,
    [Number(sesionId)]
  );

  return {
    sesion: {
      id: Number(sesion.id),
      restaurante_id: Number(sesion.restaurante_id),
      usuario_id: Number(sesion.usuario_id),
      monto_apertura: Number(sesion.monto_apertura || 0),
      monto_cierre_esperado: sesion.monto_cierre_esperado !== null ? Number(sesion.monto_cierre_esperado) : null,
      monto_cierre_real: sesion.monto_cierre_real !== null ? Number(sesion.monto_cierre_real) : null,
      diferencia: sesion.diferencia !== null ? Number(sesion.diferencia) : null,
      desglose_billetes: sesion.desglose_billetes
        ? (typeof sesion.desglose_billetes === 'string' ? JSON.parse(sesion.desglose_billetes) : sesion.desglose_billetes)
        : null,
      notas_cierre: sesion.notas_cierre || null,
      abierta_en: sesion.abierta_en,
      cerrada_en: sesion.cerrada_en,
      estado: sesion.estado,
      cajero_nombre: sesion.cajero_nombre,
      cajero_email: sesion.cajero_email,
    },
    por_metodo: porMetodo.map((r) => ({
      metodo: r.metodo,
      total: Number(r.total || 0),
      pagos_count: Number(r.pagos_count || 0),
    })),
    kpis: {
      total_cobrado: Number(kpis?.total_cobrado || 0),
      total_propinas: Number(kpis?.total_propinas || 0),
      total_descuentos: Number(kpis?.total_descuentos || 0),
      pedidos_cobrados: Number(kpis?.pedidos_cobrados || 0),
      pagos_count: Number(kpis?.pagos_count || 0),
    },
  };
}

/** Estadísticas generales (KPIs) del restaurante en una ventana
 *  temporal. Devuelve: { total_pedidos, revenue_total, ticket_promedio,
 *  total_clientes, total_items_vendidos }.
 *
 *  `total_clientes` cuenta DISTINCT `creado_por` (staff del restaurante).
 *  Esto NO son clientes únicos sino staff que tomó pedidos — el POS
 *  no tiene noción de "cliente" en la mayoría de los casos. */
export async function getEstadisticasGenerales(restauranteId, { desde = null, hasta = null } = {}) {
  const params = [Number(restauranteId)];
  let extra = '';
  if (desde) { extra += ' AND p.creado_en >= ?'; params.push(normalizeDate(desde)); }
  if (hasta) { extra += ' AND p.creado_en <= ?'; params.push(normalizeDate(hasta)); }

  const placeholders = ESTADOS_CONTABLES.map(() => '?').join(',');
  // 1) KPIs de pedidos.
  const pedidoKpis = await queryOne(
    `SELECT COUNT(*)                              AS total_pedidos,
            COALESCE(SUM(p.total), 0)             AS revenue_total,
            COALESCE(AVG(p.total), 0)             AS ticket_promedio,
            COUNT(DISTINCT p.creado_por)         AS total_staff_activos
       FROM pedidos p
      WHERE p.restaurante_id = ?
        AND p.canal = 'pos'
        AND p.estado IN (${placeholders})${extra}`,
    [Number(restauranteId), ...ESTADOS_CONTABLES, ...params.slice(1)]
  );

  // 2) Total de items vendidos (suma de cantidades en items_pedido).
  const itemsKpis = await queryOne(
    `SELECT COALESCE(SUM(ip.cantidad), 0) AS total_items_vendidos
       FROM items_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
      WHERE p.restaurante_id = ?
        AND p.canal = 'pos'
        AND p.estado IN (${placeholders})${extra}`,
    [Number(restauranteId), ...ESTADOS_CONTABLES, ...params.slice(1)]
  );

  return {
    total_pedidos: Number(pedidoKpis?.total_pedidos || 0),
    revenue_total: Number(pedidoKpis?.revenue_total || 0),
    ticket_promedio: Number(pedidoKpis?.ticket_promedio || 0),
    total_staff_activos: Number(pedidoKpis?.total_staff_activos || 0),
    total_items_vendidos: Number(itemsKpis?.total_items_vendidos || 0),
  };
}

export default {
  getTopProductos,
  getRevenuePorPeriodo,
  getMetodosPagoSummary,
  getSesionDetalle,
  getEstadisticasGenerales,
  ESTADOS_CONTABLES,
};
