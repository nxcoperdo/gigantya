import * as NotificationModel from '../models/Notification.js';

export async function getNotifications(req, res) {
  try {
    const notifications = await NotificationModel.getUserNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
}

export async function markRead(req, res) {
  try {
    const { id } = req.params;
    await NotificationModel.markAsRead(id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
}

export async function markAllRead(req, res) {
  try {
    await NotificationModel.markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
  }
}

/**
 * Marca como leídas todas las notificaciones no leídas del usuario dentro de un rango
 * de fechas (correspondiente a un grupo: Hoy / Ayer / Esta semana / Anteriores).
 *
 * Body esperado: { dateKey: string, from: 'YYYY-MM-DD HH:mm:ss', to: 'YYYY-MM-DD HH:mm:ss' }
 * - dateKey: 'today' | 'yesterday' | 'this_week' | 'older' (whitelist estricta, para logging)
 * - from/to: rango generado por el cliente en America/Bogota
 */
export async function markGroupRead(req, res) {
  try {
    const { dateKey, from, to } = req.body || {};

    if (!dateKey || typeof dateKey !== 'string') {
      return res.status(400).json({ message: 'dateKey requerido' });
    }
    const validKeys = ['today', 'yesterday', 'this_week', 'older'];
    if (!validKeys.includes(dateKey)) {
      return res.status(400).json({ message: `dateKey inválido. Permitidos: ${validKeys.join(', ')}` });
    }
    if (!from || !to) {
      return res.status(400).json({ message: 'from y to son requeridos (formato YYYY-MM-DD HH:mm:ss)' });
    }
    // Validación de formato básico (defensa en profundidad, no hace daño).
    const dateRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!dateRe.test(from) || !dateRe.test(to)) {
      return res.status(400).json({ message: 'from/to deben tener formato YYYY-MM-DD HH:mm:ss' });
    }
    if (from >= to) {
      return res.status(400).json({ message: 'from debe ser menor que to' });
    }

    const result = await NotificationModel.markGroupAsRead(req.user.id, from, to);
    res.json({ message: 'Group marked as read', affectedRows: result.affectedRows });
  } catch (error) {
    res.status(500).json({ message: 'Error marking group as read', error: error.message });
  }
}

export default {
  getNotifications,
  markRead,
  markAllRead,
  markGroupRead
};
