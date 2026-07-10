/**
 * Modelo `HomeMedia` (Fase 12b).
 *
 * El super-admin de GigantYA (rol `usuarios.tipo_usuario='admin'`)
 * elige UNO de los archivos estáticos commiteados en
 * `client/public/media/` para que sea el banner activo de la home.
 *
 * Decisiones:
 *   - `setActivo` es transaccional: primero desactiva TODOS los que
 *     estén activos, después activa el elegido. Esto garantiza
 *     exactamente 1 activo a la vez sin necesidad de un UNIQUE
 *     constraint (MySQL no soporta `UNIQUE WHERE`).
 *   - `listAll` devuelve TODAS las filas de la DB (que referencian
 *     archivos en client/public/media/). El controller admin cruza
 *     esta lista con `fs.readdir(...)` del filesystem para mostrar
 *     solo los que existen.
 *   - `count()` se mantiene por si más adelante queremos un soft cap
 *     desde la DB (no se usa en el flujo actual).
 *   - Sin timestamps "actualizado_en" porque la tabla no tiene
 *     edición, solo crear/activar.
 *
 * Fase 12b: la columna `archivo_path` se renombró a `archivo`
 * (solo el nombre del archivo, no el path completo). El path completo
 * es siempre `client/public/media/<archivo>` y la URL pública
 * es `/media/<archivo>` (servida por `app.use('/media', ...)` en app.js).
 */
import { query, queryOne, getConnection } from '../config/database.js';

/** Lista todas las filas de la DB (no chequea filesystem). */
export async function listAll() {
  return query(
    `SELECT id, nombre, archivo, tipo, mime, size_bytes, activo, subido_por, creado_en
       FROM home_media
      ORDER BY creado_en DESC, id DESC`
  );
}

/** Devuelve el archivo activo (visible en la home) o null. */
export async function getActivo() {
  return queryOne(
    `SELECT id, nombre, archivo, tipo, mime, size_bytes, activo, creado_en
       FROM home_media
      WHERE activo = 1
      LIMIT 1`
  );
}

/** Devuelve una fila por id, o null. */
export async function getById(id) {
  return queryOne(
    `SELECT id, nombre, archivo, tipo, mime, size_bytes, activo, subido_por, creado_en
       FROM home_media
      WHERE id = ?`,
    [Number(id)]
  );
}

/** Devuelve una fila por nombre de archivo, o null. */
export async function getByArchivo(archivo) {
  if (!archivo) return null;
  return queryOne(
    `SELECT id, nombre, archivo, tipo, mime, size_bytes, activo, subido_por, creado_en
       FROM home_media
      WHERE archivo = ?
      LIMIT 1`,
    [String(archivo)]
  );
}

/** Crea un nuevo registro. Devuelve el insertId. */
export async function create({ nombre, archivo, tipo, mime, size_bytes, subido_por }) {
  if (!nombre) throw new Error('nombre es requerido');
  if (!archivo) throw new Error('archivo es requerido');
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
       (nombre, archivo, tipo, mime, size_bytes, activo, subido_por)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      String(nombre).slice(0, 150),
      String(archivo).slice(0, 100),
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

/** Borra una fila por id. Devuelve affectedRows (0 o 1). */
export async function deleteById(id) {
  const r = await query(
    `DELETE FROM home_media WHERE id = ?`,
    [Number(id)]
  );
  return r.affectedRows;
}

/**
 * Upsert + activate por nombre de archivo (Fase 12b).
 *
 * Si la fila para `archivo` NO existe, la crea con `activo=1` y
 * desactiva cualquier otra activa. Si YA existe, hace el toggle
 * transaccional de siempre (lock pesimista sobre las filas con
 * activo=1, desactivar, activar la elegida).
 *
 * Todo dentro de una sola transacción para garantizar que no queden
 * 2 banners activos a la vez (MySQL no soporta UNIQUE WHERE).
 *
 * @returns {Promise<{ok: boolean, created?: boolean, alreadyActive?: boolean}>}
 *   - ok: true, created: true → la fila se creó recién
 *   - ok: true, created: false, alreadyActive: true → ya estaba activa
 *   - ok: true, created: false, alreadyActive: false → se activó recién
 *   - ok: false → si el archivo tiene nombre inválido
 */
export async function upsertAndActivate({ archivo, nombre, tipo, mime, size_bytes, subido_por }) {
  if (!archivo) throw new Error('archivo es requerido');
  if (!nombre) throw new Error('nombre es requerido');
  if (!['imagen', 'video'].includes(tipo)) {
    throw new Error(`tipo debe ser 'imagen' o 'video' (recibido: ${tipo})`);
  }
  if (!mime) throw new Error('mime es requerido');
  if (!Number.isFinite(Number(size_bytes)) || Number(size_bytes) <= 0) {
    throw new Error('size_bytes debe ser un número positivo');
  }
  if (!subido_por) throw new Error('subido_por es requerido');

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1) Buscar la fila por archivo.
    const [existingRows] = await connection.query(
      `SELECT id, activo FROM home_media WHERE archivo = ? FOR UPDATE`,
      [String(archivo)]
    );

    let targetId;
    let created = false;
    if (existingRows.length === 0) {
      // No existe → la creamos con activo=1.
      const [insertResult] = await connection.query(
        `INSERT INTO home_media
           (nombre, archivo, tipo, mime, size_bytes, activo, subido_por)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [
          String(nombre).slice(0, 150),
          String(archivo).slice(0, 100),
          tipo,
          String(mime).slice(0, 50),
          Number(size_bytes),
          Number(subido_por),
        ]
      );
      targetId = insertResult.insertId;
      created = true;
      // No hace falta desactivar otras porque la nueva ya entra activa=1
      // y las demás no se tocan. Pero por seguridad hacemos el lock
      // + desactivar para mantener la invariante "1 activo a la vez".
      const [currentActivos] = await connection.query(
        `SELECT id FROM home_media WHERE activo = 1 AND id <> ? FOR UPDATE`,
        [targetId]
      );
      for (const row of currentActivos) {
        await connection.query(
          `UPDATE home_media SET activo = 0 WHERE id = ?`,
          [row.id]
        );
      }
    } else {
      // Ya existe → toggle.
      const existing = existingRows[0];
      targetId = existing.id;
      if (Number(existing.activo) === 1) {
        await connection.commit();
        return { ok: true, created: false, alreadyActive: true };
      }
      // Lock sobre las filas actualmente activas (excluyendo esta).
      const [currentActivos] = await connection.query(
        `SELECT id FROM home_media WHERE activo = 1 AND id <> ? FOR UPDATE`,
        [targetId]
      );
      for (const row of currentActivos) {
        await connection.query(
          `UPDATE home_media SET activo = 0 WHERE id = ?`,
          [row.id]
        );
      }
      // Activar la elegida.
      await connection.query(
        `UPDATE home_media SET activo = 1 WHERE id = ?`,
        [targetId]
      );
    }

    await connection.commit();
    return { ok: true, created, alreadyActive: false };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Total de filas en la DB (para soft cap si se quiere reintroducir). */
export async function count() {
  const row = await queryOne(`SELECT COUNT(*) AS total FROM home_media`);
  return Number(row?.total || 0);
}

export default {
  listAll,
  getActivo,
  getById,
  getByArchivo,
  create,
  setActivo,
  upsertAndActivate,
  deleteById,
  count,
};
