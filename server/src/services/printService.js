/**
 * Servicio de impresión de PDFs (Fase 4).
 *
 * Genera dos tipos de documentos en formato 80mm (ticket de punto de venta
 * térmico estándar):
 *
 *   - `generateKitchenTicket(pedidoId)` — comanda para cocina.
 *     Incluye: header del restaurante, número de pedido, mesa o "Recoger"/
 *     "Domicilio", items con cantidad × nombre + adiciones + removidos +
 *     nota del item, total. Sin precios (la cocina no cobra).
 *
 *   - `generateReceipt(pedidoId)` — recibo para el cliente.
 *     Incluye: header, número, fecha, items con precios, subtotal, descuento,
 *     impuestos, envío, total. Pie con "Gracias".
 *
 * Devuelven un `Promise<Stream>` de `pdfkit` que el controller pipea directo
 * a `res`. No escribimos a disco: el PDF se streamea al cliente.
 *
 * Tamaño: 80mm = 226.77 puntos PDF. Usamos altura dinámica calculada
 * en función de la cantidad de líneas (cada item ocupa ~3 líneas).
 */
import PDFDocument from 'pdfkit';
import * as OrderModel from '../models/Order.js';

/** 80 mm de ancho en puntos PDF (1 mm = 2.83465 pt). */
const PAGE_WIDTH = 226.77;
const MARGIN_X = 8;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/** Altura por línea (en pt). Default 11pt si no se pasa. */
const LINE_HEIGHT = 12;
const HEADING_LINE_HEIGHT = 14;

/** Helper: formatea moneda COP sin decimales (alineado con `formatHelper`). */
const fmtMoney = (n) => {
  const v = Number(n) || 0;
  return `$${Math.round(v).toLocaleString('es-CO')}`;
};

/** Helper: formatea hora HH:MM en zona horaria local del servidor. */
const fmtTime = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

/** Helper: dibuja texto y devuelve la Y final. Trunca si excede el ancho
 *  disponible (cocina quiere ver TODO, no resumido). */
function writeText(doc, text, opts = {}) {
  const { bold = false, size = 9, gap = 2 } = opts;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  doc.text(text, MARGIN_X, doc.y, { width: USABLE_WIDTH, lineGap: gap });
  return doc.y;
}

/** Calcula la altura del PDF necesaria para un pedido en modo comanda. */
function estimateKitchenHeight(pedido) {
  let lines = 12; // header + mesa + pie
  for (const it of pedido.items || []) {
    lines += 2; // item + nota
    lines += (it.adiciones?.length || 0);
    lines += (it.removidos?.length || 0);
  }
  return lines * LINE_HEIGHT + 40; // margen de seguridad
}

/** Calcula la altura del PDF para un recibo. */
function estimateReceiptHeight(pedido) {
  let lines = 16;
  for (const it of pedido.items || []) {
    lines += 2;
    lines += (it.adiciones?.length || 0);
  }
  return lines * LINE_HEIGHT + 60;
}

/** Carga el pedido (con items enriquecidos) o lanza si no existe. */
async function loadPedido(pedidoId) {
  const pedido = await OrderModel.getOrderById(pedidoId);
  if (!pedido) {
    const err = new Error(`Pedido #${pedidoId} no existe`);
    err.statusCode = 404;
    throw err;
  }
  return pedido;
}

/** Comanda de cocina (sin precios). */
export async function generateKitchenTicket(pedidoId) {
  const pedido = await loadPedido(pedidoId);
  const height = estimateKitchenHeight(pedido);
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, Math.max(height, 300)],
    margins: { top: 8, bottom: 8, left: MARGIN_X, right: MARGIN_X },
    info: {
      Title: `Comanda #${pedidoId}`,
      Author: pedido.restaurante_nombre || 'POS',
    },
  });

  // Header del restaurante
  writeText(doc, pedido.restaurante_nombre || 'Restaurante', { bold: true, size: 12 });
  if (pedido.restaurante_telefono) {
    writeText(doc, `Tel: ${pedido.restaurante_telefono}`, { size: 8 });
  }
  doc.moveDown(0.3);

  // Tipo de pedido
  const tipoLine = pedido.mesa_id
    ? `Mesa ${pedido.mesa_id}`
    : (pedido.es_retiro_local ? 'Para recoger' : 'Domicilio');
  writeText(doc, tipoLine, { bold: true, size: 11 });
  writeText(doc, `Pedido #${pedidoId}`, { size: 9 });
  writeText(doc, `Hora: ${fmtTime(pedido.creado_en)}`, { size: 8 });
  if (pedido.cliente_nombre) {
    writeText(doc, `Cliente: ${pedido.cliente_nombre}`, { size: 8 });
  }
  doc.moveDown(0.3);

  // Separador
  doc.font('Helvetica').fontSize(8);
  doc.text('─'.repeat(32), MARGIN_X, doc.y, { width: USABLE_WIDTH, characterSpacing: 0 });
  doc.moveDown(0.2);

  // Items
  for (const item of pedido.items || []) {
    const header = `${item.cantidad}× ${item.producto_nombre || `Producto #${item.producto_id}`}`;
    writeText(doc, header, { bold: true, size: 10 });
    for (const a of item.adiciones || []) {
      writeText(doc, `  + ${a.nombre}${a.cantidad > 1 ? ` (${a.cantidad})` : ''}`, { size: 8 });
    }
    for (const r of item.removidos || []) {
      writeText(doc, `  sin ${r.nombre}`, { size: 8 });
    }
    if (item.especificaciones) {
      writeText(doc, `  "${item.especificaciones}"`, { size: 8 });
    }
    doc.moveDown(0.2);
  }

  // Nota general del pedido
  if (pedido.notas) {
    doc.moveDown(0.2);
    writeText(doc, 'NOTA:', { bold: true, size: 8 });
    writeText(doc, pedido.notas, { size: 8 });
  }

  // Pie
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8);
  doc.text('─'.repeat(32), MARGIN_X, doc.y, { width: USABLE_WIDTH });
  writeText(doc, `Total: ${fmtMoney(pedido.total)}`, { bold: true, size: 10 });
  writeText(doc, `Estado: ${pedido.estado}`, { size: 8 });

  doc.end();
  return doc;
}

