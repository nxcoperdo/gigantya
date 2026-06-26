import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Servicio de Exportación de Reportes
 * Genera archivos PDF y Excel para estadísticas y pedidos.
 *
 * Convenciones:
 * - Todas las funciones que reciben `restaurante` esperan el objeto completo
 *   (al menos: nombre, direccion, telefono, plan, ciudad). Si solo se tiene el
 *   nombre, las secciones de subtítulo lo manejan con strings vacíos.
 * - `dateRange` y `filtros.label` son strings ya formateados para mostrarlos
 *   directamente en el encabezado del reporte.
 */

// =====================================================
// PALETA / CONSTANTES VISUALES
// =====================================================
const COLOR_PRIMARY = '#FF6B00';   // Naranja corporativo GigantYa
const COLOR_TEXT    = '#333333';
const COLOR_MUTED   = '#777777';
const COLOR_RULE    = '#DDDDDD';
const COLOR_BG_SOFT = '#F7F7F7';
const COLOR_GREEN   = '#10B981';
const COLOR_RED     = '#EF4444';
const COLOR_BLUE    = '#3B82F6';
const COLOR_AMBER   = '#F59E0B';

const CURRENCY_FMT = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

const fmtDate = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO');
};

const fmtDateTime = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('es-CO');
};

// Devuelve un subtítulo "dirección • teléfono • plan" solo con los datos presentes.
function buildSubtitle(restaurante) {
  const parts = [];
  if (restaurante?.direccion) parts.push(restaurante.direccion);
  if (restaurante?.telefono) parts.push(`Tel: ${restaurante.telefono}`);
  if (restaurante?.plan) parts.push(`Plan ${restaurante.plan}`);
  if (restaurante?.ciudad) parts.push(restaurante.ciudad);
  return parts.join(' • ');
}

// =====================================================
// EXPORTACIÓN A PDF
// =====================================================

/**
 * Generar PDF de estadísticas del restaurante
 */
