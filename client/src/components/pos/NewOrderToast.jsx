/**
 * NewOrderToast (Fase 4).
 *
 * Mini componente que renderiza un toast "Nuevo pedido #N" en la
 * esquina superior derecha y reproduce un sonido corto cuando se le
 * pasa `data` (payload del socket `pos:order_created`).
 *
 * El sonido es un WAV de ~9KB en `public/sounds/ding.wav` (tono 800Hz,
 * 200ms con decay exponencial). Si el archivo no existe, no se rompe —
 * solo no suena.
 *
 * Autodismiss: 5 segundos. Si llegan varios seguidos, cada nuevo
 * reinicia el timer.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';

const TOAST_DURATION_MS = 5000;

export default function NewOrderToast({ data, onClose }) {
  const [visible, setVisible] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setCurrentData(data);
    setVisible(true);
    // Sonido (best-effort: el browser puede bloquearlo si no hubo
    // interacción previa del usuario; eso es OK, el toast sigue
    // apareciendo).
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/ding.wav');
        audioRef.current.volume = 0.5;
      }
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p && p.catch) p.catch(() => { /* bloqueado por browser, OK */ });
    } catch (_) { /* noop */ }
    // Reset timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      onClose && onClose();
    }, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, onClose]);

  if (!visible || !currentData) return null;
  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-sm bg-amber-500 text-slate-900 rounded-lg shadow-lg p-3 flex items-start gap-2"
      role="alert"
    >
      <Bell className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">
          Nuevo pedido #{currentData.pedido_id}
        </div>
        <div className="text-xs opacity-80">
          {currentData.mesa_id
            ? `Mesa ${currentData.mesa_id}`
            : currentData.tipo === 'pickup'
              ? 'Recoger'
              : 'Domicilio'}
          {' · '}
          {new Date(currentData.timestamp || Date.now()).toLocaleTimeString('es-CO', {
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </div>
      <button
        onClick={() => { setVisible(false); onClose && onClose(); }}
        className="p-1 rounded hover:bg-amber-600/30"
        type="button"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