/** Recibo del cliente (con precios, impuestos, etc.). */
export async function generateReceipt(pedidoId) {
  const pedido = await loadPedido(pedidoId);
  const height = estimateReceiptHeight(pedido);
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, Math.max(height, 400)],
    margins: { top: 8, bottom: 8, left: MARGIN_X, right: MARGIN_X },
    info: {
      Title: `Recibo #${pedidoId}`,
      Author: pedido.restaurante_nombre || 'POS',
    },
  });

  // Header
  writeText(doc, pedido.restaurante_nombre || 'Restaurante', { bold: true, size: 12 });
  if (pedido.restaurante_telefono) {
    writeText(doc, `Tel: ${pedido.restaurante_telefono}`, { size: 8 });
  }
  doc.moveDown(0.3);

  writeText(doc, `Recibo #${pedidoId}`, { bold: true, size: 11 });
  const fechaStr = new Date(pedido.creado_en).toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  writeText(doc, fechaStr, { size: 8 });
  if (pedido.cliente_nombre) {
    writeText(doc, `Cliente: ${pedido.cliente_nombre}`, { size: 8 });
  }
  if (pedido.mesa_id) {
    writeText(doc, `Mesa: ${pedido.mesa_id}`, { size: 8 });
  }
  if (pedido.direccion_entrega) {
    writeText(doc, `Dir: ${pedido.direccion_entrega.slice(0, 40)}`, { size: 8 });
  }
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(8);
  doc.text('─'.repeat(32), MARGIN_X, doc.y, { width: USABLE_WIDTH });
  doc.moveDown(0.2);

  // Items con precios
  for (const item of pedido.items || []) {
    const cant = item.cantidad;
    const precio = Number(item.precio_unitario) || 0;
    const subtotal = Number(item.subtotal) || (precio * cant);
    const lineText = `${cant}× ${item.producto_nombre || `Producto #${item.producto_id}`}`;
    writeText(doc, lineText, { bold: true, size: 9 });
    for (const a of item.adiciones || []) {
      writeText(doc, `  + ${a.nombre}`, { size: 8 });
    }
    // Subtotal a la derecha
    doc.font('Helvetica').fontSize(8);
    const right = `${fmtMoney(subtotal)}`;
    doc.text(right, MARGIN_X, doc.y, { width: USABLE_WIDTH, align: 'right' });
  }

  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8);
  doc.text('─'.repeat(32), MARGIN_X, doc.y, { width: USABLE_WIDTH });

  // Totales (subtotal lo recalculamos de los items, no del modelo, para
  // mostrarlo desglosado en el recibo).
  const itemsSubtotal = (pedido.items || []).reduce(
    (s, it) => s + (Number(it.subtotal) || 0), 0
  );
  const totalGuardado = Number(pedido.total) || 0;
  const costoEnvio = Number(pedido.costo_envio) || 0;
  // El descuento se infiere por diferencia (igual que `getOrderById`).
  const descuento = Math.max(0, itemsSubtotal + costoEnvio - totalGuardado);
  const subtotalConEnvio = itemsSubtotal + costoEnvio;

  writeText(doc, `Subtotal: ${fmtMoney(itemsSubtotal)}`, { size: 9 });
  if (costoEnvio > 0) {
    writeText(doc, `Envío: ${fmtMoney(costoEnvio)}`, { size: 9 });
  }
  if (descuento > 0) {
    writeText(doc, `Descuento: -${fmtMoney(descuento)}`, { size: 9 });
  }
  doc.moveDown(0.2);
  writeText(doc, `TOTAL: ${fmtMoney(totalGuardado)}`, { bold: true, size: 12 });

  doc.moveDown(0.5);
  writeText(doc, '¡Gracias por su compra!', { size: 9 });

  doc.end();
  return doc;
}
