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
 * reinicia el timer. Stack: hasta 3 toasts simultáneos, los nuevos
 * aparecen arriba del stack.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, X, ChevronRight, ShoppingBag, MapPin, ShoppingBasket, Bike } from 'lucide-react';

const TOAST_DURATION_MS = 5000;
const MAX_STACK = 3;

const TIPO_INFO = {
  dine_in:   { Icon: MapPin,        label: 'Mesa' },
  mesa:      { Icon: MapPin,        label: 'Mesa' },
  pickup:    { Icon: ShoppingBasket,label: 'Recoger' },
  delivery:  { Icon: Bike,          label: 'Domicilio' },
};

function getTipoInfo(data) {
  if (data?.mesa_id) return { Icon: MapPin, label: `Mesa ${data.mesa_id}` };
  if (data?.tipo && TIPO_INFO[data.tipo]) {
    return TIPO_INFO[data.tipo];
  }
  if (data?.tipo === 'mesa') return { Icon: MapPin, label: 'Mesa' };
  return { Icon: ShoppingBag, label: 'Pedido' };
}

export default function NewOrderToast({ data, onClose }) {
  // Stack de toasts (FIFO) para soportar varios pedidos casi simultáneos.
  const [stack, setStack] = useState([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    const stamp = Date.now();
    const entry = { ...data, _id: stamp, _ts: stamp };
    setStack((prev) => {
      const next = [...prev, entry];
      // Recortar al MAX_STACK más recientes.
      return next.length > MAX_STACK ? next.slice(next.length - MAX_STACK) : next;
    });
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
    // Reset timer del último (el más reciente siempre vive 5s).
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStack((prev) => prev.slice(1));
      onClose && onClose();
    }, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, onClose]);

  if (stack.length === 0) return null;

  const handleDismiss = (id) => {
    setStack((prev) => prev.filter((t) => t._id !== id));
  };

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96 pointer-events-none"
      role="region"
      aria-label="Notificaciones de nuevos pedidos"
    >
      {stack.map((entry, i) => {
        const { Icon, label } = getTipoInfo(entry);
        const time = new Date(entry.timestamp || entry._ts).toLocaleTimeString('es-CO', {
          hour: '2-digit', minute: '2-digit',
        });
        return (
          <div
            key={entry._id}
            role="alert"
            aria-live="polite"
            className="pointer-events-auto bg-amber-500 text-slate-900 rounded-xl shadow-2xl shadow-amber-500/20 p-3.5 flex items-start gap-3 animate-slideLeft border-2 border-amber-400"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-600/30 flex items-center justify-center shrink-0">
              <Bell className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Nuevo pedido</span>
                <span className="font-mono text-sm font-bold">#{entry.pedido_id}</span>
                {stack.length > 1 && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {i + 1}/{stack.length}
                  </span>
                )}
              </div>
              <div className="text-xs opacity-80 mt-0.5 flex items-center gap-1">
                <Icon className="w-3 h-3" aria-hidden="true" />
                <span>{label}</span>
                <span aria-hidden="true">·</span>
                <span>{time}</span>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(entry._id)}
              className="p-1.5 rounded-md hover:bg-amber-600/30 transition-colors shrink-0"
              type="button"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
