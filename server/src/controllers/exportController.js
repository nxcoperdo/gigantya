import exportService from '../services/exportService.js';
import * as StatsModel from '../models/Stats.js';
import * as OrderModel from '../models/Order.js';
import * as RestaurantModel from '../models/Restaurant.js';

/**
 * Construye un string legible con el rango de fechas para los reportes.
 * Formato: "DD/MM/YYYY - DD/MM/YYYY (Últimos N días)"
 */
function buildDateRange(days) {
  const n = Math.max(1, Math.min(365, parseInt(days) || 30));
  const fin = new Date();
  const inicio = new Date();
  inicio.setDate(fin.getDate() - (n - 1));
  const fmt = (d) => d.toLocaleDateString('es-CO');
  return `${fmt(inicio)} - ${fmt(fin)} (Últimos ${n} días)`;
}

/**
 * Construye el título-resumen de los filtros aplicados al reporte de pedidos.
 */
function buildOrdersFilterLabel(estado, limit) {
  const estadoLabel = (!estado || estado === 'todos') ? 'Todos los estados' : `Estado: ${estado}`;
  const limitN = Math.max(1, parseInt(limit) || 100);
  return `${estadoLabel} — Top ${limitN}`;
}

/**
 * Exportar estadísticas a PDF
 */
export async function exportStatsPDF(req, res) {
  try {
    const { days = 30 } = req.query;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden exportar estadísticas' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const estadisticas = req.user.restaurante?.plan === 'premium'
      ? await StatsModel.getPremiumStats(restaurante.id)
      : await StatsModel.getBasicStats(restaurante.id);

    const dateRange = buildDateRange(days);

    const pdfBuffer = await exportService.generateStatsPDF(
      estadisticas,
      restaurante,
      dateRange
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estadisticas_gigantya_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exportando PDF:', error);
    res.status(500).json({ error: 'Error generando el PDF', detalles: error.message });
  }
}

/**
 * Exportar estadísticas a Excel
 */
export async function exportStatsExcel(req, res) {
  try {
    const { days = 30 } = req.query;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden exportar estadísticas' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const estadisticas = req.user.restaurante?.plan === 'premium'
      ? await StatsModel.getPremiumStats(restaurante.id)
      : await StatsModel.getBasicStats(restaurante.id);

    const dateRange = buildDateRange(days);

    const excelBuffer = await exportService.generateStatsExcel(
      estadisticas,
      restaurante,
      dateRange
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="estadisticas_gigantya_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exportando Excel:', error);
    res.status(500).json({ error: 'Error generando el Excel', detalles: error.message });
  }
}

/**
 * Exportar pedidos a PDF
 */
export async function exportOrdersPDF(req, res) {
  try {
    const { estado = 'todos', limit = 100 } = req.query;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden exportar pedidos' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const limitN = Math.max(1, parseInt(limit) || 100);
    const filtros = {
      estado,
      limit: limitN,
      label: buildOrdersFilterLabel(estado, limitN),
    };

    const pedidos = await OrderModel.getOrdersByRestaurant(restaurante.id, estado !== 'todos' ? estado : null);
    const pedidosFiltrados = pedidos.slice(0, limitN);

    const pdfBuffer = await exportService.generateOrdersPDF(
      pedidosFiltrados,
      restaurante,
      filtros
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pedidos_gigantya_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exportando pedidos PDF:', error);
    res.status(500).json({ error: 'Error generando el PDF', detalles: error.message });
  }
}

/**
 * Exportar pedidos a Excel
 */
export async function exportOrdersExcel(req, res) {
  try {
    const { estado = 'todos', limit = 500 } = req.query;

    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ error: 'Solo restaurantes pueden exportar pedidos' });
    }

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    const limitN = Math.max(1, parseInt(limit) || 500);
    const filtros = {
      estado,
      limit: limitN,
      label: buildOrdersFilterLabel(estado, limitN),
    };

    const pedidos = await OrderModel.getOrdersByRestaurant(restaurante.id, estado !== 'todos' ? estado : null);
    const pedidosFiltrados = pedidos.slice(0, limitN);

    const excelBuffer = await exportService.generateOrdersExcel(
      pedidosFiltrados,
      restaurante,
      filtros
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pedidos_gigantya_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exportando pedidos Excel:', error);
    res.status(500).json({ error: 'Error generando el Excel', detalles: error.message });
  }
}

export default {
  exportStatsPDF,
  exportStatsExcel,
  exportOrdersPDF,
  exportOrdersExcel,
};
