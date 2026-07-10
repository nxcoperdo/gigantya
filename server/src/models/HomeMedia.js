/**
 * Modelo `HomeMedia` (Fase 12).
 *
 * El super-admin de GigantYA (rol `usuarios.tipo_usuario='admin'`) puede
 * subir varios archivos de media (imagen o video) a un "gestor de
 * banners de la home". Elige UNO como activo. La home pública lee el
 * activo con `getActivo()` y lo renderiza.
 *
 * Decisiones:
 *   - `setActivo` es transaccional: primero desactiva TODOS los que
 *     estén activos, después activa el elegido. Esto garantiza
 *     exactamente 1 activo a la vez sin necesidad de un UNIQUE
 *     constraint (MySQL no soporta `UNIQUE WHERE`).
 *   - `deleteById` NO chequea si es el activo: el controller lo hace
 *     y devuelve 400. Acá solo borra la fila y devuelve affectedRows.
 *   - `count()` se usa en el controller de upload para soft-cap.
 *   - Sin timestamps "actualizado_en" porque la tabla no tiene
 *     edición, solo crear/activar/borrar.
 */
import { query, queryOne, getConnection } from '../config/database.js';

/** Lista todos los archivos subidos (ordenados por más reciente). */
export async function listAll() {
  return query(
    `SELECT id, nombre, archivo_path, tipo, mime, size_bytes, activo, subido_por, creado_en
       FROM home_media
      ORDER BY creado_en DESC, id DESC`
  );
}

/** Devuelve el archivo activo (visible en la home) o null. */
export async function getActivo() {
  return queryOne(
    `SELECT id, nombre, archivo_path, tipo, mime, size_bytes, activo, creado_en
       FROM home_media
      WHERE activo = 1
      LIMIT 1`
  );
}

/** Devuelve un archivo por id, o null. */
export async function getById(id) {
  return queryOne(
    `SELECT id, nombre, archivo_path, tipo, mime, size_bytes, activo, subido_por, creado_en
       FROM home_media
      WHERE id = ?`,
    [Number(id)]
  );
}

/** Crea un nuevo registro. Devuelve el insertId. */
export async function create({ nombre, archivo_path, tipo, mime, size_bytes, subido_por }) {
  if (!nombre) throw new Error('nombre es requerido');
  if (!archivo_path) throw new Error('archivo_path es requerido');
  if (!['imagen', 'video'].includes(tipo)) {
    throw new Error(`tipo debe ser 'imagen' o 'video' (recibido: ${tipo})`);
  }
  if (!mime) throw new Error('mime es requerido');
  if (!Number.isFinite(Number(size_bytes)) || Number(size_bytes) <= 0) {
    throw new Error('size_bytes debe ser un número positivo');
  }
  if (!subido_por) throw new Error('subido_por es requerido');

  const r = await query(
    `INSERT INTO home_media
       (nombre, archivo_path, tipo, mime, size_bytes, activo, subido_por)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      String(nombre).slice(0, 150),
      String(archivo_path).slice(0, 255),
      tipo,
      String(mime).slice(0, 50),
      Number(size_bytes),
      Number(subido_por),
    ]
  );
  return r.insertId;
}

/**
 * Marca un archivo como activo y desactiva cualquier otro que estuviera
 * activo. Transaccional: si algo falla, no queda estado inconsistente.
 *
 * Decisión: usa `SELECT ... FOR UPDATE` sobre las filas con `activo=1`
 * para evitar race condition si dos admins activan archivos distintos
 * a la vez (lock pessimista hasta el commit).
 *
 * @param {number} id - id del archivo a activar
 * @returns {Promise<{ok: boolean, alreadyActive?: boolean}>}
 *   - `ok: true, alreadyActive: true` si ya estaba activo (idempotente).
 *   - `ok: true` si se activó recién.
 *   - `ok: false` si el id no existe.
 */
export async function setActivo(id) {
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) {
    throw new Error('id debe ser un entero positivo');
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Verificar que el id existe.
    const [existsRows] = await connection.query(
      `SELECT id, activo FROM home_media WHERE id = ?`,
      [numId]
    );
    if (existsRows.length === 0) {
      await connection.rollback();
      return { ok: false };
    }
    const target = existsRows[0];
    if (Number(target.activo) === 1) {
      // Ya estaba activo, no hacemos nada (idempotente).
      await connection.commit();
      return { ok: true, alreadyActive: true };
    }

    // 2) Lock sobre las filas actualmente activas (puede haber 0 o 1).
    const [currentActivos] = await connection.query(
      `SELECT id FROM home_media WHERE activo = 1 FOR UPDATE`
    );

    // 3) Desactivar todas las activas (en la práctica es 0 o 1 fila,
    //    pero el loop es defensivo por si en el futuro el constraint
    //    se relajara).
    for (const row of currentActivos) {
      await connection.query(
        `UPDATE home_media SET activo = 0 WHERE id = ?`,
        [row.id]
      );
    }

    // 4) Activar la elegida.
    await connection.query(
      `UPDATE home_media SET activo = 1 WHERE id = ?`,
      [numId]
    );

    await connection.commit();
    return { ok: true, alreadyActive: false };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Borra un archivo por id. Devuelve affectedRows (0 o 1). */
export async function deleteById(id) {
  const r = await query(
    `DELETE FROM home_media WHERE id = ?`,
    [Number(id)]
  );
  return r.affectedRows;
}

/** Total de archivos subidos (para soft cap en el controller de upload). */
export async function count() {
  const row = await queryOne(`SELECT COUNT(*) AS total FROM home_media`);
  return Number(row?.total || 0);
}

export default {
  listAll,
  getActivo,
  getById,
  create,
  setActivo,
  deleteById,
  count,
};
