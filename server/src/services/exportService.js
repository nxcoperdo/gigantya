import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

/**
 * Servicio de Exportación de Reportes
 * Genera archivos PDF y Excel para estadísticas y pedidos
 */

// ====================================================
// EXPORTACIÓN A PDF
// ====================================================

/**
 * Generar PDF de estadísticas del restaurante
 */
export async function generateStatsPDF(statsData, restaurantName, dateRange) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 }
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc
      .fillColor('#667eea')
      .fontSize(24)
      .text('GigantYa - Reporte de Estadísticas', { align: 'center' });

    doc
      .fillColor('#333')
      .fontSize(12)
      .text(restaurantName, { align: 'center', top: 10 });

    doc
      .fontSize(10)
      .text(`Período: ${dateRange}`, { align: 'center', top: 5 })
      .text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}`, { align: 'center', top: 5 });

    // Línea separadora
    doc.moveTo(40, 130).lineTo(570, 130).strokeColor('#667eea').stroke();

    let yPos = 150;

    // Resumen de Ventas
    yPos = drawSection(doc, yPos, '📊 Resumen de Ventas', [
      `Ventas de Hoy: $${Number(statsData.ventas?.hoy || 0).toLocaleString('es-CO')}`,
      `Ventas de la Semana: $${Number(statsData.ventas?.semana || 0).toLocaleString('es-CO')}`,
      `Ventas del Mes: $${Number(statsData.ventas?.mes || 0).toLocaleString('es-CO')}`,
    ]);

    // Pedidos
    yPos = drawSection(doc, yPos, '🛒 Pedidos', [
      `Total Pedidos: ${statsData.pedidos?.total || 0}`,
      `Completados: ${statsData.pedidos?.completados || 0}`,
      `Cancelados: ${statsData.pedidos?.cancelados || 0}`,
      `Pendientes: ${statsData.pedidos?.pendientes || 0}`,
    ]);

    // Ticket Promedio
    yPos = drawSection(doc, yPos, '💰 Ticket Promedio', [
      `$${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')} por pedido`,
    ]);

    // Productos Más Vendidos
    if (statsData.productos_mas_vendidos?.length > 0) {
      yPos = drawSection(doc, yPos, '⭐ Productos Más Vendidos', []);
      doc.fontSize(10).fillColor('#555');

      statsData.productos_mas_vendidos.slice(0, 10).forEach((prod, idx) => {
        doc.text(
          `${idx + 1}. ${prod.nombre} - ${prod.cantidad_vendida} unidades ($${Number(prod.ingresos_generados || 0).toLocaleString('es-CO')})`,
          40,
          yPos,
          { width: 530 }
        );
        yPos += 18;
      });
      yPos += 10;
    }

    // Métodos de Pago
    if (statsData.metodos_pago?.length > 0) {
      yPos = drawSection(doc, yPos, '💳 Métodos de Pago', []);
      doc.fontSize(10).fillColor('#555');

      statsData.metodos_pago.forEach((metodo) => {
        const label = metodo.metodo_pago?.replace('_', ' ').toUpperCase() || 'OTRO';
        doc.text(
          `${label}: ${metodo.cantidad} pedidos ($${Number(metodo.total_ventas || 0).toLocaleString('es-CO')})`,
          40,
          yPos,
          { width: 530 }
        );
        yPos += 18;
      });
      yPos += 10;
    }

    // Pie de página
    doc
      .fillColor('#999')
      .fontSize(9)
      .text('---', 40, yPos)
      .text('Reporte generado automáticamente por GigantYa', { align: 'center', top: 10 })
      .text('Gracias por usar nuestra plataforma', { align: 'center', top: 5 });

    doc.end();
  });
}

/**
 * Generar PDF de lista de pedidos
 */
