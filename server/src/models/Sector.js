import { query, queryOne } from '../config/database.js';

/**
 * Listar sectores.
 * @param {Object} opts - { soloActivos: boolean = true }
 */
export async function getSectores({ soloActivos = true } = {}) {
  let sql = 'SELECT * FROM sectores';
  if (soloActivos) sql += ' WHERE activo = 1';
  sql += ' ORDER BY orden ASC, nombre ASC';
  return query(sql);
}

export async function getSectorById(id) {
  return queryOne('SELECT * FROM sectores WHERE id = ?', [id]);
}

export async function createSector({ nombre, ciudad = 'Gigante, Huila', orden = 0, activo = true }) {
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre del sector es requerido');
  }
  const result = await query(
    'INSERT INTO sectores (nombre, ciudad, orden, activo) VALUES (?, ?, ?, ?)',
    [nombre.trim(), ciudad, orden, activo ? 1 : 0]
  );
  return result.insertId;
}

export async function updateSector(id, { nombre, ciudad, orden, activo }) {
  const fields = [];
  const values = [];
  if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre.trim()); }
  if (ciudad !== undefined) { fields.push('ciudad = ?'); values.push(ciudad); }
  if (orden !== undefined)  { fields.push('orden = ?');  values.push(orden); }
  if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
  if (fields.length === 0) return false;
  values.push(id);
  await query(`UPDATE sectores SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

export async function deleteSector(id) {
  // ON DELETE CASCADE borra los barrios y los registros de restaurante_envios_sector asociados
  await query('DELETE FROM sectores WHERE id = ?', [id]);
  return true;
}

export default { getSectores, getSectorById, createSector, updateSector, deleteSector };
