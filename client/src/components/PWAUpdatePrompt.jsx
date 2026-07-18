import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

// Toast de "nueva versión disponible" de la PWA.
//
// El service worker está en modo `prompt` (ver vite.config.js): cuando se
// despliega una versión nueva, el SW nuevo queda "en espera" y este toast
// le avisa al usuario. Recién al tocar "Actualizar" se activa y recarga.
// Así nunca recargamos a alguien a mitad de un pedido sin avisar.
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Revisar si hay una versión nueva cada hora (además del chequeo que
      // hace el navegador al abrir la app).
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[9999] animate-slideUp">
      <div className="bg-[color:var(--bg-elevated,#fff)] border border-[color:var(--border-subtle,#e5e7eb)] rounded-2xl shadow-lg-soft p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <RefreshCw size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[color:var(--text-primary,#111827)]">
            Nueva versión disponible
          </p>
          <p className="text-sm text-[color:var(--text-secondary,#6b7280)] mt-0.5">
            Actualiza para tener las últimas mejoras de Gigantya.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="btn btn-primary btn-sm"
            >
              Actualizar
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="text-sm font-medium text-[color:var(--text-secondary,#6b7280)] px-3 py-1.5 hover:text-[color:var(--text-primary,#111827)] transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="Cerrar"
          className="text-[color:var(--text-secondary,#9ca3af)] hover:text-[color:var(--text-primary,#111827)] transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