export async function generateStatsPDF(statsData, restaurante, dateRange) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 40, right: 40 },
      bufferPages: true, // para numerar al final
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const restNombre = restaurante?.nombre || 'Restaurante';
    const subtitle = buildSubtitle(restaurante);

    // ---- Encabezado ----
    doc.fillColor(COLOR_PRIMARY).fontSize(22).font('Helvetica-Bold')
      .text('GigantYa — Reporte de Estadísticas', { align: 'center' });

    doc.fillColor(COLOR_TEXT).fontSize(13).font('Helvetica')
      .text(restNombre, { align: 'center' });

    if (subtitle) {
      doc.fillColor(COLOR_MUTED).fontSize(9)
        .text(subtitle, { align: 'center' });
    }

    doc.fillColor(COLOR_MUTED).fontSize(9)
      .text(`Período: ${dateRange}`, { align: 'center' })
      .text(`Emitido: ${fmtDateTime()}`, { align: 'center' });

    doc.moveTo(40, doc.y + 6).lineTo(570, doc.y + 6).strokeColor(COLOR_PRIMARY).lineWidth(1.2).stroke();

    let y = doc.y + 14;

    // ---- Resumen Ejecutivo (KPIs) ----
    y = drawKpiGrid(doc, y, [
      { label: 'Ventas hoy',     value: CURRENCY_FMT(statsData.ventas?.hoy),     color: COLOR_PRIMARY },
      { label: 'Ventas semana',  value: CURRENCY_FMT(statsData.ventas?.semana),  color: COLOR_BLUE },
      { label: 'Ventas mes',     value: CURRENCY_FMT(statsData.ventas?.mes),     color: COLOR_GREEN },
      { label: 'Ticket promedio',value: CURRENCY_FMT(statsData.ticket_promedio), color: COLOR_AMBER },
    ]);

    y = drawKpiGrid(doc, y + 8, [
      { label: 'Pedidos totales',     value: String(statsData.pedidos?.total ?? 0),       color: COLOR_TEXT },
      { label: 'Completados',         value: String(statsData.pedidos?.completados ?? 0), color: COLOR_GREEN },
      { label: 'Cancelados',          value: String(statsData.pedidos?.cancelados ?? 0),  color: COLOR_RED },
      { label: 'Pendientes',          value: String(statsData.pedidos?.pendientes ?? 0),  color: COLOR_AMBER },
    ]);

    if (typeof statsData.crecimiento_mensual === 'number') {
      const arrow = statsData.crecimiento_mensual >= 0 ? '▲' : '▼';
      const color = statsData.crecimiento_mensual >= 0 ? COLOR_GREEN : COLOR_RED;
      y = drawKpiGrid(doc, y + 8, [
        { label: 'Crecimiento mensual', value: `${arrow} ${Math.abs(statsData.crecimiento_mensual).toFixed(1)}%`, color },
        { label: 'Ingresos totales',    value: CURRENCY_FMT(statsData.resumen?.ingresos_totales), color: COLOR_TEXT },
        { label: 'Producto estrella',   value: statsData.resumen?.producto_estrella?.nombre || '—', color: COLOR_PRIMARY },
        { label: 'Hora pico',           value: statsData.hora_pico ? `${statsData.hora_pico.hora}:00 (${statsData.hora_pico.cantidad_pedidos} ped.)` : '—', color: COLOR_TEXT },
      ]);
    }

    // ---- Productos más vendidos (tabla) ----
    if (statsData.productos_mas_vendidos?.length > 0) {
      y = drawSectionTitle(doc, y, 'Productos Más Vendidos (Top 10)');
      y = drawTable(doc, y,
        ['#', 'Producto', 'Cantidad', 'Ingresos'],
        [40, 200, 100, 150],
        statsData.productos_mas_vendidos.slice(0, 10).map((p, idx) => ([
          String(idx + 1),
          p.nombre || '—',
          String(p.cantidad_vendida ?? 0),
          CURRENCY_FMT(p.ingresos_generados),
        ])),
        {
          totalsRow: [
            '',
            'TOTAL',
            String(statsData.productos_mas_vendidos.reduce((a, p) => a + Number(p.cantidad_vendida || 0), 0)),
            CURRENCY_FMT(statsData.productos_mas_vendidos.reduce((a, p) => a + Number(p.ingresos_generados || 0), 0)),
          ],
        }
      );
      y += 12;
    }

    // ---- Categorías más vendidas ----
    if (statsData.categorias_mas_vendidas?.length > 0) {
      y = drawSectionTitle(doc, y, 'Categorías Más Vendidas');
      y = drawTable(doc, y,
        ['#', 'Categoría', 'Cantidad', 'Ingresos'],
        [40, 200, 100, 150],
        statsData.categorias_mas_vendidas.slice(0, 10).map((c, idx) => ([
          String(idx + 1),
          c.categoria || 'Sin categoría',
          String(c.cantidad_vendida ?? 0),
          CURRENCY_FMT(c.ingresos_generados),
        ])),
        {
          totalsRow: [
            '',
            'TOTAL',
            String(statsData.categorias_mas_vendidas.reduce((a, c) => a + Number(c.cantidad_vendida || 0), 0)),
            CURRENCY_FMT(statsData.categorias_mas_vendidas.reduce((a, c) => a + Number(c.ingresos_generados || 0), 0)),
          ],
        }
      );
      y += 12;
    }

    // ---- Ventas Diarias (últimos 14 días para no saturar) ----
    if (statsData.ventas_diarias?.length > 0) {
      const ultimos14 = statsData.ventas_diarias.slice(-14);
      y = drawSectionTitle(doc, y, `Ventas Diarias (últimos ${ultimos14.length} días)`);
      y = drawTable(doc, y,
        ['Fecha', 'Pedidos', 'Ventas'],
        [80, 100, 150],
        ultimos14.map(v => ([
          fmtDate(v.fecha),
          String(v.total_pedidos ?? 0),
          CURRENCY_FMT(v.total_ventas),
        ])),
        {
          totalsRow: [
            'TOTAL',
            String(ultimos14.reduce((a, v) => a + Number(v.total_pedidos || 0), 0)),
            CURRENCY_FMT(ultimos14.reduce((a, v) => a + Number(v.total_ventas || 0), 0)),
          ],
        }
      );
      y += 12;
    }

    // ---- Ventas por Hora (solo Premium) ----
    if (statsData.ventas_por_hora?.length > 0) {
      const top12 = [...statsData.ventas_por_hora]
        .sort((a, b) => Number(b.cantidad_pedidos || 0) - Number(a.cantidad_pedidos || 0))
        .slice(0, 12);
      y = drawSectionTitle(doc, y, 'Ventas por Hora (Top 12 franjas)');
      y = drawTable(doc, y,
        ['Hora', 'Pedidos', 'Ventas'],
        [80, 100, 150],
        top12.map(h => ([
          `${String(h.hora).padStart(2, '0')}:00 — ${String(h.hora).padStart(2, '0')}:59`,
          String(h.cantidad_pedidos ?? 0),
          CURRENCY_FMT(h.total_ventas),
        ])),
        {
          totalsRow: [
            'TOTAL',
            String(top12.reduce((a, h) => a + Number(h.cantidad_pedidos || 0), 0)),
            CURRENCY_FMT(top12.reduce((a, h) => a + Number(h.total_ventas || 0), 0)),
          ],
        }
      );
      y += 12;
    }

    // ---- Métodos de Pago ----
    if (statsData.metodos_pago?.length > 0) {
      y = drawSectionTitle(doc, y, 'Métodos de Pago');
      y = drawTable(doc, y,
        ['Método', 'Pedidos', 'Total', '%'],
        [180, 80, 130, 70],
        statsData.metodos_pago.map(m => ([
          String(m.metodo_pago || 'OTRO').replace(/_/g, ' ').toUpperCase(),
          String(m.cantidad ?? 0),
          CURRENCY_FMT(m.total_ventas),
          `${Number(m.porcentaje || 0).toFixed(1)}%`,
        ])),
        {
          totalsRow: [
            'TOTAL',
            String(statsData.metodos_pago.reduce((a, m) => a + Number(m.cantidad || 0), 0)),
            CURRENCY_FMT(statsData.metodos_pago.reduce((a, m) => a + Number(m.total_ventas || 0), 0)),
            `${statsData.metodos_pago.reduce((a, m) => a + Number(m.porcentaje || 0), 0).toFixed(1)}%`,
          ],
        }
      );
      y += 12;
    }

    // ---- Cupones más usados (solo Premium) ----
    if (statsData.cupones_mas_utilizados?.length > 0) {
      y = drawSectionTitle(doc, y, 'Cupones Más Utilizados');
      y = drawTable(doc, y,
        ['#', 'Código', 'Descuento', 'Usos', 'Total descontado'],
        [40, 100, 80, 70, 150],
        statsData.cupones_mas_utilizados.slice(0, 10).map((c, idx) => ([
          String(idx + 1),
          c.codigo || '—',
          c.tipo_descuento === 'porcentaje' ? `${c.descuento}%` : CURRENCY_FMT(c.descuento),
          String(c.veces_utilizado ?? c.usos_actuales ?? 0),
          CURRENCY_FMT(c.descuento_otorgado),
        ])),
        {
          totalsRow: [
            '',
            'TOTAL',
            '',
            String(statsData.cupones_mas_utilizados.reduce((a, c) => a + Number(c.veces_utilizado || c.usos_actuales || 0), 0)),
            CURRENCY_FMT(statsData.cupones_mas_utilizados.reduce((a, c) => a + Number(c.descuento_otorgado || 0), 0)),
          ],
        }
      );
    }

    // ---- Pie + numeración ----
    drawPdfFooter(doc, 'Reporte generado automáticamente por GigantYa');

    doc.end();
  });
}

