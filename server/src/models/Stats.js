import pool, { query, queryOne } from '../config/database.js';

/**
 * Obtener estadísticas básicas (disponible para Profesional y Premium)
 */
export async function getBasicStats(restaurante_id) {
  const conn = await pool.getConnection();
  try {
    // Ventas totales (hoy, semana, mes)
    const [ventasHoy] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado' AND DATE(creado_en) = CURDATE()
    `, [restaurante_id]);

    const [ventasSemana] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
      AND YEARWEEK(creado_en, 1) = YEARWEEK(CURDATE(), 1)
    `, [restaurante_id]);

    const [ventasMes] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
      AND YEAR(creado_en) = YEAR(CURDATE()) AND MONTH(creado_en) = MONTH(CURDATE())
    `, [restaurante_id]);

    // Pedidos por estado
    const [pedidosTotales] = await conn.query(`
      SELECT COUNT(*) as total FROM pedidos WHERE restaurante_id = ?
    `, [restaurante_id]);

    const [pedidosCompletados] = await conn.query(`
      SELECT COUNT(*) as total FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
    `, [restaurante_id]);

    const [pedidosCancelados] = await conn.query(`
      SELECT COUNT(*) as total FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Cancelado'
    `, [restaurante_id]);

    const [pedidosPendientes] = await conn.query(`
      SELECT COUNT(*) as total FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Pendiente'
    `, [restaurante_id]);

    // Ticket promedio
    const [ticketPromedio] = await conn.query(`
      SELECT COALESCE(AVG(total), 0) as promedio
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
    `, [restaurante_id]);

    // Productos más vendidos (Top 10)
    const [productosMasVendidos] = await conn.query(`
      SELECT
        p.id,
        p.nombre,
        SUM(ip.cantidad) as cantidad_vendida,
        SUM(ip.subtotal) as ingresos_generados
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      WHERE p.restaurante_id = ?
      GROUP BY p.id, p.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT 10
    `, [restaurante_id]);

    // Ventas por día (últimos 30 días) - todos los pedidos, no solo entregados
    const [ventasDiarias] = await conn.query(`
      SELECT
        DATE(creado_en) as fecha,
        COALESCE(SUM(total), 0) as total_ventas,
        COUNT(*) as total_pedidos
      FROM pedidos
      WHERE restaurante_id = ?
        AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(creado_en)
      ORDER BY fecha ASC
    `, [restaurante_id]);

    // Métodos de pago
    const [metodosPago] = await conn.query(`
      SELECT
        metodo_pago,
        COUNT(*) as cantidad,
        COALESCE(SUM(total), 0) as total_ventas
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado' AND metodo_pago IS NOT NULL
      GROUP BY metodo_pago
      ORDER BY cantidad DESC
    `, [restaurante_id]);

    // Categorías más vendidas
    const [categoriasMasVendidas] = await conn.query(`
      SELECT
        c.nombre as categoria,
        SUM(ip.cantidad) as cantidad_vendida,
        COALESCE(SUM(ip.subtotal), 0) as ingresos_generados
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.restaurante_id = ?
      GROUP BY c.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT 10
    `, [restaurante_id]);

    // Producto estrella (más vendido)
    const [productoEstrella] = await conn.query(`
      SELECT
        p.id,
        p.nombre,
        SUM(ip.cantidad) as cantidad_vendida
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      WHERE p.restaurante_id = ?
      GROUP BY p.id, p.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT 1
    `, [restaurante_id]);

    // Convertir valores numéricos en los resultados
    // Nota: query() devuelve directamente el array de filas
    const productosConvertidos = Array.isArray(productosMasVendidos)
      ? productosMasVendidos.map(p => ({
          id: p.id,
          nombre: p.nombre,
          cantidad_vendida: Number(p.cantidad_vendida) || 0,
          ingresos_generados: Number(p.ingresos_generados) || 0,
        }))
      : [];

    const metodosConvertidos = Array.isArray(metodosPago)
      ? metodosPago.map(m => ({
          metodo_pago: m.metodo_pago,
          cantidad: Number(m.cantidad) || 0,
          total_ventas: Number(m.total_ventas) || 0,
          porcentaje: m.porcentaje ? Number(m.porcentaje) : 0,
        }))
      : [];

    const ventasDiariasConvertidas = Array.isArray(ventasDiarias)
      ? ventasDiarias.map(v => ({
          fecha: v.fecha,
          total_ventas: Number(v.total_ventas) || 0,
          total_pedidos: Number(v.total_pedidos) || 0,
        }))
      : [];

    const categoriasConvertidas = Array.isArray(categoriasMasVendidas)
      ? categoriasMasVendidas.map(c => ({
          categoria: c.categoria,
          cantidad_vendida: Number(c.cantidad_vendida) || 0,
          ingresos_generados: Number(c.ingresos_generados) || 0,
        }))
      : [];

    return {
      ventas: {
        hoy: Number(ventasHoy[0]?.total) || 0,
        semana: Number(ventasSemana[0]?.total) || 0,
        mes: Number(ventasMes[0]?.total) || 0,
      },
      pedidos: {
        total: Number(pedidosTotales[0]?.total) || 0,
        completados: Number(pedidosCompletados[0]?.total) || 0,
        cancelados: Number(pedidosCancelados[0]?.total) || 0,
        pendientes: Number(pedidosPendientes[0]?.total) || 0,
      },
      ticket_promedio: Number(ticketPromedio[0]?.promedio) || 0,
      productos_mas_vendidos: productosConvertidos,
      ventas_diarias: ventasDiariasConvertidas,
      metodos_pago: metodosConvertidos,
      categorias_mas_vendidas: categoriasConvertidas,
      resumen: {
        ingresos_totales: Number(ventasMes[0]?.total) || 0,
        producto_estrella: productoEstrella[0] ? {
          ...productoEstrella[0],
          cantidad_vendida: Number(productoEstrella[0].cantidad_vendida) || 0,
        } : null,
      },
    };
  } finally {
    conn.release();
  }
}

/**
 * Obtener estadísticas avanzadas (solo Premium)
 * Incluye todo lo del Profesional más métricas adicionales
 */
export async function getPremiumStats(restaurante_id) {
  const conn = await pool.getConnection();
  try {
    // Obtener primero las estadísticas básicas
    const basicStats = await getBasicStats(restaurante_id);

    // Horarios con más ventas (por hora) - todos los pedidos
    const [ventasPorHora] = await conn.query(`
      SELECT
        HOUR(creado_en) as hora,
        COUNT(*) as cantidad_pedidos,
        COALESCE(SUM(total), 0) as total_ventas
      FROM pedidos
      WHERE restaurante_id = ?
        AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND HOUR(creado_en) IS NOT NULL
      GROUP BY HOUR(creado_en)
      ORDER BY hora ASC
    `, [restaurante_id]);

    // Hora pico - todos los pedidos
    const [horaPico] = await conn.query(`
      SELECT
        HOUR(creado_en) as hora,
        COUNT(*) as cantidad_pedidos,
        COALESCE(SUM(total), 0) as total_ventas
      FROM pedidos
      WHERE restaurante_id = ?
        AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND HOUR(creado_en) IS NOT NULL
      GROUP BY HOUR(creado_en)
      ORDER BY total_ventas DESC
      LIMIT 1
    `, [restaurante_id]);

    // Días más rentables (comparativa semanal) - todos los pedidos
    const [diasRentables] = await conn.query(`
      SELECT
        DAYNAME(creado_en) as dia,
        DAYOFWEEK(creado_en) as numero_dia,
        COUNT(*) as cantidad_pedidos,
        COALESCE(SUM(total), 0) as total_ventas
      FROM pedidos
      WHERE restaurante_id = ?
        AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DAYNAME(creado_en), DAYOFWEEK(creado_en)
      ORDER BY numero_dia ASC
    `, [restaurante_id]);

    // Clientes recurrentes (Top 5) - todos los pedidos
    const [clientesRecurrentes] = await conn.query(`
      SELECT
        u.id,
        u.nombre,
        u.telefono,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(p.total), 0) as gasto_total
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.restaurante_id = ?
      GROUP BY u.id, u.nombre, u.telefono
      HAVING COUNT(p.id) > 1
      ORDER BY total_pedidos DESC
      LIMIT 10
    `, [restaurante_id]);

    // Clientes nuevos vs recurrentes - todos los pedidos
    const [clientesNuevosVsRecurrentes] = await conn.query(`
      SELECT
        CASE
          WHEN cliente_stats.total_pedidos = 1 THEN 'Nuevo'
          ELSE 'Recurrente'
        END as tipo_cliente,
        COUNT(*) as cantidad
      FROM (
        SELECT usuario_id, COUNT(*) as total_pedidos
        FROM pedidos
        WHERE restaurante_id = ?
          AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY usuario_id
      ) as cliente_stats
      GROUP BY tipo_cliente
    `, [restaurante_id]);

    // Evolución de ventas - este mes vs mes anterior
    const [ventasEsteMes] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
        AND YEAR(creado_en) = YEAR(CURDATE()) AND MONTH(creado_en) = MONTH(CURDATE())
    `, [restaurante_id]);

    const [ventasMesAnterior] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
        AND YEAR(creado_en) = YEAR(CURDATE()) AND MONTH(creado_en) = MONTH(CURDATE() - INTERVAL 1 MONTH)
    `, [restaurante_id]);

    // Evolución de ventas - esta semana vs semana anterior
    const [ventasEstaSemana] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
        AND YEARWEEK(creado_en, 1) = YEARWEEK(CURDATE(), 1)
    `, [restaurante_id]);

    const [ventasSemanaAnterior] = await conn.query(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'Entregado'
        AND YEARWEEK(creado_en, 1) = YEARWEEK(CURDATE() - INTERVAL 7 DAY, 1)
    `, [restaurante_id]);

    // Tasa de crecimiento mensual
    const crecimientoMensual = ventasMesAnterior[0]?.total > 0
      ? ((ventasEsteMes[0]?.total - ventasMesAnterior[0]?.total) / ventasMesAnterior[0]?.total) * 100
      : 0;

    // Cupones más utilizados (usando el contador usos_actuales)
    const [cuponesMasUtilizados] = await conn.query(`
      SELECT
        c.codigo,
        c.descuento,
        c.tipo_descuento,
        c.usos_actuales as veces_utilizado,
        COALESCE(c.usos_actuales * c.descuento, 0) as descuento_otorgado
      FROM cupones c
      WHERE c.restaurante_id = ? AND c.usos_actuales > 0
      ORDER BY c.usos_actuales DESC
      LIMIT 10
    `, [restaurante_id]);

    // Productos con mayor rentabilidad
    const [productosRentabilidad] = await conn.query(`
      SELECT
        p.id,
        p.nombre,
        SUM(ip.cantidad) as cantidad_vendida,
        COALESCE(SUM(ip.subtotal), 0) as ingresos_generados,
        COALESCE(AVG(ip.subtotal / ip.cantidad), 0) as ticket_promedio
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      WHERE p.restaurante_id = ?
      GROUP BY p.id, p.nombre
      ORDER BY ingresos_generados DESC
      LIMIT 10
    `, [restaurante_id]);

    // Tendencias de consumo - productos en crecimiento
    const [tendenciasProductos] = await conn.query(`
      SELECT
        p.id,
        p.nombre,
        SUM(CASE
          WHEN ip.creado_en >= DATE_SUB(CURDATE(), INTERVAL 15 DAY) THEN ip.cantidad
          ELSE 0
        END) as cantidad_ultimos_15_dias,
        SUM(CASE
          WHEN ip.creado_en < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
            AND ip.creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN ip.cantidad
          ELSE 0
        END) as cantidad_15_a_30_dias
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      WHERE p.restaurante_id = ?
        AND ip.creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY p.id, p.nombre
      HAVING cantidad_ultimos_15_dias > 0 OR cantidad_15_a_30_dias > 0
      ORDER BY cantidad_ultimos_15_dias DESC
      LIMIT 10
    `, [restaurante_id]);

    // Convertir valores numéricos en los resultados premium
    const ventasPorHoraConvertidas = Array.isArray(ventasPorHora)
      ? ventasPorHora.map(v => ({
          hora: Number(v.hora) || 0,
          cantidad_pedidos: Number(v.cantidad_pedidos) || 0,
          total_ventas: Number(v.total_ventas) || 0,
        }))
      : [];

    const diasRentablesConvertidos = Array.isArray(diasRentables)
      ? diasRentables.map(d => ({
          dia: d.dia,
          numero_dia: Number(d.numero_dia) || 0,
          cantidad_pedidos: Number(d.cantidad_pedidos) || 0,
          total_ventas: Number(d.total_ventas) || 0,
        }))
      : [];

    const clientesRecurrentesConvertidos = Array.isArray(clientesRecurrentes)
      ? clientesRecurrentes.map(c => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          total_pedidos: Number(c.total_pedidos) || 0,
          gasto_total: Number(c.gasto_total) || 0,
        }))
      : [];

    const clientesNuevosVsRecurrentesConvertidos = Array.isArray(clientesNuevosVsRecurrentes)
      ? clientesNuevosVsRecurrentes.map(c => ({
          tipo_cliente: c.tipo_cliente,
          cantidad: Number(c.cantidad) || 0,
        }))
      : [];

    const cuponesConvertidos = Array.isArray(cuponesMasUtilizados)
      ? cuponesMasUtilizados.map(c => ({
          codigo: c.codigo,
          descuento: Number(c.descuento) || 0,
          tipo_descuento: c.tipo_descuento,
          veces_utilizado: Number(c.veces_utilizado) || 0,
          descuento_otorgado: Number(c.descuento_otorgado) || 0,
        }))
      : [];

    const productosRentabilidadConvertidos = Array.isArray(productosRentabilidad)
      ? productosRentabilidad.map(p => ({
          id: p.id,
          nombre: p.nombre,
          cantidad_vendida: Number(p.cantidad_vendida) || 0,
          ingresos_generados: Number(p.ingresos_generados) || 0,
          ticket_promedio: Number(p.ticket_promedio) || 0,
        }))
      : [];

    const tendenciasConvertidas = Array.isArray(tendenciasProductos)
      ? tendenciasProductos.map(p => {
          const ultimos15 = Number(p.cantidad_ultimos_15_dias) || 0;
          const losUltimos15a30 = Number(p.cantidad_15_a_30_dias) || 0;

          // Determinar tendencia y variación
          let tendencia, variacion;
          if (losUltimos15a30 === 0 && ultimos15 === 0) {
            tendencia = 'estable';
            variacion = 'N/A';
          } else if (losUltimos15a30 === 0 && ultimos15 > 0) {
            tendencia = 'nuevo';
            variacion = 'N/A';
          } else if (ultimos15 === 0 && losUltimos15a30 > 0) {
            tendencia = 'descenso';
            variacion = '-100.00%';
          } else {
            const diff = ultimos15 - losUltimos15a30;
            const porcentaje = (diff / losUltimos15a30) * 100;
            tendencia = porcentaje >= 0 ? 'crecimiento' : 'descenso';
            variacion = `${porcentaje.toFixed(2)}%`;
          }

          return {
            id: p.id,
            nombre: p.nombre,
            cantidad_ultimos_15_dias: ultimos15,
            cantidad_15_a_30_dias: losUltimos15a30,
            tendencia,
            variacion,
          };
        })
      : [];

    const diaMasRentable = diasRentablesConvertidos.length > 0
      ? diasRentablesConvertidos.reduce((max, d) =>
          Number(d.total_ventas) > Number(max.total_ventas) ? d : max, diasRentablesConvertidos[0])
      : null;

    return {
      ...basicStats,
      // Horarios
      ventas_por_hora: ventasPorHoraConvertidas,
      hora_pico: horaPico[0] ? {
        hora: Number(horaPico[0].hora) || 0,
        cantidad_pedidos: Number(horaPico[0].cantidad_pedidos) || 0,
        total_ventas: Number(horaPico[0].total_ventas) || 0,
      } : null,
      dias_rentables: diasRentablesConvertidos,
      dia_mas_rentable: diaMasRentable,
      // Clientes
      clientes_recurrentes: clientesRecurrentesConvertidos,
      clientes_nuevos_vs_recurrentes: clientesNuevosVsRecurrentesConvertidos,
      // Evolución
      evolucion_ventas: {
        este_mes: {
          total: Number(ventasEsteMes[0]?.total) || 0,
          cantidad: Number(ventasEsteMes[0]?.cantidad) || 0,
        },
        mes_anterior: {
          total: Number(ventasMesAnterior[0]?.total) || 0,
          cantidad: Number(ventasMesAnterior[0]?.cantidad) || 0,
        },
        esta_semana: {
          total: Number(ventasEstaSemana[0]?.total) || 0,
          cantidad: Number(ventasEstaSemana[0]?.cantidad) || 0,
        },
        semana_anterior: {
          total: Number(ventasSemanaAnterior[0]?.total) || 0,
          cantidad: Number(ventasSemanaAnterior[0]?.cantidad) || 0,
        },
      },
      crecimiento_mensual: Number(crecimientoMensual.toFixed(2)),
      // Promociones
      cupones_mas_utilizados: cuponesConvertidos,
      // Rentabilidad
      productos_mayor_rentabilidad: productosRentabilidadConvertidos,
      // Tendencias
      tendencias_productos: tendenciasConvertidas,
    };
  } finally {
    conn.release();
  }
}

export default {
  getBasicStats,
  getPremiumStats,
};
