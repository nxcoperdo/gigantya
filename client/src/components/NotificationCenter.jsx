import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, CheckCheck, Bell } from 'lucide-react';
import { notificationService } from '../services/api';
import { playNotificationSound, resumeAudioContext } from '../utils/notificationSound';
import { formatDate } from '../utils/dateHelper';
import { groupNotificationsByDay, getDateRangeForGroup } from '../utils/notificationGrouper';

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

  // Marcar como leídas todas las notificaciones de un grupo (Hoy / Ayer / Esta semana / Anteriores).
  // Optimista: actualiza el estado local de inmediato, sin esperar al refetch.
  const handleMarkGroupRead = useCallback(async (group) => {
    const range = getDateRangeForGroup(group.key);
    if (!range) return;
    try {
      await notificationService.markGroupAsRead({
        dateKey: group.key,
        from: range.from,
        to: range.to,
      });
      // Marcar como leídos los items de ESTE grupo en el estado local.
      setNotifications(prev => {
        const next = prev.map(n => {
          if (n.leido !== 0) return n;
          const dayKey = (n.creado_en || '').slice(0, 10);
          // Comparamos por día local: from/to tienen formato 'YYYY-MM-DD HH:mm:ss'
          // y group.key ya separa por día, así que alcanza con comparar el prefijo YYYY-MM-DD
          // contra el rango recibido.
          if (dayKey >= range.from.slice(0, 10) && dayKey < range.to.slice(0, 10)) {
            return { ...n, leido: 1 };
          }
          return n;
        });
        // Actualizar contador global
        const remaining = next.filter(n => n.leido === 0).length;
        setUnreadCount(remaining);
        return next;
      });
    } catch (error) {
      console.error('Error marking group as read:', error);
    }
  }, []);

  // Agrupar notificaciones por día. useMemo para no recalcular en cada render.
  // O(n) en memoria, perfectamente bien para 50-100 notis.
  const groups = useMemo(
    () => groupNotificationsByDay(notifications),
    [notifications]
  );

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
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
              groups.map(group => (
                <section key={group.key} className="space-y-2">
                  {/* Header del grupo: label + contador de no leídas + acción marcar como leídas */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">
                        {group.label}
                      </h3>
                      {group.unreadCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: 'var(--primary, #667eea)' }}
                          aria-label={`${group.unreadCount} sin leer`}
                        >
                          {group.unreadCount}
                        </span>
                      )}
                    </div>
                    {group.unreadCount > 0 && (
                      <button
                        onClick={() => handleMarkGroupRead(group)}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-dark transition-colors"
                        aria-label={`Marcar las notificaciones de ${group.label} como leídas`}
                      >
                        <CheckCheck className="w-3 h-3" />
                        Marcar como leídas
                      </button>
                    )}
                  </div>

                  {/* Items del grupo */}
                  {group.items.map(n => (
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
                        <span className="text-[10px] text-[color:var(--text-muted)]">{formatDate(n.creado_en)}</span>
                      </div>
                      <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed">{n.mensaje}</p>
                      {n.leido === 0 && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--info-text)' }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--info-text)' }} />
                          Nuevo
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