/**
 * Generar PDF de lista de pedidos
 */
export async function generateOrdersPDF(pedidos, restaurante, filtros = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 40, right: 40 },
      bufferPages: true,
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const restNombre = restaurante?.nombre || 'Restaurante';
    const subtitle = buildSubtitle(restaurante);
    const filterLabel = filtros?.label || 'Todos los estados — Top 100';

    // Encabezado
    doc.fillColor(COLOR_PRIMARY).fontSize(22).font('Helvetica-Bold')
      .text('GigantYa — Reporte de Pedidos', { align: 'center' });

    doc.fillColor(COLOR_TEXT).fontSize(13).font('Helvetica')
      .text(restNombre, { align: 'center' });

    if (subtitle) {
      doc.fillColor(COLOR_MUTED).fontSize(9)
        .text(subtitle, { align: 'center' });
    }

    doc.fillColor(COLOR_MUTED).fontSize(9)
      .text(`Filtros: ${filterLabel}`, { align: 'center' })
      .text(`Emitido: ${fmtDateTime()}`, { align: 'center' });

    doc.moveTo(40, doc.y + 6).lineTo(570, doc.y + 6).strokeColor(COLOR_PRIMARY).lineWidth(1.2).stroke();

    // Tabla
    let y = doc.y + 14;

    // Calcular totales
    const totalCantidad = pedidos.length;
    const sumaTotal = pedidos.reduce((a, p) => a + Number(p.total || 0), 0);

    y = drawTable(doc, y,
      ['#', 'Cliente', 'Estado', 'Total', 'Fecha'],
      [50, 180, 110, 90, 110],
      pedidos.map((p, idx) => ([
        String(idx + 1),
        p.cliente_nombre || 'N/A',
        p.estado || '—',
        CURRENCY_FMT(p.total),
        fmtDate(p.creado_en),
      ])),
      {
        totalsRow: [
          'TOTAL',
          `${totalCantidad} pedidos`,
          '',
          CURRENCY_FMT(sumaTotal),
          '',
        ],
      }
    );

    drawPdfFooter(doc, 'Reporte generado automáticamente por GigantYa');

    doc.end();
  });
}

