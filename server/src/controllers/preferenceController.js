import * as FavoriteModel from '../models/Favorite.js';
import * as SearchHistoryModel from '../models/SearchHistory.js';

export async function addFavorite(req, res) {
  try {
    const { tipo, target_id } = req.body;

    if (!tipo || !target_id) {
      return res.status(400).json({ error: 'tipo y target_id son requeridos' });
    }

    if (!['restaurant', 'product'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "restaurant" o "product"' });
    }

    const favoriteId = await FavoriteModel.addFavorite(req.user.id, tipo, target_id);
    res.status(201).json({
      mensaje: 'Agregado a favoritos',
      favoriteId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error agregando a favoritos', error: error.message });
  }
}

export async function removeFavorite(req, res) {
  try {
    const { tipo, target_id } = req.body;

    if (!tipo || !target_id) {
      return res.status(400).json({ error: 'tipo y target_id son requeridos' });
    }

    await FavoriteModel.removeFavorite(req.user.id, tipo, target_id);
    res.json({ mensaje: 'Eliminado de favoritos' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando de favoritos', error: error.message });
  }
}

export async function getFavorites(req, res) {
  try {
    const { tipo } = req.params;

    if (!['restaurant', 'product'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "restaurant" o "product"' });
    }

    const favorites = await FavoriteModel.getFavorites(req.user.id, tipo);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo favoritos', error: error.message });
  }
}

export async function getSearchHistory(req, res) {
  try {
    const history = await SearchHistoryModel.getSearchHistory(req.user.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo historial de búsqueda', error: error.message });
  }
}

export async function clearSearchHistory(req, res) {
  try {
    await SearchHistoryModel.clearSearchHistory(req.user.id);
    res.json({ mensaje: 'Historial de búsqueda borrado' });
  } catch (error) {
    res.status(500).json({ message: 'Error borrando historial de búsqueda', error: error.message });
  }
}

/**
 * POST /api/preferences/search-history
 * Body: { termino: string }
 *
 * Persiste un término en el historial del usuario autenticado con dedup
 * case-insensitive. La UNIQUE KEY sobre `(usuario_id, LOWER(termino))` +
 * `ON DUPLICATE KEY UPDATE creado_en = NOW()` (en `SearchHistory.upsertSearch`)
 * garantiza atomicidad: dos requests concurrentes con el mismo término
 * terminan en una sola fila con el `creado_en` más reciente.
 *
 * Validación:
 *   - termino debe ser string, trim no vacío, length <= 100. Si no → 400.
 *
 * Defensa XSS: el backend solo almacena el string. La defensa vive en el
 * frontend, que debe escapar el texto antes de renderizarlo (React escapa
 * por default; el autocomplete marca el match con `<mark>` sobre el texto
 * ya escapado, ver SearchAutocomplete.jsx).
 */
export async function addSearchTerm(req, res) {
  try {
    const { termino } = req.body || {};
    if (typeof termino !== 'string') {
      return res.status(400).json({ error: 'El campo "termino" es requerido y debe ser texto' });
    }
    const trimmed = termino.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'El término no puede estar vacío' });
    }
    if (trimmed.length > 100) {
      return res.status(400).json({ error: 'El término no puede superar 100 caracteres' });
    }

    await SearchHistoryModel.upsertSearch(req.user.id, trimmed);
    res.status(201).json({ mensaje: 'Búsqueda guardada', termino: trimmed });
  } catch (error) {
    console.error('Error guardando término de búsqueda:', error);
    res.status(500).json({ message: 'Error guardando término de búsqueda', error: error.message });
  }
}

export default {
  addFavorite,
  removeFavorite,
  getFavorites,
  getSearchHistory,
  clearSearchHistory,
  addSearchTerm,
};