export async function generateOrdersPDF(pedidos, restaurantName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 }
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc
      .fillColor('#667eea')
      .fontSize(24)
      .text('GigantYa - Reporte de Pedidos', { align: 'center' });

    doc
      .fillColor('#333')
      .fontSize(12)
      .text(restaurantName, { align: 'center', top: 10 });

    doc
      .fontSize(10)
      .text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, { align: 'center', top: 5 });

    // Línea separadora
    doc.moveTo(40, 130).lineTo(570, 130).strokeColor('#667eea').stroke();

    let yPos = 150;

    // Tabla de pedidos
    drawTable(doc, {
      headers: ['#', 'Cliente', 'Estado', 'Total', 'Fecha'],
      rows: pedidos.map(p => [
        `#${p.id}`,
        p.cliente_nombre || 'N/A',
        p.estado,
        `$${Number(p.total || 0).toLocaleString('es-CO')}`,
        new Date(p.creado_en).toLocaleDateString('es-CO'),
      ]),
      startY: yPos,
    });

    doc.end();
  });
}

// Helpers para PDF
function drawSection(doc, yPos, title, items) {
  doc
    .fillColor('#667eea')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(title, 40, yPos);

  yPos += 25;

  if (items.length > 0) {
    doc
      .fillColor('#333')
      .fontSize(11)
      .font('Helvetica');

    items.forEach(item => {
      doc.text(item, 50, yPos, { width: 520 });
      yPos += 18;
    });
    yPos += 10;
  }

  return yPos;
}

function drawTable(doc, { headers, rows, startY }) {
  const colWidths = [60, 180, 120, 100, 110];
  const rowHeight = 25;
  const headerHeight = 30;

  // Encabezado
  doc.fillColor('#667eea').fontSize(10).font('Helvetica-Bold');
  headers.forEach((header, idx) => {
    const x = 40 + colWidths.slice(0, idx).reduce((a, b) => a + b, 0);
    doc.text(header, x, startY, {
      width: colWidths[idx],
      align: idx === 3 ? 'right' : 'left'
    });
  });

  // Línea bajo encabezado
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  doc.moveTo(40, startY + headerHeight - 5)
     .lineTo(40 + totalWidth, startY + headerHeight - 5)
     .strokeColor('#667eea')
     .stroke();

  // Filas
  doc.fillColor('#333').fontSize(9).font('Helvetica');
  let y = startY + headerHeight;

  rows.forEach((row, idx) => {
    row.forEach((cell, colIdx) => {
      const x = 40 + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0);
      doc.text(cell, x, y, {
        width: colWidths[colIdx],
        align: colIdx === 3 ? 'right' : 'left'
      });
    });
    y += rowHeight;

    // Línea separadora cada 5 filas
    if ((idx + 1) % 5 === 0) {
      doc.moveTo(40, y - 2)
         .lineTo(40 + totalWidth, y - 2)
         .strokeColor('#ddd')
         .stroke();
    }

    // Nueva página si se acaba el espacio
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
  });
}

// ====================================================
// EXPORTACIÓN A EXCEL
// ====================================================

/**
 * Generar Excel de estadísticas
 */
