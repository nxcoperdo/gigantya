import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCheck, Bell } from 'lucide-react';
import { notificationService } from '../services/api';
import { playNotificationSound, resumeAudioContext } from '../utils/notificationSound';

const NotificationCenter = ({ isOpen, onClose, onNotificationArrived }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isEntering, setIsEntering] = useState(false);

  const lastLatestId = useRef(null);
  const closeTimerRef = useRef(null);
  const openTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      setShouldRender(true);
      setIsEntering(false);
      requestAnimationFrame(() => {
        openTimerRef.current = setTimeout(() => setIsEntering(true), 20);
      });
      fetchNotifications();

      const interval = setInterval(fetchNotifications, 10000);
      return () => {
        clearInterval(interval);
        if (openTimerRef.current) clearTimeout(openTimerRef.current);
      };
    }

    setIsEntering(false);
    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false);
    }, 300);

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications();
      const data = response.data;
      // detectar nueva notificación comparando el id más reciente
      const prevLatest = lastLatestId.current;
      const newLatest = data && data.length ? data[0].id : null;
      if (prevLatest && newLatest && newLatest !== prevLatest && data[0].leido === 0) {
        playNotificationSound();
        onNotificationArrived?.(data[0], data.filter(n => n.leido === 0).length);
      }
      lastLatestId.current = newLatest;
      setNotifications(data);
      const nextUnreadCount = data.filter(n => n.leido === 0).length;
      setUnreadCount(nextUnreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, leido: 1 } : n));
      setUnreadCount(prev => {
        const nextUnread = Math.max(0, prev - 1);
        return nextUnread;
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, leido: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!shouldRender) return null;

  const panelClassName = `absolute right-0 top-0 h-full w-full max-w-md bg-[color:var(--bg-elevated)] shadow-2xl transform will-change-transform transition-all duration-300 ease-out ${
    isEntering ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
  }`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isEntering ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={panelClassName}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[color:var(--border-subtle)] flex items-center justify-between bg-[color:var(--bg-subtle)]/50">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">Notificaciones</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-[color:var(--text-muted)]" />
            </button>
          </div>

          {/* Actions */}
          {unreadCount > 0 && (
            <div className="p-3 border-b border-[color:var(--border-subtle)] flex justify-end">
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Marcar todas como leídas
              </button>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center items-center h-full text-[color:var(--text-muted)]">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-[color:var(--bg-muted)] p-4 rounded-full mb-3">
                  <Bell className="w-8 h-8 text-[color:var(--text-subtle)]" />
                </div>
                <p className="text-[color:var(--text-muted)]">No tienes notificaciones pendientes</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md`}
                  style={n.leido === 0
                    ? { backgroundColor: 'var(--info-bg)', borderColor: 'var(--info-border)' }
                    : { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }
                  }
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-[color:var(--text-primary)]">{n.titulo}</span>
                    <span className="text-[10px] text-[color:var(--text-muted)]">{new Date(n.creado_en).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed">{n.mensaje}</p>
                  {n.leido === 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--info-text)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--info-text)' }} />
                      Nuevo
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
