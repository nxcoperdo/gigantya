import * as MenuSemanal from '../models/MenuSemanal.js';
import * as RestaurantModel from '../models/Restaurant.js';
import * as ProductModel from '../models/Product.js';
import { query, queryOne } from '../config/database.js';

const TIPOS_COMIDA = ['desayuno', 'almuerzo'];

// custom_config puede venir de mysql2 como objeto ya parseado o como string
// (según versión/driver). Normalizamos a objeto.
function parseConfig(custom_config) {
  if (!custom_config) return {};
  if (typeof custom_config === 'object') return custom_config;
  try { return JSON.parse(custom_config); } catch { return {}; }
}

// Valida "HH:MM" (24h). Devuelve el string normalizado o null.
function normalizeHora(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

function getHorarios(custom_config) {
  const cfg = parseConfig(custom_config);
  const h = cfg.menu_dia_horarios || {};
  const pick = (o) => ({
    desde: normalizeHora(o?.desde),
    hasta: normalizeHora(o?.hasta),
  });
  return { desayuno: pick(h.desayuno), almuerzo: pick(h.almuerzo) };
}

/* ============================ DUEÑO ============================ */

/**
 * GET /api/restaurants/me/menu-dia
 * Devuelve la plantilla semanal completa, los combos disponibles para elegir
 * y las franjas horarias configuradas.
 */
export async function getWeeklyMenu(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'No tenés un local asociado' });

    const [weekly, combos] = await Promise.all([
      MenuSemanal.getWeeklyByRestaurant(restaurante.id),
      MenuSemanal.listCombosByRestaurant(restaurante.id),
    ]);

    res.json({
      weekly,
      combos,
      horarios: getHorarios(restaurante.custom_config),
    });
  } catch (error) {
    console.error('Error obteniendo menú semanal:', error);
    res.status(500).json({ error: 'Error obteniendo el menú del día', detalles: error.message });
  }
}

/**
 * PUT /api/restaurants/me/menu-dia/celda
 * Body: { tipo_comida, dia_semana, producto_id, activo? }
 * Asigna un combo a una celda (día + comida).
 */
export async function setMenuCell(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'No tenés un local asociado' });

    const { tipo_comida, producto_id, activo } = req.body;
    const dia_semana = Number(req.body.dia_semana);

    if (!TIPOS_COMIDA.includes(tipo_comida)) {
      return res.status(400).json({ error: "tipo_comida debe ser 'desayuno' o 'almuerzo'" });
    }
    if (!Number.isInteger(dia_semana) || dia_semana < 1 || dia_semana > 7) {
      return res.status(400).json({ error: 'dia_semana debe ser un entero de 1 (Lunes) a 7 (Domingo)' });
    }

    // El producto debe existir, ser de este local y ser un combo del día.
    const producto = await ProductModel.getProductById(producto_id);
    if (!producto || producto.restaurante_id !== restaurante.id) {
      return res.status(404).json({ error: 'El combo seleccionado no existe o no es de tu local' });
    }
    if (!producto.es_menu_dia) {
      return res.status(400).json({ error: 'Ese producto no es un combo del menú del día' });
    }

    await MenuSemanal.upsertCell({
      restaurante_id: restaurante.id,
      tipo_comida,
      dia_semana,
      producto_id,
      activo: activo === undefined ? true : !!activo,
    });

    res.json({ mensaje: 'Menú del día actualizado' });
  } catch (error) {
    console.error('Error guardando celda del menú:', error);
    res.status(500).json({ error: 'Error guardando el menú del día', detalles: error.message });
  }
}

/**
 * DELETE /api/restaurants/me/menu-dia/celda
 * Body/query: { tipo_comida, dia_semana }
 */
export async function deleteMenuCell(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'No tenés un local asociado' });

    const tipo_comida = req.body.tipo_comida || req.query.tipo_comida;
    const dia_semana = Number(req.body.dia_semana ?? req.query.dia_semana);

    if (!TIPOS_COMIDA.includes(tipo_comida) || !Number.isInteger(dia_semana)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    await MenuSemanal.deleteCell({ restaurante_id: restaurante.id, tipo_comida, dia_semana });
    res.json({ mensaje: 'Celda eliminada' });
  } catch (error) {
    console.error('Error eliminando celda del menú:', error);
    res.status(500).json({ error: 'Error eliminando la celda', detalles: error.message });
  }
}

/**
 * PUT /api/restaurants/me/menu-dia/horarios
 * Body: { desayuno: {desde,hasta}, almuerzo: {desde,hasta} }
 * Guarda las franjas en restaurantes.custom_config.menu_dia_horarios.
 */
export async function setHorarios(req, res) {
  try {
    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (!restaurante) return res.status(404).json({ error: 'No tenés un local asociado' });

    const body = req.body || {};
    const horarios = {
      desayuno: { desde: normalizeHora(body.desayuno?.desde), hasta: normalizeHora(body.desayuno?.hasta) },
      almuerzo: { desde: normalizeHora(body.almuerzo?.desde), hasta: normalizeHora(body.almuerzo?.hasta) },
    };

    // JSON_SET sobre el custom_config existente (o '{}' si es NULL).
    await query(
      `UPDATE restaurantes
          SET custom_config = JSON_SET(COALESCE(custom_config, '{}'), '$.menu_dia_horarios', CAST(? AS JSON))
        WHERE id = ?`,
      [JSON.stringify(horarios), restaurante.id]
    );

    res.json({ mensaje: 'Franjas horarias guardadas', horarios });
  } catch (error) {
    console.error('Error guardando franjas horarias:', error);
    res.status(500).json({ error: 'Error guardando las franjas horarias', detalles: error.message });
  }
}

/* ============================ PÚBLICO ============================ */

/**
 * GET /api/restaurants/:id/menu-dia/hoy
 * Combos de hoy (desayuno + almuerzo) del restaurante, con las franjas
 * horarias. El día se calcula en America/Bogota. Público (sin auth).
 */
export async function getTodayMenu(req, res) {
  try {
    const restauranteId = Number(req.params.id);
    if (!Number.isInteger(restauranteId)) {
      return res.status(400).json({ error: 'id de restaurante inválido' });
    }

    const diaSemana = MenuSemanal.getDiaSemanaBogota();
    const items = await MenuSemanal.getTodayByRestaurant(restauranteId, diaSemana);

    const restaurante = await queryOne('SELECT custom_config FROM restaurantes WHERE id = ?', [restauranteId]);
    const horarios = getHorarios(restaurante?.custom_config);

    // Estructura amigable para el cliente: { desayuno, almuerzo }
    const porTipo = { desayuno: null, almuerzo: null };
    for (const it of items) porTipo[it.tipo_comida] = it;

    res.json({
      dia_semana: diaSemana,
      horarios,
      desayuno: porTipo.desayuno,
      almuerzo: porTipo.almuerzo,
    });
  } catch (error) {
    console.error('Error obteniendo menú de hoy:', error);
    res.status(500).json({ error: 'Error obteniendo el menú de hoy', detalles: error.message });
  }
}
