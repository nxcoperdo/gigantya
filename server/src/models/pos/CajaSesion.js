/**
 * Modelo `CajaSesion` (Fase 5).
 *
 * Una "sesión de caja" representa la apertura de la registradora por un
 * cajero, durante un turno. Mientras `estado='abierta'`, el cajero
 * puede registrar pagos (referenciando el `caja_sesion_id`). Al cerrar,
 * se persiste el monto esperado (apertura + Σ pagos en efectivo) vs
 * el conteo real y la diferencia.
 *
 * Reglas:
 *   - Un cajero puede tener a lo sumo UNA sesión abierta a la vez
 *     (validado en el service con un `SELECT … FOR UPDATE`).
 *   - Al cerrar, el UPDATE lleva `estado='cerrada'` y solo afecta
 *     filas en estado 'abierta' (chequeo de affectedRows para evitar
 *     doble-cierre en condiciones de carrera).
 *   - `desglose_billetes` es JSON con la forma:
 *       { "50000": 2, "20000": 3, ... }    (cantidad de billetes/monedas)
 */
import { query, queryOne } from '../../config/database.js';

/** Crea una nueva sesión (la previa del mismo cajero debe estar cerrada). */
export async function createSesion({ restaurante_id, usuario_id, monto_apertura = 0 }) {
  if (!restaurante_id) throw new Error('restaurante_id es requerido');
  if (!usuario_id) throw new Error('usuario_id es requerido');
  const r = await query(
    `INSERT INTO cajas_sesiones
       (restaurante_id, usuario_id, monto_apertura, estado, abierta_en)
     VALUES (?, ?, ?, 'abierta', NOW())`,
    [Number(restaurante_id), Number(usuario_id), Number(monto_apertura).toFixed(2)]
  );
  return r.insertId;
}

/** Devuelve la sesión abierta del cajero, o null. */
export async function getOpenSesionByUser(usuarioId) {
  const row = await queryOne(
    `SELECT * FROM cajas_sesiones
      WHERE usuario_id = ? AND estado = 'abierta'
      ORDER BY abierta_en DESC LIMIT 1`,
    [Number(usuarioId)]
  );
  return row || null;
}

/** Devuelve la sesión abierta del restaurante (la más reciente, sea del
 *  cajero que sea). Útil para el dashboard de la cocina. */
export async function getOpenSesionByRestaurante(restauranteId) {
  const row = await queryOne(
    `SELECT cs.*, u.nombre AS cajero_nombre
       FROM cajas_sesiones cs
       LEFT JOIN usuarios u ON u.id = cs.usuario_id
      WHERE cs.restaurante_id = ? AND cs.estado = 'abierta'
      ORDER BY cs.abierta_en DESC LIMIT 1`,
    [Number(restauranteId)]
  );
  return row || null;
}

export async function getSesionById(id) {
  const row = await queryOne(
    `SELECT cs.*, u.nombre AS cajero_nombre
       FROM cajas_sesiones cs
       LEFT JOIN usuarios u ON u.id = cs.usuario_id
      WHERE cs.id = ?`,
    [Number(id)]
  );
  return row || null;
}

/** Cierra una sesión (idempotente via `affectedRows`).
 *  Devuelve true si cerró, false si ya estaba cerrada o no existe. */
export async function closeSesion(id, { monto_cierre_esperado, monto_cierre_real, desglose_billetes, notas_cierre }) {
  const diferencia = (Number(monto_cierre_real) - Number(monto_cierre_esperado)).toFixed(2);
  const r = await query(
    `UPDATE cajas_sesiones
        SET estado = 'cerrada',
            monto_cierre_esperado = ?,
            monto_cierre_real = ?,
            diferencia = ?,
            desglose_billetes = ?,
            notas_cierre = ?,
            cerrada_en = NOW()
      WHERE id = ? AND estado = 'abierta'`,
    [
      Number(monto_cierre_esperado).toFixed(2),
      Number(monto_cierre_real).toFixed(2),
      diferencia,
      desglose_billetes ? JSON.stringify(desglose_billetes) : null,
      notas_cierre || null,
      Number(id),
    ]
  );
  return r.affectedRows === 1;
}

export default {
  createSesion,
  getOpenSesionByUser,
  getOpenSesionByRestaurante,
  getSesionById,
  closeSesion,
};
