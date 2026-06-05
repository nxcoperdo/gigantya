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

export default {
  addFavorite,
  removeFavorite,
  getFavorites,
  getSearchHistory,
  clearSearchHistory
};