export async function generateStatsExcel(statsData, restaurantName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GigantYa';
  workbook.created = new Date();

  // Hoja 1: Resumen
  const resumenSheet = workbook.addWorksheet('Resumen');
  resumenSheet.columns = [
    { header: 'Métrica', key: 'metrica', width: 30 },
    { header: 'Valor', key: 'valor', width: 20 },
  ];

  // Estilos
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667eea' } },
    alignment: { horizontal: 'center' },
  };

  const titleStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'center' },
  };

  // Título
  resumenSheet.mergeCells('A1:B1');
  resumenSheet.getCell('A1').value = `📊 Estadísticas - ${restaurantName}`;
  resumenSheet.getCell('A1').font = { bold: true, size: 16 };
  resumenSheet.getCell('A1').alignment = { horizontal: 'center' };

  // Ventas
  resumenSheet.addRow([]);
  resumenSheet.addRow(['📈 VENTAS', '']);
  resumenSheet.getCell(`A${resumenSheet.rowCount}`).font = { bold: true, color: { argb: 'FF667eea' } };

  resumenSheet.addRow(['Ventas de Hoy', `$${Number(statsData.ventas?.hoy || 0).toLocaleString('es-CO')}`]);
  resumenSheet.addRow(['Ventas de la Semana', `$${Number(statsData.ventas?.semana || 0).toLocaleString('es-CO')}`]);
  resumenSheet.addRow(['Ventas del Mes', `$${Number(statsData.ventas?.mes || 0).toLocaleString('es-CO')}`]);

  // Pedidos
  resumenSheet.addRow([]);
  resumenSheet.addRow(['🛒 PEDIDOS', '']);
  resumenSheet.getCell(`A${resumenSheet.rowCount}`).font = { bold: true, color: { argb: 'FF667eea' } };

  resumenSheet.addRow(['Total Pedidos', statsData.pedidos?.total || 0]);
  resumenSheet.addRow(['Completados', statsData.pedidos?.completados || 0]);
  resumenSheet.addRow(['Cancelados', statsData.pedidos?.cancelados || 0]);
  resumenSheet.addRow(['Pendientes', statsData.pedidos?.pendientes || 0]);

  // Métricas clave
  resumenSheet.addRow([]);
  resumenSheet.addRow(['📊 MÉTRICAS CLAVE', '']);
  resumenSheet.getCell(`A${resumenSheet.rowCount}`).font = { bold: true, color: { argb: 'FF667eea' } };

  resumenSheet.addRow(['Ticket Promedio', `$${Number(statsData.ticket_promedio || 0).toLocaleString('es-CO')}`]);
  resumenSheet.addRow(['Ingresos Totales', `$${Number(statsData.resumen?.ingresos_totales || 0).toLocaleString('es-CO')}`]);

  // Productos más vendidos
  if (statsData.productos_mas_vendidos?.length > 0) {
    const productosSheet = workbook.addWorksheet('Productos');
    productosSheet.columns = [
      { header: '#', key: 'pos', width: 5 },
      { header: 'Producto', key: 'nombre', width: 40 },
      { header: 'Cantidad Vendida', key: 'cantidad', width: 20 },
      { header: 'Ingresos Generados', key: 'ingresos', width: 25 },
    ];

    productosSheet.getCell('A1').fill = headerStyle.fill;
    productosSheet.getCell('B1').fill = headerStyle.fill;
    productosSheet.getCell('C1').fill = headerStyle.fill;
    productosSheet.getCell('D1').fill = headerStyle.fill;

    productosSheet.getRow(1).font = headerStyle.font;

    statsData.productos_mas_vendidos.forEach((prod, idx) => {
      productosSheet.addRow({
        pos: idx + 1,
        nombre: prod.nombre,
        cantidad: prod.cantidad_vendida,
        ingresos: `$${Number(prod.ingresos_generados || 0).toLocaleString('es-CO')}`,
      });
    });
  }

  // Métodos de pago
  if (statsData.metodos_pago?.length > 0) {
    const pagosSheet = workbook.addWorksheet('Pagos');
    pagosSheet.columns = [
      { header: 'Método', key: 'metodo', width: 25 },
      { header: 'Cantidad', key: 'cantidad', width: 15 },
      { header: 'Total Ventas', key: 'total', width: 20 },
      { header: 'Porcentaje', key: 'porcentaje', width: 15 },
    ];

    statsData.metodos_pago.forEach((metodo) => {
      pagosSheet.addRow({
        metodo: (metodo.metodo_pago || 'otro').replace('_', ' ').toUpperCase(),
        cantidad: metodo.cantidad,
        total: `$${Number(metodo.total_ventas || 0).toLocaleString('es-CO')}`,
        porcentaje: `${metodo.porcentaje || 0}%`,
      });
    });
  }

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generar Excel de pedidos
 */
export async function generateOrdersExcel(pedidos, restaurantName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GigantYa';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Pedidos');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 15 },
    { header: 'Estado', key: 'estado', width: 20 },
    { header: 'Método Pago', key: 'pago', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Fecha', key: 'fecha', width: 20 },
  ];

  // Estilo de encabezado
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF667eea' },
  };
  sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  pedidos.forEach(pedido => {
    sheet.addRow({
      id: pedido.id,
      cliente: pedido.cliente_nombre || 'N/A',
      telefono: pedido.cliente_telefono || 'N/A',
      estado: pedido.estado,
      pago: (pedido.metodo_pago || 'N/A').replace('_', ' '),
      total: `$${Number(pedido.total || 0).toLocaleString('es-CO')}`,
      fecha: new Date(pedido.creado_en).toLocaleString('es-CO'),
    });
  });

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 7 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ====================================================
// EXPORT DEFAULT
// ====================================================

export default {
  generateStatsPDF,
  generateOrdersPDF,
  generateStatsExcel,
  generateOrdersExcel,
};
