import { query } from '../config/database.js';

/**
 * Sugerencias de restaurantes para el autocomplete de la home del cliente.
 *
 * Devuelve hasta `limit` locales cuyo `nombre` matchea el query libre
 * (LIKE %q%) respetando los mismos filtros que el feed público:
 *   - estado='activo', aprobado=1
 *   - plan vigente (basico no vence, premium/profesional/golden_plus deben
 *     tener fecha_vencimiento_plan >= NOW() o NULL)
 *   - tipo_negocio opcional (whitelist que matchea el toggle exclusivo de
 *     la home: 'restaurante' | 'comida_rapida' | 'mercado' |
 *     'panaderia_pasteleria')
 *
 * Diferencias con `Restaurant.getRestaurants` (el feed):
 *   - Query más liviana: solo proyectamos los campos que muestra el
 *     dropdown (no necesitamos descripcion, banner_url, etc.).
 *   - El join con `calificaciones` está dentro de la misma SELECT y se
 *     filtra por GROUP BY para que el conteo/AVG sea correcto, igual que
 *     el feed.
 *   - No filtra por `ofrece_domicilio` ni por `categoria` (el dropdown es
 *     búsqueda libre; los filtros segmentan el feed pero no la búsqueda).
 *
 * Proyecta: id, nombre, imagen_url, calificacion_promedio,
 * total_calificaciones, ciudad. Suficiente para renderizar la fila del
 * dropdown con thumbnail, nombre, rating y ciudad.
 */
export async function suggestRestaurants({ q, tipo_negocio = null, limit = 5 }) {
  let sql = `
    SELECT
      r.id,
      r.nombre,
      r.imagen_url,
      r.ciudad,
      COALESCE(AVG(c.calificacion), 0)   AS calificacion_promedio,
      COUNT(c.id)                         AS total_calificaciones
    FROM restaurantes r
    JOIN usuarios u ON r.usuario_id = u.id
    LEFT JOIN calificaciones c ON c.restaurante_id = r.id
    WHERE r.estado = 'activo'
      AND r.aprobado = 1
      AND u.estado = 'activo'
      AND (r.plan = 'basico' OR r.fecha_vencimiento_plan IS NULL OR r.fecha_vencimiento_plan >= NOW())
      AND r.nombre LIKE ?
  `;
  const params = [`%${q}%`];

  if (tipo_negocio === 'comida_rapida') {
    sql += ' AND r.es_comida_rapida = 1';
  } else if (tipo_negocio === 'mercado') {
    sql += ' AND r.es_mercado_abarrotes = 1';
  } else if (tipo_negocio === 'restaurante') {
    sql += ' AND r.es_restaurante = 1';
  } else if (tipo_negocio === 'panaderia_pasteleria') {
    sql += ' AND r.es_panaderia_pasteleria = 1';
  }
  // tipo_negocio null/undefined/'todos' → no filtra por nicho

  // Mismo orden que el feed público. El Free va explícito al final porque
  // sin entrada en FIELD() MySQL le asigna 0 y en orden ASC lo pone al
  // principio (mismo gotcha que en Restaurant.js).
  sql += ' GROUP BY r.id ORDER BY FIELD(r.plan, "golden_plus", "premium", "profesional", "basico", "free"), r.nombre ASC LIMIT ?';
  params.push(Number(limit));

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error en suggestRestaurants: ${error.message}`);
  }
}

/**
 * Sugerencias de productos para el autocomplete de la home del cliente.
 *
 * Devuelve hasta `limit` productos cuyo nombre, descripcion o nombre del
 * restaurante matchea el query libre. Mismos filtros de estado/aprobación
 * que el feed público, con la diferencia de que:
 *   - Buscamos en el restaurante también (un usuario que tipea "pizza
 *     del rancho" debería encontrar productos del "Rancho Pizza").
 *   - No filtramos por `categoria` (la búsqueda es libre).
 *   - Proyectamos lo mínimo para el dropdown.
 *
 * Proyecta: id, nombre, precio, imagen_url, categoria_nombre,
 * restaurante_id, restaurante_nombre. El dropdown usa
 * `restaurante_id` para navegar a `/restaurant/:id` cuando el usuario
 * clickea un producto.
 */
export async function suggestProducts({ q, tipo_negocio = null, limit = 5 }) {
  let sql = `
    SELECT
      p.id,
      p.nombre,
      p.precio,
      p.imagen_url,
      c.nombre  AS categoria_nombre,
      r.id      AS restaurante_id,
      r.nombre  AS restaurante_nombre
    FROM productos p
    JOIN restaurantes r ON p.restaurante_id = r.id
    JOIN usuarios     u ON r.usuario_id = u.id
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.estado = 'activo'
      AND r.estado = 'activo'
      AND r.aprobado = 1
      AND u.estado = 'activo'
      AND (r.plan = 'basico' OR r.fecha_vencimiento_plan IS NULL OR r.fecha_vencimiento_plan >= NOW())
      AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR r.nombre LIKE ?)
  `;
  const like = `%${q}%`;
  const params = [like, like, like];

  if (tipo_negocio === 'comida_rapida') {
    sql += ' AND r.es_comida_rapida = 1';
  } else if (tipo_negocio === 'mercado') {
    sql += ' AND r.es_mercado_abarrotes = 1';
  } else if (tipo_negocio === 'restaurante') {
    sql += ' AND r.es_restaurante = 1';
  } else if (tipo_negocio === 'panaderia_pasteleria') {
    sql += ' AND r.es_panaderia_pasteleria = 1';
  }

  sql += ' ORDER BY FIELD(r.plan, "golden_plus", "premium", "profesional", "basico", "free"), p.nombre ASC LIMIT ?';
  params.push(Number(limit));

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error en suggestProducts: ${error.message}`);
  }
}

export default { suggestRestaurants, suggestProducts };
