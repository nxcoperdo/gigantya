/**
 * InventoryAlertsBanner (Fase 6).
 *
 * Banner persistente en POSLayout que escucha `pos:inventory_low` y
 * muestra un toast cada vez que un ingrediente cruza su umbral. Mantiene
 * una lista en memoria de las alertas recientes (últimas 5) que se
 * cierra con la X.
 *
 * Solo visible para `restaurante` y `admin` (los meseros no necesitan
 * ver este banner, pero el `InventoryAlertsBanner` filtra por rol).
 */
import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/socket';

const MAX_ALERTAS = 5;
const DUPLICATE_WINDOW_MS = 5000;

export default function InventoryAlertsBanner() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState([]);

  // Solo dueño y admin ven este banner. El return temprano evita
  // suscribirse al socket innecesariamente.
  const isVisible = user && ['restaurante', 'admin'].includes(user.tipo_usuario);

  const handleLow = useCallback((payload) => {
    setAlertas((prev) => {
      // Evitar duplicados del mismo ingrediente en los últimos 5s.
      const reciente = prev.find(
        (a) => a.ingrediente_id === payload.ingrediente_id
          && (Date.now() - a.ts) < DUPLICATE_WINDOW_MS
      );
      if (reciente) return prev;
      const nuevo = {
        id: `${payload.ingrediente_id}-${Date.now()}`,
        ingrediente_id: payload.ingrediente_id,
        nombre: payload.nombre,
        stock_actual: payload.stock_actual,
        stock_minimo: payload.stock_minimo,
        ts: Date.now(),
      };
      return [nuevo, ...prev].slice(0, MAX_ALERTAS);
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return undefined;
    subscribeToEvent('pos:inventory_low', handleLow);
    return () => unsubscribeFromEvent('pos:inventory_low', handleLow);
  }, [isVisible, handleLow]);

  if (!isVisible || alertas.length === 0) return null;

  function dismiss(id) {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div
      className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96 pointer-events-none"
      role="region"
      aria-label="Alertas de inventario"
    >
      {alertas.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto flex items-start gap-3 px-3.5 py-3 rounded-xl shadow-2xl shadow-amber-500/20 border-2 border-amber-500/40 bg-amber-500/15 text-amber-100 animate-slideLeft"
          role="alert"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm flex items-center gap-1">
              <Package className="w-3 h-3" aria-hidden="true" />
              Stock bajo: <span className="truncate">{a.nombre}</span>
            </div>
            <div className="text-xs text-amber-200/80 mt-0.5 font-mono">
              {Number(a.stock_actual).toFixed(2)} / mínimo {Number(a.stock_minimo).toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            className="p-1.5 rounded-md hover:bg-amber-500/30 transition-colors shrink-0"
            aria-label="Cerrar alerta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
