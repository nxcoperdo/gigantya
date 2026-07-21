/**
 * Controller de Inventario (POS Fase 6).
 *
 * Endpoints:
 *   GET    /api/pos/inventory/ingredientes              listar
 *   GET    /api/pos/inventory/ingredientes/:id          detalle
 *   POST   /api/pos/inventory/ingredientes              crear (dueño/admin)
 *   PUT    /api/pos/inventory/ingredientes/:id          actualizar (dueño/admin)
 *   DELETE /api/pos/inventory/ingredientes/:id          soft-delete (dueño/admin)
 *   GET    /api/pos/inventory/bom/producto/:productoId  obtener receta
 *   PUT    /api/pos/inventory/bom/producto/:productoId  reemplazar receta (dueño/admin)
 *   GET    /api/pos/inventory/kardex                    listar movimientos
 *   POST   /api/pos/inventory/movimientos               compra/merma/ajuste
 *   GET    /api/pos/inventory/alertas                   ingredientes bajo mínimo
 *
 * Autorización:
 *   - Lecturas: cualquier staff del restaurante.
 *   - Mutaciones de estructura (crear/editar/borrar ingredientes,
 *     reemplazar BOM): solo dueño/admin.
 *   - Movimientos manuales de stock (compra/merma/ajuste): cualquier
 *     staff del restaurante.
 */
import * as posInventoryService from '../services/posInventoryService.js';

/** Helper: extrae restaurante_id del token o del query/body para admin. */
function resolveRestauranteId(req) {
  if (req.user.tipo_usuario === 'admin') {
    return Number(req.query.restaurante_id || req.body.restaurante_id);
  }
  return req.user.restaurante_id;
}

function requireRest(req, res) {
  const rid = resolveRestauranteId(req);
  if (!rid) {
    res.status(400).json({ error: 'No se pudo determinar el restaurante. Si eres admin, pasa ?restaurante_id=X' });
    return null;
  }
  return rid;
}

function requireOwnerOrAdmin(req, res) {
  if (!['restaurante', 'admin'].includes(req.user.tipo_usuario)) {
    res.status(403).json({ error: 'Solo el dueño puede realizar esta acción' });
    return false;
  }
  return true;
}

// ========== Ingredientes ==========

/** GET /api/pos/inventory/ingredientes */
export async function listIngredientes(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const ingredientes = await posInventoryService.listIngredientes(rid);
    res.json({ ingredientes });
  } catch (err) {
    console.error('[posInventory] listIngredientes error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando ingredientes' });
  }
}

/** GET /api/pos/inventory/ingredientes/:id */
export async function getIngrediente(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const ing = await posInventoryService.getIngrediente(Number(req.params.id), rid);
    res.json({ ingrediente: ing });
  } catch (err) {
    console.error('[posInventory] getIngrediente error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error obteniendo ingrediente' });
  }
}

/** POST /api/pos/inventory/ingredientes — dueño/admin */
export async function createIngrediente(req, res) {
  try {
    if (!requireOwnerOrAdmin(req, res)) return;
    const rid = requireRest(req, res);
    if (!rid) return;
    const data = { ...req.body, _usuarioId: req.user.id };
    const ing = await posInventoryService.createIngrediente(rid, data);
    res.status(201).json({ ingrediente: ing });
  } catch (err) {
    console.error('[posInventory] createIngrediente error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error creando ingrediente' });
  }
}

/** PUT /api/pos/inventory/ingredientes/:id — dueño/admin */
export async function updateIngrediente(req, res) {
  try {
    if (!requireOwnerOrAdmin(req, res)) return;
    const rid = requireRest(req, res);
    if (!rid) return;
    const ing = await posInventoryService.updateIngrediente(
      Number(req.params.id), rid, req.body, req.user.id
    );
    res.json({ ingrediente: ing });
  } catch (err) {
    console.error('[posInventory] updateIngrediente error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error actualizando ingrediente' });
  }
}

/** DELETE /api/pos/inventory/ingredientes/:id — dueño/admin (soft) */
export async function deleteIngrediente(req, res) {
  try {
    if (!requireOwnerOrAdmin(req, res)) return;
    const rid = requireRest(req, res);
    if (!rid) return;
    const result = await posInventoryService.deleteIngrediente(
      Number(req.params.id), rid, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('[posInventory] deleteIngrediente error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error eliminando ingrediente' });
  }
}

// ========== BOM (receta) ==========

/** GET /api/pos/inventory/bom/producto/:productoId */
export async function getBOM(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const items = await posInventoryService.getBOM(Number(req.params.productoId), rid);
    res.json({ items });
  } catch (err) {
    console.error('[posInventory] getBOM error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error obteniendo receta' });
  }
}

/** PUT /api/pos/inventory/bom/producto/:productoId — dueño/admin */
export async function setBOM(req, res) {
  try {
    if (!requireOwnerOrAdmin(req, res)) return;
    const rid = requireRest(req, res);
    if (!rid) return;
    const items = await posInventoryService.setBOM(
      Number(req.params.productoId), rid, req.body.items || [], req.user.id
    );
    res.json({ items });
  } catch (err) {
    console.error('[posInventory] setBOM error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error guardando receta' });
  }
}

// ========== Kardex ==========

/** GET /api/pos/inventory/kardex?ingrediente_id&desde&hasta&tipo */
export async function listKardex(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const filters = {
      ingrediente_id: req.query.ingrediente_id,
      desde: req.query.desde,
      hasta: req.query.hasta,
      tipo: req.query.tipo,
    };
    const movimientos = await posInventoryService.listKardex(rid, filters);
    res.json({ movimientos });
  } catch (err) {
    console.error('[posInventory] listKardex error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando kardex' });
  }
}

// ========== Movimientos manuales ==========

/** POST /api/pos/inventory/movimientos
 *  Body: { ingrediente_id, tipo, cantidad, notas? }
 *  tipo ∈ {compra, merma, ajuste}. */
export async function crearMovimiento(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const { ingrediente_id, tipo, cantidad, notas } = req.body;
    if (!ingrediente_id) return res.status(400).json({ error: 'ingrediente_id es requerido' });
    if (!tipo) return res.status(400).json({ error: 'tipo es requerido' });
    if (cantidad === undefined || cantidad === null) {
      return res.status(400).json({ error: 'cantidad es requerida' });
    }
    const result = await posInventoryService.registrarMovimientoManual({
      restauranteId: rid,
      ingredienteId: Number(ingrediente_id),
      tipo,
      cantidad: Number(cantidad),
      notas,
      usuarioId: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('[posInventory] crearMovimiento error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error registrando movimiento' });
  }
}

// ========== Alertas ==========

/** GET /api/pos/inventory/alertas */
export async function listAlertas(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const alertas = await posInventoryService.listAlertas(rid);
    res.json({ alertas });
  } catch (err) {
    console.error('[posInventory] listAlertas error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando alertas' });
  }
}

export default {
  listIngredientes,
  getIngrediente,
  createIngrediente,
  updateIngrediente,
  deleteIngrediente,
  getBOM,
  setBOM,
  listKardex,
  crearMovimiento,
  listAlertas,
};
