/**
 * Controller de Mesas (POS Fase 2).
 *
 * Endpoints:
 *   GET    /api/pos/tables            listar mesas activas del restaurante
 *   GET    /api/pos/tables/:id        detalle
 *   POST   /api/pos/tables            crear (restaurante owner / admin)
 *   PUT    /api/pos/tables/:id        actualizar nombre, capacidad, posición
 *   PUT    /api/pos/tables/:id/status cambiar estado manualmente
 *   DELETE /api/pos/tables/:id        soft-delete (estado = mantenimiento)
 *
 * Autorización:
 *   - GET, PUT (status), DELETE: cualquier staff del restaurante
 *     (cajero/mesero/cocina/restaurante/admin) que pertenezca al local.
 *   - POST, PUT (datos): solo dueño o admin.
 *
 * `req.user.restaurante_id` se hidrata por `verifyToken` (módulo authMiddleware).
 * En el caso de `admin` (sin restaurante_id), permitimos pasar `?restaurante_id=X`
 * por query/body — esto habilita al admin a operar cualquier restaurante.
 */
import * as Mesa from '../models/pos/Mesa.js';
import { emitToRestaurant } from '../socket/socketHandler.js';

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
    res.status(400).json({ error: 'No se pudo determinar el restaurante. Si sos admin, pasá ?restaurante_id=X' });
    return null;
  }
  return rid;
}

/** GET /api/pos/tables */
export async function listTables(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const mesas = await Mesa.listByRestaurante(rid);
    res.json({ mesas });
  } catch (err) {
    console.error('[posTable] list error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error listando mesas' });
  }
}

/** GET /api/pos/tables/:id */
export async function getTable(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const mesa = await Mesa.getById(Number(req.params.id), rid);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json({ mesa });
  } catch (err) {
    console.error('[posTable] get error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error obteniendo mesa' });
  }
}

/** POST /api/pos/tables — solo dueño/admin */
export async function createTable(req, res) {
  try {
    if (!['restaurante', 'admin'].includes(req.user.tipo_usuario)) {
      return res.status(403).json({ error: 'Solo el dueño puede crear mesas' });
    }
    const rid = requireRest(req, res);
    if (!rid) return;
    const mesa = await Mesa.create(rid, req.body);
    // Notificar al restaurante por socket
    emitToRestaurant(rid, 'pos:tables_updated', { mesa });
    res.status(201).json({ mesa });
  } catch (err) {
    console.error('[posTable] create error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error creando mesa' });
  }
}

/** PUT /api/pos/tables/:id — solo dueño/admin */
export async function updateTable(req, res) {
  try {
    if (!['restaurante', 'admin'].includes(req.user.tipo_usuario)) {
      return res.status(403).json({ error: 'Solo el dueño puede modificar mesas' });
    }
    const rid = requireRest(req, res);
    if (!rid) return;
    const mesa = await Mesa.update(Number(req.params.id), rid, req.body);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
    emitToRestaurant(rid, 'pos:tables_updated', { mesa });
    res.json({ mesa });
  } catch (err) {
    console.error('[posTable] update error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error actualizando mesa' });
  }
}

/** PUT /api/pos/tables/:id/status — cualquier staff del restaurante */
export async function setTableStatus(req, res) {
  try {
    const rid = requireRest(req, res);
    if (!rid) return;
    const { estado } = req.body;
    const ok = await Mesa.setStatus(Number(req.params.id), rid, estado);
    if (!ok) return res.status(404).json({ error: 'Mesa no encontrada' });
    const mesa = await Mesa.getById(Number(req.params.id), rid);
    emitToRestaurant(rid, 'pos:table_status_changed', { mesa });
    res.json({ mesa });
  } catch (err) {
    console.error('[posTable] setStatus error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error cambiando estado' });
  }
}

/** DELETE /api/pos/tables/:id — solo dueño/admin */
export async function deleteTable(req, res) {
  try {
    if (!['restaurante', 'admin'].includes(req.user.tipo_usuario)) {
      return res.status(403).json({ error: 'Solo el dueño puede eliminar mesas' });
    }
    const rid = requireRest(req, res);
    if (!rid) return;
    const ok = await Mesa.softDelete(Number(req.params.id), rid);
    if (!ok) return res.status(404).json({ error: 'Mesa no encontrada' });
    emitToRestaurant(rid, 'pos:tables_updated', { mesa_id: Number(req.params.id), deleted: true });
    res.json({ mensaje: 'Mesa eliminada' });
  } catch (err) {
    console.error('[posTable] delete error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error eliminando mesa' });
  }
}

export default {
  listTables,
  getTable,
  createTable,
  updateTable,
  setTableStatus,
  deleteTable,
};
