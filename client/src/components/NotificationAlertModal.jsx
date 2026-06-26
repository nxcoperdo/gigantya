import React from 'react';
import { Bell, X, AlertCircle } from 'lucide-react';

const NotificationAlertModal = ({
  isOpen,
  onClose,
  title = 'Nueva notificación',
  message = 'Tienes una notificación nueva.',
  count = 1,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[color:var(--bg-elevated)] shadow-2xl animate-scaleIn">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-red-500 to-orange-400" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--text-subtle)] transition-colors hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--text-secondary)]"
          aria-label="Cerrar alerta"
        >
          <X size={18} />
        </button>

        <div className="p-7 pt-9">
          <div className="mb-4 flex items-center gap-3">
            <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner"
            style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}
          >
            <Bell size={28} />
          </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Alerta</p>
              <h3 className="text-2xl font-bold text-[color:var(--text-primary)]">{title}</h3>
            </div>
          </div>

          <div
            className="mb-5 flex items-start gap-3 rounded-2xl p-4 text-sm text-[color:var(--text-secondary)]"
            style={{ backgroundColor: 'var(--danger-bg)' }}
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--danger-text)' }} />
            <p className="leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">Notificaciones pendientes</p>
              <p className="text-lg font-semibold text-[color:var(--text-primary)]">{count > 1 ? `${count} nuevas notificaciones` : '1 nueva notificación'}</p>
            </div>
            <div className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-white shadow-md shadow-primary/25">
              Nuevo
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition-all hover:bg-primaryDark hover:shadow-lg active:scale-[0.99]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationAlertModal;