// =====================================================
// HELPERS PARA PDF
// =====================================================

/**
 * Dibuja el título de una sección y devuelve el y siguiente.
 * Si no hay espacio, crea nueva página.
 */
function drawSectionTitle(doc, y, title) {
  ensureSpace(doc, y, 30);
  if (y !== doc.y) y = doc.y; // ensureSpace pudo haber avanzado de página
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(13)
    .text(title, 40, y);
  y = doc.y + 6;
  return y;
}

/**
 * Dibuja una grilla de KPIs (4 columnas). `y` es la posición actual.
 * Devuelve el y siguiente.
 */
function drawKpiGrid(doc, y, kpis) {
  ensureSpace(doc, y, 50);

  const startX = 40;
  const cellW = 130;
  const cellH = 42;
  const gap = 2;

  kpis.forEach((kpi, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = startX + col * (cellW + gap);
    const yy = y + row * (cellH + gap);

    // Borde y fondo suave
    doc.rect(x, yy, cellW, cellH).fillColor(COLOR_BG_SOFT).fill();
    doc.rect(x, yy, cellW, cellH).strokeColor(COLOR_RULE).lineWidth(0.5).stroke();

    // Label
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(8)
      .text(String(kpi.label).toUpperCase(), x + 8, yy + 6, { width: cellW - 16 });

    // Valor
    doc.fillColor(kpi.color || COLOR_TEXT).font('Helvetica-Bold').fontSize(14)
      .text(String(kpi.value), x + 8, yy + 20, { width: cellW - 16, ellipsis: true });
  });

  const rows = Math.ceil(kpis.length / 4);
  return y + rows * (cellH + gap) + 4;
}

/**
 * Dibuja una tabla con encabezado, filas, líneas guía, y opcional fila de totales.
 * Maneja paginación automáticamente.
 *
 * columns: array de strings
 * colWidths: array de anchos (deben sumar aprox 530)
 * rows: array de arrays de strings
 * totalsRow: array opcional con la fila de totales (mismo #cols)
 */
function drawTable(doc, y, columns, colWidths, rows, { totalsRow = null } = {}) {
  const rowHeight = 22;
  const headerHeight = 26;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const drawHeader = (yy) => {
    doc.rect(40, yy, totalWidth, headerHeight).fillColor(COLOR_PRIMARY).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    let x = 40;
    columns.forEach((col, idx) => {
      doc.text(String(col), x + 6, yy + 8, {
        width: colWidths[idx] - 12,
        align: idx >= 2 && /[Tt]otal|[Pp]edidos|Fecha|[Cc]antidad|[Vv]entas|['"]\$/.test(col) ? 'right' : 'left',
        ellipsis: true,
      });
      x += colWidths[idx];
    });
    return yy + headerHeight;
  };

  let curY = y;
  curY = drawHeader(curY);

  doc.font('Helvetica').fontSize(9);

  rows.forEach((row, rIdx) => {
    // ¿necesita paginación?
    if (curY + rowHeight > doc.page.height - 70) {
      doc.addPage();
      curY = 50;
      curY = drawHeader(curY);
    }

    // Filas alternadas
    if (rIdx % 2 === 1) {
      doc.rect(40, curY, totalWidth, rowHeight).fillColor(COLOR_BG_SOFT).fill();
    }

    // Celdas
    let x = 40;
    row.forEach((cell, cIdx) => {
      const isNumeric = cIdx >= 2;
      doc.fillColor(COLOR_TEXT).text(String(cell ?? '—'), x + 6, curY + 6, {
        width: colWidths[cIdx] - 12,
        align: isNumeric ? 'right' : 'left',
        ellipsis: true,
      });
      x += colWidths[cIdx];
    });

    // Línea inferior suave
    doc.moveTo(40, curY + rowHeight).lineTo(40 + totalWidth, curY + rowHeight)
      .strokeColor(COLOR_RULE).lineWidth(0.4).stroke();

    curY += rowHeight;
  });

  // Fila de totales
  if (totalsRow) {
    if (curY + rowHeight + 4 > doc.page.height - 70) {
      doc.addPage();
      curY = 50;
      curY = drawHeader(curY);
    }

    doc.rect(40, curY, totalWidth, rowHeight + 2).fillColor(COLOR_PRIMARY).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    let x = 40;
    totalsRow.forEach((cell, cIdx) => {
      const isNumeric = cIdx >= 2;
      doc.text(String(cell ?? ''), x + 6, curY + 7, {
        width: colWidths[cIdx] - 12,
        align: isNumeric ? 'right' : 'left',
        ellipsis: true,
      });
      x += colWidths[cIdx];
    });
    curY += rowHeight + 2;
  }

  doc.fillColor(COLOR_TEXT); // reset
  return curY + 4;
}

/**
 * Asegura que haya al menos `needed` puntos de espacio vertical; si no, agrega página.
 */
function ensureSpace(doc, y, needed) {
  if (y + needed > doc.page.height - 70) {
    doc.addPage();
  }
}

/**
 * Pinta un pie de página y agrega numeración "Página N de M" en cada hoja.
 */
function drawPdfFooter(doc, text) {
  const range = doc.bufferedPageRange(); // { start, count }
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 40;
    doc.moveTo(40, y - 6).lineTo(570, y - 6).strokeColor(COLOR_RULE).lineWidth(0.4).stroke();

    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(8)
      .text(text, 40, y, { width: 360, align: 'left' });

    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(8)
      .text(`Página ${i + 1} de ${range.count}`, 400, y, { width: 170, align: 'right' });
  }
}

