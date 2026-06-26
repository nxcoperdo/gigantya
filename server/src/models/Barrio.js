import { query, queryOne } from '../config/database.js';

/**
 * Listar barrios. Si se pasa sector_id, filtra por sector.
 * Si soloActivos=true, excluye los desactivados.
 * Siempre devuelve el nombre del sector para que el frontend pueda mostrarlo.
 */
export async function getBarrios({ sector_id = null, soloActivos = true } = {}) {
  let sql = `
    SELECT b.id, b.nombre, b.sector_id, b.activo, b.creado_en,
           s.nombre AS sector_nombre, s.ciudad AS sector_ciudad
    FROM barrios b
    JOIN sectores s ON b.sector_id = s.id
  `;
  const params = [];
  const where = [];
  if (sector_id !== null && sector_id !== undefined) {
    where.push('b.sector_id = ?');
    params.push(sector_id);
  }
  if (soloActivos) {
    where.push('b.activo = 1');
    where.push('s.activo = 1');
  }
  if (where.length > 0) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.orden ASC, s.nombre ASC, b.nombre ASC';
  return query(sql, params);
}

export async function getBarrioById(id) {
  return queryOne(`
    SELECT b.*, s.nombre AS sector_nombre
    FROM barrios b
    JOIN sectores s ON b.sector_id = s.id
    WHERE b.id = ?
  `, [id]);
}

export async function createBarrio({ nombre, sector_id, activo = true }) {
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre del barrio es requerido');
  }
  if (!sector_id) {
    throw new Error('El sector es requerido');
  }
  const result = await query(
    'INSERT INTO barrios (nombre, sector_id, activo) VALUES (?, ?, ?)',
    [nombre.trim(), sector_id, activo ? 1 : 0]
  );
  return result.insertId;
}

export async function updateBarrio(id, { nombre, sector_id, activo }) {
  const fields = [];
  const values = [];
  if (nombre !== undefined)   { fields.push('nombre = ?');    values.push(nombre.trim()); }
  if (sector_id !== undefined) { fields.push('sector_id = ?'); values.push(sector_id); }
  if (activo !== undefined)    { fields.push('activo = ?');    values.push(activo ? 1 : 0); }
  if (fields.length === 0) return false;
  values.push(id);
  await query(`UPDATE barrios SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

export async function deleteBarrio(id) {
  await query('DELETE FROM barrios WHERE id = ?', [id]);
  return true;
}

export default { getBarrios, getBarrioById, createBarrio, updateBarrio, deleteBarrio };
