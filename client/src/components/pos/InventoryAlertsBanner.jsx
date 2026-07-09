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
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/socket';

export default function InventoryAlertsBanner() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState([]);

  // Solo dueño y admin ven este banner. El return temprano evita
  // suscribirse al socket innecesariamente.
  const isVisible = user && ['restaurante', 'admin'].includes(user.tipo_usuario);
  // Como el listener solo se monta si isVisible, declaramos el handler
  // antes del return temprano para que React no se queje del orden de
  // hooks.
  const handleLow = useCallback((payload) => {
    setAlertas((prev) => {
      // Evitar duplicados del mismo ingrediente en los últimos 5s.
      const reciente = prev.find(
        (a) => a.ingrediente_id === payload.ingrediente_id
          && (Date.now() - a.ts) < 5000
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
      return [nuevo, ...prev].slice(0, 5);
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
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-sm">
      {alertas.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 px-3 py-2 rounded-lg shadow-lg border border-amber-500/40 bg-amber-500/10 text-amber-100"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-semibold">Stock bajo: {a.nombre}</div>
            <div className="text-xs text-amber-200/80">
              {Number(a.stock_actual).toFixed(2)} / mínimo {Number(a.stock_minimo).toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            className="p-1 rounded hover:bg-amber-500/20 flex-shrink-0"
            aria-label="Cerrar alerta"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
