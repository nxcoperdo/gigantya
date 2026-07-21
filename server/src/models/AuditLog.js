import { query, queryOne } from '../config/database.js';

/**
 * Crear un log de auditoría.
 *
 * Pensado para llamarse desde `recordAudit()` en el controller, justo
 * después de una mutación exitosa. No propaga errores hacia el caller
 * (la auditoría NUNCA debe romper la acción principal); el caller
 * (recordAudit) ya la envuelve en try/catch.
 *
 * @param {object} logData
 * @param {number} logData.admin_id        - id del admin que hizo la acción
 * @param {string} logData.accion          - ej: 'restaurante.approve', 'comprobante.reject'
 * @param {string} logData.entidad_tipo    - ej: 'restaurante' | 'usuario' | 'comprobante' | 'plan' | 'modalidad'
 * @param {number|null} logData.entidad_id - id del recurso afectado (nullable)
 * @param {object|null} logData.datos_antes
 * @param {object|null} logData.datos_despues
 * @param {string|null} logData.ip
 * @param {string|null} logData.user_agent
 *
 * @returns {Promise<number>} id del log insertado
 */
export async function createLog(logData) {
  const {
    admin_id,
    accion,
    entidad_tipo,
    entidad_id = null,
    datos_antes = null,
    datos_despues = null,
    ip = null,
    user_agent = null,
  } = logData;

  const sql = `
    INSERT INTO audit_logs
      (admin_id, accion, entidad_tipo, entidad_id,
       datos_antes, datos_despues, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const result = await query(sql, [
      admin_id,
      accion,
      entidad_tipo,
      entidad_id,
      datos_antes === null ? null : JSON.stringify(datos_antes),
      datos_despues === null ? null : JSON.stringify(datos_despues),
      ip,
      user_agent,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando log de auditoría: ${error.message}`);
  }
}

/**
 * Listar logs con filtros opcionales y paginación.
 *
 * Devuelve { logs, total } donde `total` es el conteo SIN aplicar
 * LIMIT/OFFSET, para que el frontend pueda paginar correctamente.
 *
 * @param {object} filters
 * @param {number} [filters.admin_id]
 * @param {string} [filters.accion]
 * @param {string} [filters.entidad_tipo]
 * @param {number} [filters.entidad_id]
 * @param {string|Date} [filters.desde] - ISO string o Date
 * @param {string|Date} [filters.hasta] - ISO string o Date
 * @param {number} [filters.limit=100]
 * @param {number} [filters.offset=0]
 */
export async function getLogs(filters = {}) {
  const {
    admin_id,
    accion,
    entidad_tipo,
    entidad_id,
    desde,
    hasta,
    limit = 100,
    offset = 0,
  } = filters;

  // Conteos separados (sin LIMIT/OFFSET) para la paginación.
  let countSql = 'SELECT COUNT(*) AS total FROM audit_logs WHERE 1=1';
  let dataSql = `
    SELECT al.*,
           u.nombre AS admin_nombre,
           u.email  AS admin_email
      FROM audit_logs al
      LEFT JOIN usuarios u ON al.admin_id = u.id
     WHERE 1=1
  `;
  const params = [];

  if (admin_id != null) {
    countSql += ' AND admin_id = ?';
    dataSql += ' AND al.admin_id = ?';
    params.push(admin_id);
  }
  if (accion) {
    countSql += ' AND accion = ?';
    dataSql += ' AND al.accion = ?';
    params.push(accion);
  }
  if (entidad_tipo) {
    countSql += ' AND entidad_tipo = ?';
    dataSql += ' AND al.entidad_tipo = ?';
    params.push(entidad_tipo);
  }
  if (entidad_id != null) {
    countSql += ' AND entidad_id = ?';
    dataSql += ' AND al.entidad_id = ?';
    params.push(entidad_id);
  }
  if (desde) {
    countSql += ' AND creado_en >= ?';
    dataSql += ' AND al.creado_en >= ?';
    params.push(desde);
  }
  if (hasta) {
    countSql += ' AND creado_en <= ?';
    dataSql += ' AND al.creado_en <= ?';
    params.push(hasta);
  }

  dataSql += ' ORDER BY al.creado_en DESC LIMIT ? OFFSET ?';
  // Clonamos params para no contaminar el conteo.
  const dataParams = [...params, Number(limit), Number(offset)];

  const [countRow, logs] = await Promise.all([
    queryOne(countSql, params),
    query(dataSql, dataParams),
  ]);

  // mysql2 devuelve JSON como string en algunas versiones; el controller
  // es responsable de hacer JSON.parse si fuera string. Aquí lo dejamos
  // crudo para que el frontend reciba la forma que la DB le da.
  return { logs, total: countRow?.total || 0 };
}

/**
 * Logs de una entidad específica (ej: todos los cambios de un local).
 * Útil para la pestaña "Actividad" del modal de detalle de usuario.
 *
 * @param {string} entidad_tipo
 * @param {number} entidad_id
 * @param {number} [limit=50]
 */
export async function getLogsByEntity(entidad_tipo, entidad_id, limit = 50) {
  const sql = `
    SELECT al.*,
           u.nombre AS admin_nombre,
           u.email  AS admin_email
      FROM audit_logs al
      LEFT JOIN usuarios u ON al.admin_id = u.id
     WHERE al.entidad_tipo = ?
       AND al.entidad_id = ?
     ORDER BY al.creado_en DESC
     LIMIT ?
  `;
  return query(sql, [entidad_tipo, entidad_id, Number(limit)]);
}

export default {
  createLog,
  getLogs,
  getLogsByEntity,
};
