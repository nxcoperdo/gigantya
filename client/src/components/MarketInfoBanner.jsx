/**
 * Banner informativo para locales de mercado / abarrotes.
 *
 * Explica al cliente que en este tipo de local:
 *   1. Los productos se venden por presentación (libra, kilo, unidad, etc.)
 *   2. Puede chatear con el local para coordinar tamaño / peso / extras
 *
 * Posición: `fixed` debajo del header (top: header-height + safe-area).
 * Al hacer scroll, NO se mueve — el cliente lo ve siempre mientras recorre
 * el menú. Es un bloque opaco, no overlay translúcido: si necesitas ver
 * el banner por encima del contenido, el contenido de la página empuja
 * hacia abajo. Como `position: fixed` no ocupa flujo, el padre (la página
 * del restaurante) necesita un padding-top compensatorio cuando el
 * banner está visible.
 *
 * El cliente puede cerrarlo con la X; el estado "cerrado" se guarda en
 * sessionStorage por restaurante_id (no localStorage: si el cliente
 * vuelve otro día queremos que lo vea de nuevo — es un local nuevo
 * desde su perspectiva y la info le sigue siendo útil).
 *
 * Props:
 *   - restauranteId: id del local. Necesario para la clave de sessionStorage.
 *
 * Nota de diseño: NO usamos un modal porque interrumpe la navegación.
 * `fixed top` con z alto es visible pero no bloquea, y queda siempre
 * accesible. Mantenemos el contenido corto y con buen contraste para
 * que sea legible sobre cualquier color de página.
 */
import { useEffect, useRef, useState } from 'react';
import { ShoppingBasket, MessageCircle, X } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'market_banner_dismissed_';

export default function MarketInfoBanner({ restauranteId }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!restauranteId) return;
    try {
      const dismissed = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${restauranteId}`);
      // Solo visible si NO fue cerrado antes en esta sesión.
      setVisible(!dismissed);
    } catch {
      // sessionStorage puede fallar en modo incógnito restrictivo o SSR.
      // En ese caso, mostramos el banner (mejor excederse que no mostrar).
      setVisible(true);
    }
  }, [restauranteId]);

  // Medir la altura real del banner (varía según ancho de pantalla) y
  // publicarla como CSS var para que MobileMenuNav se posicione debajo
  // sin chocar. ResizeObserver cubre cambios de tamaño de fuente/orientación.
  useEffect(() => {
    if (!visible) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const h = el.offsetHeight;
      document.documentElement.style.setProperty('--market-banner-height', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--market-banner-height');
    };
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    if (!restauranteId) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${restauranteId}`, '1');
    } catch {
      // Ignorar: si sessionStorage falla, el próximo mount lo muestra de
      // nuevo. No es bloqueante.
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="note"
      aria-label="Información del local de mercado"
      className="fixed left-0 right-0 z-40 w-full shadow-md"
      style={{
        // top: altura del header (CSS var que emite Header.jsx) + safe area.
        // `position: fixed` lo deja pegado al viewport, así que no se mueve
        // al hacer scroll — el usuario lo ve siempre arriba mientras recorre
        // el menú.
        top: 'calc(var(--header-height, 60px) + env(safe-area-inset-top, 0px))',
        backgroundColor: 'var(--warning-bg, #FEF3C7)',
        borderBottom: '1px solid var(--warning-border, #FCD34D)',
        color: 'var(--warning-text, #92400E)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2.5 sm:gap-3">
        {/* Icono izquierdo: refuerza visualmente "es un mercado" */}
        <div
          className="flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <ShoppingBasket
            size={20}
            className="sm:!w-6 sm:!h-6"
            style={{ color: 'var(--warning-text, #92400E)' }}
          />
        </div>

        {/* Texto principal */}
        <div className="flex-1 min-w-0 text-xs sm:text-sm leading-snug">
          <p className="font-bold mb-0.5 sm:mb-1 flex items-center gap-1.5">
            <MessageCircle
              size={14}
              className="sm:!w-4 sm:!h-4"
              aria-hidden="true"
            />
            <span>¿Tamaño, peso o extra? Chatea con el local</span>
          </p>
          <p
            className="opacity-90"
            style={{ color: 'var(--warning-text, #92400E)' }}
          >
            Aquí todo se vende por presentación: libra, kilo o por unidad.
            Si tienes dudas,{' '}
            <span className="font-semibold">chatea con el local y ellos te confirman antes de pagar.</span>
          </p>
        </div>

        {/* Botón cerrar */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors -mr-1"
          style={{ color: 'var(--warning-text, #92400E)' }}
        >
          <X size={16} className="sm:!w-5 sm:!h-5" />
        </button>
      </div>
    </div>
  );
}