// =====================================================
// EXPORTACIÓN A EXCEL
// =====================================================

const CURRENCY_NFMT   = '"$"#,##0';
const PERCENT_NFMT    = '0.0"%"';
const NUMBER_NFMT     = '#,##0';
const DATE_NFMT       = 'dd/mm/yyyy';
const DATETIME_NFMT   = 'dd/mm/yyyy hh:mm';

const HEADER_FILL = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B00' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const TOTALS_FILL = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0CC' },
};
const TOTALS_FONT = { bold: true, color: { argb: 'FF333333' } };
const TITLE_FONT  = { bold: true, size: 16, color: { argb: 'FF333333' } };
const SUBTITLE_FONT = { italic: true, size: 10, color: { argb: 'FF777777' } };

function applyHeaderRow(sheet, rowNumber, lastCol) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = sheet.getRow(rowNumber).getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  }
  sheet.getRow(rowNumber).height = 22;
}

function applyTitleRow(sheet, rowNumber, text, lastCol, subtitleText = null) {
  sheet.mergeCells(rowNumber, 1, rowNumber, lastCol);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = TITLE_FONT;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowNumber).height = 26;

  if (subtitleText) {
    const sub = rowNumber + 1;
    sheet.mergeCells(sub, 1, sub, lastCol);
    const subCell = sheet.getCell(sub, 1);
    subCell.value = subtitleText;
    subCell.font = SUBTITLE_FONT;
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(sub).height = 18;
  }
}

function applyDataBorders(sheet, fromRow, toRow, lastCol) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = sheet.getRow(r).getCell(c);
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
      };
    }
  }
}

function applyTotalsRow(sheet, rowNumber, lastCol) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = sheet.getRow(rowNumber).getCell(c);
    cell.fill = TOTALS_FILL;
    cell.font = TOTALS_FONT;
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFFF6B00' } },
      bottom: { style: 'thin', color: { argb: 'FFFF6B00' } },
      left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
      right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
    };
  }
  sheet.getRow(rowNumber).height = 22;
}

function freezeTopAndFilter(sheet, fromCol = 1, toCol = 1) {
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false }];
  sheet.autoFilter = { from: { row: 1, column: fromCol }, to: { row: 1, column: toCol } };
}

/**
 * Generar Excel de estadísticas
 */
