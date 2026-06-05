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

export default {
  getNotifications,
  markRead,
  markAllRead
};
