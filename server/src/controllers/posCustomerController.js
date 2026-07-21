/**
 * Controller de Clientes POS (Fase 3).
 *
 * Endpoints:
 *   POST /api/pos/customers      crea walk-in (idempotente por teléfono)
 *   GET  /api/pos/customers      busca por teléfono
 *
 * El "walk-in" es un `usuarios` con `tipo_usuario='cliente'`. Si el
 * teléfono ya existe, devolvemos el usuario existente en vez de crear
 * uno nuevo (evita duplicar filas con cada pedido).
 *
 * NOTA: la unicidad es a nivel de la tabla `usuarios`, que ya tiene UNIQUE
 * KEY sobre `email`. Como el email es fake (`walkin_<ts>@local.gigantya`)
 * el constraint de email no previene duplicados por teléfono. Por eso
 * hacemos la verificación explícita aquí antes de INSERTAR.
 */
import { query } from '../config/database.js';

/** POST /api/pos/customers */
export async function createPosCustomer(req, res) {
  try {
    const { nombre, telefono } = req.body || {};
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'nombre y telefono son requeridos' });
    }
    // Si ya existe un usuario con este teléfono, devolverlo.
    // query() ya devuelve el array de filas (NO un wrapper tipo
    // [rows, fields]); el unwrap se hace en database.js. Asignación
    // directa, no destructurar `[existing]`.
    const existing = await query(
      `SELECT id, nombre, telefono, email
         FROM usuarios
        WHERE telefono = ? AND estado = 'activo'
        LIMIT 1`,
      [telefono]
    );
    if (existing) {
      return res.status(200).json({ cliente: existing[0], reused: true });
    }
    // Crear walk-in.
    // INSERT devuelve un ResultSetHeader ({ insertId, affectedRows, ... }),
    // no un array de filas. Hay que tomarlo directo, no destructurar.
    const stamp = Date.now();
    const email = `walkin_${stamp}_${Math.random().toString(36).slice(2, 8)}@local.gigantya`;
    const randomHash = `walkin_no_login_${stamp}_${Math.random().toString(36).slice(2, 16)}`;
    const r = await query(
      `INSERT INTO usuarios (nombre, email, contrasena_hash, telefono, tipo_usuario, estado, creado_en)
       VALUES (?, ?, ?, ?, 'cliente', 'activo', NOW())`,
      [nombre, email, randomHash, telefono]
    );
    const cliente = await queryOne(
      `SELECT id, nombre, telefono, email FROM usuarios WHERE id = ?`,
      [r.insertId]
    );
    res.status(201).json({ cliente, reused: false });
  } catch (err) {
    console.error('[posCustomer] create error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error creando walk-in' });
  }
}

/** GET /api/pos/customers?telefono=...
 *
 * Busca clientes (usuarios con tipo_usuario='cliente') por LIKE sobre
 * el teléfono. Devuelve un array de hasta 20 resultados ordenados por id
 * descendente (más recientes primero).
 *
 * NOTA: query() ya devuelve el array de filas directamente (database.js
 * hace el unwrap del `[rows, fields]` de mysql2). No desestructurar
 * `const [rows] = await query(...)` — eso daría `rows = undefined`.
 */
export async function searchPosCustomers(req, res) {
  try {
    const { telefono } = req.query;
    if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
      return res.status(400).json({ error: 'telefono (query) es requerido' });
    }
    const clientes = await query(
      `SELECT id, nombre, telefono, email
         FROM usuarios
        WHERE tipo_usuario = 'cliente'
          AND estado = 'activo'
          AND telefono LIKE ?
        ORDER BY id DESC
        LIMIT 20`,
      [`%${telefono.trim()}%`]
    );
    res.json({ clientes });
  } catch (err) {
    console.error('[posCustomer] search error:', err);
    res.status(500).json({ error: err.message || 'Error buscando clientes' });
  }
}

export default { createPosCustomer, searchPosCustomers };