export async function generateStatsExcel(statsData, restaurante, dateRange) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GigantYa';
  workbook.created = new Date();

  const restNombre = restaurante?.nombre || 'Restaurante';
  const subtitle = buildSubtitle(restaurante);
  const titleFull = `📊 Estadísticas — ${restNombre}`;
  const subtitleFull = [subtitle, `Período: ${dateRange}`, `Emitido: ${fmtDateTime()}`]
    .filter(Boolean)
    .join(' | ');

  // ============= HOJA: RESUMEN =============
  const resumen = workbook.addWorksheet('Resumen');
  resumen.columns = [
    { header: 'Métrica', key: 'metrica', width: 35 },
    { header: 'Valor',   key: 'valor',   width: 28 },
  ];
  applyTitleRow(resumen, 1, titleFull, 2, subtitleFull);

  let r = 3;
  const kpis = [
    { label: 'Ventas de hoy',           value: Number(statsData.ventas?.hoy || 0),         nfmt: CURRENCY_NFMT },
    { label: 'Ventas de la semana',     value: Number(statsData.ventas?.semana || 0),      nfmt: CURRENCY_NFMT },
    { label: 'Ventas del mes',          value: Number(statsData.ventas?.mes || 0),         nfmt: CURRENCY_NFMT },
    { label: 'Ticket promedio',         value: Number(statsData.ticket_promedio || 0),    nfmt: CURRENCY_NFMT },
    { label: 'Ingresos totales (mes)',  value: Number(statsData.resumen?.ingresos_totales || 0), nfmt: CURRENCY_NFMT },
    { label: 'Total pedidos',           value: Number(statsData.pedidos?.total || 0),     nfmt: NUMBER_NFMT },
    { label: 'Pedidos completados',     value: Number(statsData.pedidos?.completados || 0), nfmt: NUMBER_NFMT },
    { label: 'Pedidos cancelados',      value: Number(statsData.pedidos?.cancelados || 0),  nfmt: NUMBER_NFMT },
    { label: 'Pedidos pendientes',      value: Number(statsData.pedidos?.pendientes || 0),  nfmt: NUMBER_NFMT },
    { label: 'Producto estrella',       value: statsData.resumen?.producto_estrella?.nombre || '—', nfmt: null },
  ];
  if (typeof statsData.crecimiento_mensual === 'number') {
    kpis.push({ label: 'Crecimiento mensual', value: Number(statsData.crecimiento_mensual), nfmt: PERCENT_NFMT });
  }
  if (statsData.hora_pico) {
    kpis.push({ label: 'Hora pico', value: `${statsData.hora_pico.hora}:00 (${statsData.hora_pico.cantidad_pedidos} ped.)`, nfmt: null });
  }

  kpis.forEach((k) => {
    resumen.addRow({ metrica: k.label, valor: k.value });
    const cell = resumen.getRow(r).getCell(2);
    if (k.nfmt) cell.numFmt = k.nfmt;
    cell.alignment = { horizontal: 'right' };
    r++;
  });
  applyDataBorders(resumen, 3, r - 1, 2);
  resumen.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, showGridLines: false }];

  // ============= HOJA: PRODUCTOS =============
  if (statsData.productos_mas_vendidos?.length > 0) {
    const productos = workbook.addWorksheet('Productos');
    productos.columns = [
      { header: '#',            key: 'pos',      width: 6 },
      { header: 'Producto',     key: 'nombre',   width: 40 },
      { header: 'Cantidad',     key: 'cantidad', width: 14, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Ingresos',     key: 'ingresos', width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(productos, 1, titleFull, 4, subtitleFull);
    applyHeaderRow(productos, 3, 4);

    let totalCant = 0;
    let totalIngresos = 0;
    statsData.productos_mas_vendidos.forEach((p, idx) => {
      productos.addRow({
        pos: idx + 1,
        nombre: p.nombre,
        cantidad: Number(p.cantidad_vendida || 0),
        ingresos: Number(p.ingresos_generados || 0),
      });
      totalCant += Number(p.cantidad_vendida || 0);
      totalIngresos += Number(p.ingresos_generados || 0);
    });
    const lastDataRow = productos.rowCount;
    productos.addRow({ pos: '', nombre: 'TOTAL', cantidad: totalCant, ingresos: totalIngresos });
    applyDataBorders(productos, 4, lastDataRow, 4);
    applyTotalsRow(productos, lastDataRow + 1, 4);
    freezeTopAndFilter(productos, 1, 4);
  }

  // ============= HOJA: CATEGORÍAS =============
  if (statsData.categorias_mas_vendidas?.length > 0) {
    const cats = workbook.addWorksheet('Categorías');
    cats.columns = [
      { header: '#',          key: 'pos',      width: 6 },
      { header: 'Categoría',  key: 'cat',      width: 30 },
      { header: 'Cantidad',   key: 'cantidad', width: 14, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Ingresos',   key: 'ingresos', width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(cats, 1, titleFull, 4, subtitleFull);
    applyHeaderRow(cats, 3, 4);

    let tCant = 0;
    let tIng = 0;
    statsData.categorias_mas_vendidas.forEach((c, idx) => {
      cats.addRow({
        pos: idx + 1,
        cat: c.categoria || 'Sin categoría',
        cantidad: Number(c.cantidad_vendida || 0),
        ingresos: Number(c.ingresos_generados || 0),
      });
      tCant += Number(c.cantidad_vendida || 0);
      tIng += Number(c.ingresos_generados || 0);
    });
    const lastDataRow = cats.rowCount;
    cats.addRow({ pos: '', cat: 'TOTAL', cantidad: tCant, ingresos: tIng });
    applyDataBorders(cats, 4, lastDataRow, 4);
    applyTotalsRow(cats, lastDataRow + 1, 4);
    freezeTopAndFilter(cats, 1, 4);
  }

  // ============= HOJA: VENTAS DIARIAS =============
  if (statsData.ventas_diarias?.length > 0) {
    const vd = workbook.addWorksheet('Ventas Diarias');
    vd.columns = [
      { header: 'Fecha',   key: 'fecha',   width: 16, style: { numFmt: DATE_NFMT, alignment: { horizontal: 'center' } } },
      { header: 'Pedidos', key: 'pedidos', width: 12, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Ventas',  key: 'ventas',  width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(vd, 1, titleFull, 3, subtitleFull);
    applyHeaderRow(vd, 3, 3);

    let tPed = 0;
    let tVentas = 0;
    statsData.ventas_diarias.forEach(v => {
      vd.addRow({
        fecha: v.fecha,
        pedidos: Number(v.total_pedidos || 0),
        ventas: Number(v.total_ventas || 0),
      });
      tPed += Number(v.total_pedidos || 0);
      tVentas += Number(v.total_ventas || 0);
    });
    const lastDataRow = vd.rowCount;
    vd.addRow({ fecha: 'TOTAL', pedidos: tPed, ventas: tVentas });
    applyDataBorders(vd, 4, lastDataRow, 3);
    applyTotalsRow(vd, lastDataRow + 1, 3);
    freezeTopAndFilter(vd, 1, 3);
  }

  // ============= HOJA: VENTAS POR HORA (premium) =============
  if (statsData.ventas_por_hora?.length > 0) {
    const vh = workbook.addWorksheet('Ventas por Hora');
    vh.columns = [
      { header: 'Hora',    key: 'hora',    width: 10, style: { alignment: { horizontal: 'center' } } },
      { header: 'Pedidos', key: 'pedidos', width: 12, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Ventas',  key: 'ventas',  width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(vh, 1, titleFull, 3, subtitleFull);
    applyHeaderRow(vh, 3, 3);

    let tP = 0;
    let tV = 0;
    statsData.ventas_por_hora.forEach(h => {
      const hora = Number(h.hora);
      vh.addRow({
        hora: `${String(hora).padStart(2, '0')}:00`,
        pedidos: Number(h.cantidad_pedidos || 0),
        ventas: Number(h.total_ventas || 0),
      });
      tP += Number(h.cantidad_pedidos || 0);
      tV += Number(h.total_ventas || 0);
    });
    const lastDataRow = vh.rowCount;
    vh.addRow({ hora: 'TOTAL', pedidos: tP, ventas: tV });
    applyDataBorders(vh, 4, lastDataRow, 3);
    applyTotalsRow(vh, lastDataRow + 1, 3);
    freezeTopAndFilter(vh, 1, 3);
  }

  // ============= HOJA: PAGOS =============
  if (statsData.metodos_pago?.length > 0) {
    const pagos = workbook.addWorksheet('Pagos');
    pagos.columns = [
      { header: 'Método', key: 'metodo',    width: 22 },
      { header: 'Pedidos', key: 'cantidad', width: 12, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Total',   key: 'total',    width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
      { header: '%',       key: 'porcentaje',width: 12, style: { numFmt: PERCENT_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(pagos, 1, titleFull, 4, subtitleFull);
    applyHeaderRow(pagos, 3, 4);

    // El porcentaje crudo que viene de SQL es 0..100; ExcelJS lo muestra como "0%" si le pasamos el número directo.
    // Para que se vea como "45.0%" guardamos /100.
    let tCant = 0;
    let tTotal = 0;
    let tPorc = 0;
    statsData.metodos_pago.forEach(m => {
      const metodo = String(m.metodo_pago || 'OTRO').replace(/_/g, ' ').toUpperCase();
      const cant = Number(m.cantidad || 0);
      const tot = Number(m.total_ventas || 0);
      const porc = Number(m.porcentaje || 0) / 100;
      pagos.addRow({ metodo, cantidad: cant, total: tot, porcentaje: porc });
      tCant += cant;
      tTotal += tot;
      tPorc += Number(m.porcentaje || 0);
    });
    const lastDataRow = pagos.rowCount;
    pagos.addRow({ metodo: 'TOTAL', cantidad: tCant, total: tTotal, porcentaje: tPorc / 100 });
    applyDataBorders(pagos, 4, lastDataRow, 4);
    applyTotalsRow(pagos, lastDataRow + 1, 4);
    freezeTopAndFilter(pagos, 1, 4);
  }

  // ============= HOJA: CUPONES (premium) =============
  if (statsData.cupones_mas_utilizados?.length > 0) {
    const cup = workbook.addWorksheet('Cupones');
    cup.columns = [
      { header: '#',          key: 'pos',        width: 6 },
      { header: 'Código',     key: 'codigo',     width: 22 },
      { header: 'Descuento',  key: 'descuento',  width: 14, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Usos',       key: 'usos',       width: 10, style: { numFmt: NUMBER_NFMT, alignment: { horizontal: 'right' } } },
      { header: 'Total desc.', key: 'total',     width: 18, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    ];
    applyTitleRow(cup, 1, titleFull, 5, subtitleFull);
    applyHeaderRow(cup, 3, 5);

    let tUsos = 0;
    let tDesc = 0;
    statsData.cupones_mas_utilizados.forEach((c, idx) => {
      const usos = Number(c.veces_utilizado || c.usos_actuales || 0);
      const desc = Number(c.descuento || 0);
      const totalDesc = Number(c.descuento_otorgado || 0);
      cup.addRow({
        pos: idx + 1,
        codigo: c.codigo || '—',
        descuento: c.tipo_descuento === 'porcentaje' ? desc : desc,
        usos,
        total: totalDesc,
      });
      tUsos += usos;
      tDesc += totalDesc;
    });
    const lastDataRow = cup.rowCount;
    cup.addRow({ pos: '', codigo: 'TOTAL', descuento: '', usos: tUsos, total: tDesc });
    applyDataBorders(cup, 4, lastDataRow, 5);
    applyTotalsRow(cup, lastDataRow + 1, 5);
    freezeTopAndFilter(cup, 1, 5);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generar Excel de pedidos
 */
export async function generateOrdersExcel(pedidos, restaurante, filtros = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GigantYa';
  workbook.created = new Date();

  const restNombre = restaurante?.nombre || 'Restaurante';
  const subtitle = buildSubtitle(restaurante);
  const filterLabel = filtros?.label || 'Todos los estados — Top 500';
  const titleFull = `📋 Pedidos — ${restNombre}`;
  const subtitleFull = [subtitle, `Filtros: ${filterLabel}`, `Emitido: ${fmtDateTime()}`]
    .filter(Boolean)
    .join(' | ');

  const sheet = workbook.addWorksheet('Pedidos');
  sheet.columns = [
    { header: '#',            key: 'pos',      width: 6 },
    { header: 'ID',           key: 'id',       width: 8,  style: { alignment: { horizontal: 'center' } } },
    { header: 'Cliente',      key: 'cliente',  width: 30 },
    { header: 'Teléfono',     key: 'telefono', width: 16 },
    { header: 'Estado',       key: 'estado',   width: 18 },
    { header: 'Método Pago',  key: 'pago',     width: 18 },
    { header: 'Total',        key: 'total',    width: 16, style: { numFmt: CURRENCY_NFMT, alignment: { horizontal: 'right' } } },
    { header: 'Fecha',        key: 'fecha',    width: 18, style: { numFmt: DATETIME_NFMT, alignment: { horizontal: 'center' } } },
  ];
  applyTitleRow(sheet, 1, titleFull, 8, subtitleFull);
  applyHeaderRow(sheet, 3, 8);

  let sumaTotal = 0;
  pedidos.forEach((pedido, idx) => {
    const total = Number(pedido.total || 0);
    sumaTotal += total;
    sheet.addRow({
      pos: idx + 1,
      id: pedido.id,
      cliente: pedido.cliente_nombre || 'N/A',
      telefono: pedido.cliente_telefono || 'N/A',
      estado: pedido.estado || '—',
      pago: String(pedido.metodo_pago || 'N/A').replace(/_/g, ' '),
      total,
      fecha: pedido.creado_en ? new Date(pedido.creado_en) : null,
    });
  });
  const lastDataRow = sheet.rowCount;
  sheet.addRow({
    pos: '',
    id: '',
    cliente: '',
    telefono: '',
    estado: 'TOTAL',
    pago: `${pedidos.length} pedidos`,
    total: sumaTotal,
    fecha: '',
  });
  applyDataBorders(sheet, 4, lastDataRow, 8);
  applyTotalsRow(sheet, lastDataRow + 1, 8);
  freezeTopAndFilter(sheet, 1, 8);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// =====================================================
// EXPORT DEFAULT
// =====================================================

export default {
  generateStatsPDF,
  generateOrdersPDF,
  generateStatsExcel,
  generateOrdersExcel,
};
