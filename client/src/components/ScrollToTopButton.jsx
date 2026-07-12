import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Botón flotante "Volver arriba" (mobile-only).
 *
 * Aparece cuando el usuario ha scrolleado más allá de `threshold` (default
 * 400px ≈ medio viewport en mobile típico). Es el "salvavidas" para menús
 * largos: el cliente scrollea 5+ cards, quiere volver al header para ver
 * horario/teléfono/descripción, y no tiene que hacer 10 swipes manuales.
 *
 * Solo mobile: en desktop hay mouse con scroll wheel y el page-jump
 * también se hace con la tecla Home. Agregar el botón en desktop suma
 * clutter visual sin beneficio.
 *
 * Safe-area: el `bottom-[calc(5rem+env(safe-area-inset-bottom))]` deja
 * 80px para que el FAB no choque con el MobileCartBar (que ocupa los
 * últimos ~56-72px del bottom) ni con el home indicator de iOS.
 *
 * Props:
 *   - threshold?: number (default 400) — píxeles de scroll para que aparezca.
 *   - className?: string — clases extra para el botón (raro, se incluye por
 *                         simetría con otros componentes).
 */
export default function ScrollToTopButton({ threshold = 400, className = '' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // `passive: true` para que el browser no tenga que esperar a ver si
      // vamos a llamar preventDefault — el scroll nunca se cancela acá.
      setVisible(window.scrollY > threshold);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Chequeo inicial por si la página carga ya scrolleada (ej: atrás/adelante).
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  const handleClick = () => {
    // scroll-behavior: smooth del CSS global; el fallback `behavior: 'smooth'`
    // acá es para navegadores viejos. En prefers-reduced-motion el global
    // pone scroll-behavior: auto, así que salta sin animación.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Volver arriba"
      // md:hidden — el botón no se renderiza en desktop. Cero clutter.
      className={[
        'md:hidden',
        'fixed right-4 z-30',
        // 80px de bottom + safe-area de iOS. Si en testing el FAB queda
        // muy bajo, ajustar este calc (MobileCartBar ocupa los últimos
        // ~72px del bottom en su peor caso).
        'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
        'w-12 h-12 rounded-full',
        'bg-[color:var(--color-primary)] text-white',
        'shadow-lg flex items-center justify-center',
        'active:scale-95 transition-transform',
        'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-2',
        className,
      ].join(' ')}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
