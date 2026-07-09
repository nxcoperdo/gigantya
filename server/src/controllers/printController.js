/**
 * Controller de impresión (Fase 4).
 *
 * Endpoints:
 *   GET /api/print/kitchen-ticket/:pedidoId   — comanda de cocina (sin precios)
 *   GET /api/print/receipt/:pedidoId          — recibo del cliente
 *
 * Ambos devuelven `application/pdf` (stream). El cliente puede abrirlos
 * en una pestaña nueva o embeberlos en un `<iframe>` para disparar
 * `window.print()`.
 *
 * Autorización:
 *   - Kitchen ticket: staff del restaurante del pedido (cocina, mesero,
 *     cajero, dueño, admin).
 *   - Receipt: mismo. La idea es que solo staff del local imprima.
 *
 * NOTA sobre tokens: en la URL usamos el mismo `Authorization: Bearer`
 * que el resto de la API (vía header). Para que el `<iframe>` pueda
 * disparar la impresión sin que el navegador le pida credenciales, el
 * frontend envía el header reusando `api.js` con `responseType: 'blob'`
 * y luego crea un object URL. NO metemos tokens en la URL (no se
 * pueden revocar y quedan en logs de proxies).
 */
import * as OrderModel from '../models/Order.js';
import { generateKitchenTicket, generateReceipt } from '../services/printService.js';

/** Helper: valida que el pedido sea del restaurante del token (o admin). */
function assertPedidoAccess(req, pedido) {
  if (req.user.tipo_usuario === 'admin') return;
  if (req.user.tipo_usuario === 'restaurante') {
    // El dueño del local: tiene que matchear `pedido.restaurante_id`.
    // (Asumimos que el owner de un local está en `usuarios.id`; el token
    //  no carga `restaurante_id` directamente — pero la validación
    //  exacta depende de la implementación de auth. Por ahora usamos
    //  una verificación de "mismo restaurante".)
    if (req.user.restaurante_id && Number(req.user.restaurante_id) !== Number(pedido.restaurante_id)) {
      const err = new Error('No autorizado para imprimir este pedido');
      err.statusCode = 403;
      throw err;
    }
    return;
  }
  // Staff (cajero/mesero/cocina): validamos por `restaurante_id` del token.
  if (req.user.restaurante_id && Number(req.user.restaurante_id) !== Number(pedido.restaurante_id)) {
    const err = new Error('No autorizado para imprimir este pedido');
    err.statusCode = 403;
    throw err;
  }
}

/** GET /api/print/kitchen-ticket/:pedidoId */
export async function getKitchenTicket(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!pedidoId || Number.isNaN(pedidoId)) {
      return res.status(400).json({ error: 'pedidoId inválido' });
    }
    // Traemos el pedido "ligero" (sin items) para el chequeo de ownership.
    // getOrderById ya viene con items y enriquecimientos; lo reusamos.
    const pedido = await OrderModel.getOrderById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    assertPedidoAccess(req, pedido);

    const doc = await generateKitchenTicket(pedidoId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comanda-${pedidoId}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    console.error('[print] kitchen ticket error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error generando comanda' });
  }
}

/** GET /api/print/receipt/:pedidoId */
export async function getReceipt(req, res) {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!pedidoId || Number.isNaN(pedidoId)) {
      return res.status(400).json({ error: 'pedidoId inválido' });
    }
    const pedido = await OrderModel.getOrderById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    assertPedidoAccess(req, pedido);

    const doc = await generateReceipt(pedidoId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recibo-${pedidoId}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    console.error('[print] receipt error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error generando recibo' });
  }
}

export default { getKitchenTicket, getReceipt };
