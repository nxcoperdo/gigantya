import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — devuelve `value` "estabilizado" después de `delay` ms
 * sin cambios. Útil para evitar refetch en cada keystroke (búsqueda,
 * autocompletado, etc.).
 *
 * Implementación: `useRef` para el id del timer + cleanup en el useEffect.
 * Patrón copiado de `pages/pos/FloorPlanPage.jsx:scheduleSave` para
 * mantener consistencia con el código existente.
 *
 * @param {any} value — valor a "debounce-ar" (cualquier tipo).
 * @param {number} [delay=250] — milisegundos. El default (250ms) es el
 *   sweet spot entre "instantáneo" y "no martillar el server" en búsquedas.
 * @returns el valor estabilizado.
 *
 * @example
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedTerm = useDebouncedValue(searchTerm, 250);
 *   useEffect(() => { fetch(`...&q=${debouncedTerm}`) }, [debouncedTerm]);
 */
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Si el delay es inválido, devolvemos el valor sin debounce (degrada con
    // gracia, no rompe el componente consumidor).
    if (!Number.isInteger(delay) || delay < 0) {
      setDebounced(value);
      return undefined;
    }

    const id = setTimeout(() => {
      setDebounced(value);
    }, delay);

    // Cleanup: si el value cambia antes de que se dispare el timer (otro
    // keystroke), cancelamos el timer anterior. Así, solo el último valor
    // dentro de la ventana de `delay` ms llega al state.
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
