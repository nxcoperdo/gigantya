/**
 * Banner informativo para locales de mercado / abarrotes.
 *
 * Explica al cliente que en este tipo de local:
 *   1. Los productos se venden por presentación (libra, kilo, unidad, etc.)
 *   2. Puede chatear con el local para coordinar tamaño / peso / extras
 *
 * ## Apilamiento móvil (single source of truth = CSS vars)
 *
 * Este banner es uno de TRES elementos fijos en la parte superior de la
 * página en mobile. Para que NO se solapen entre sí, cada uno usa
 * `top: calc(...)` con las CSS vars publicadas por sus padres:
 *
 *   Header             → top: 0                                  (z-50, sticky)
 *   MarketInfoBanner   → top: calc(var(--header-height)
 *                                   + env(safe-area-inset-top))   (z-49, fixed)
 *   MobileMenuNav      → top: calc(var(--header-height)
 *                                   + var(--market-banner-h, 0px)
 *                                   + env(safe-area-inset-top))   (z-48, fixed)
 *
 * El `padding-top` del contenedor raíz suma los tres + safe-area, y
 * este banner publica `var(--market-banner-h)` con su altura real
 * (medida con ResizeObserver) para que MobileMenuNav la consuma y
 * para que el padre compense el layout.
 *
 * ## Por qué `position: fixed` y no `sticky`
 *
 * Versión anterior usaba `sticky top-0` pero quedaba atado al
 * contenedor `<div className="min-h-screen">` y se "iba" con el scroll
 * en mobile. `position: fixed` lo saca del flujo y lo pega al viewport
 * de verdad. Tradeoff: como fixed no ocupa espacio en el flujo, el
 * padre tiene que aplicar `padding-top` con la altura real (eso se
 * resuelve con la CSS var `--market-banner-h`).
 *
 * ## Persistencia de "cerrado"
 *
 * sessionStorage por restaurante_id (no localStorage: si el cliente
 * vuelve otro día queremos que lo vea de nuevo, es un local nuevo
 * desde su perspectiva).
 */
import { useEffect, useRef, useState } from 'react';
import { ShoppingBasket, MessageCircle, X } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'market_banner_dismissed_';

export default function MarketInfoBanner({ restauranteId }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // Hidratar visibilidad desde sessionStorage
  useEffect(() => {
    if (!restauranteId) return;
    try {
      const dismissed = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${restauranteId}`);
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [restauranteId]);

  // Mide la altura real y la publica en CSS var + window global.
  // El padre la usa para padding-top; MobileMenuNav la usa para su top.
  useEffect(() => {
    if (!visible || !ref.current) return undefined;
    const el = ref.current;
    const publish = (h) => {
      document.documentElement.style.setProperty('--market-banner-h', `${h}px`);
      window.__marketBannerHeight = h;
      window.dispatchEvent(new CustomEvent('market-banner-resize', { detail: { height: h } }));
    };
    // Sync inicial
    publish(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        publish(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      // Limpieza: el padre va a recalcular --sticky-mobile-offset en
      // el próximo resize event, pero dejamos la var en 0 explícitamente
      // para que cualquier cálculo que dependa de ella no quede con un
      // valor fantasma.
      document.documentElement.style.setProperty('--market-banner-h', '0px');
      window.__marketBannerHeight = 0;
      window.dispatchEvent(new CustomEvent('market-banner-resize', { detail: { height: 0 } }));
    };
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    if (!restauranteId) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${restauranteId}`, '1');
    } catch {
      // Si sessionStorage falla, el próximo mount lo muestra de nuevo.
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="note"
      aria-label="Información del local de mercado"
      // z-49 para que esté DEBAJO del header (z-50) y ARRIBA del nav
      // mobile (z-48). El `top` usa calc para apilar debajo del header
      // respetando el safe-area del notch. En desktop el banner se
      // podría ver en una página de admin, pero en el flujo cliente
      // (donde se monta) mobile-only, así que el cálculo funciona bien.
      className="fixed left-0 right-0 z-[49] shadow-sm"
      style={{
        top: 'calc(var(--header-height, 60px) + env(safe-area-inset-top, 0px))',
        backgroundColor: 'var(--warning-bg, #FEF3C7)',
        borderBottom: '1px solid var(--warning-border, #FCD34D)',
        color: 'var(--warning-text, #92400E)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
        {/* Icono izquierdo */}
        <div className="flex-shrink-0" aria-hidden="true">
          <ShoppingBasket
            size={18}
            className="sm:!w-6 sm:!h-6"
            style={{ color: 'var(--warning-text, #92400E)' }}
          />
        </div>

        {/* Texto principal — en mobile solo el título, en desktop el
            subtítulo completo. Touch-friendly: padding generoso y
            el texto no se trunca en 360px. */}
        <div className="flex-1 min-w-0 text-[11px] sm:text-sm leading-snug">
          <p className="font-bold flex items-center gap-1 sm:gap-1.5">
            <MessageCircle
              size={12}
              className="sm:!w-4 sm:!h-4 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">¿Tamaño, peso o extra? Chatea con el local</span>
          </p>
          <p
            className="hidden sm:block opacity-90 mt-0.5"
            style={{ color: 'var(--warning-text, #92400E)' }}
          >
            Acá todo se vende por presentación: libra, kilo o por unidad.
            Si tienes dudas,{' '}
            <span className="font-semibold">chatea con el local y ellos te confirman antes de pagar.</span>
          </p>
        </div>

        {/* Botón cerrar — touch target 44×44px (Apple HIG). */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className="flex-shrink-0 p-2.5 sm:p-2 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{ color: 'var(--warning-text, #92400E)' }}
        >
          <X size={16} className="sm:!w-5 sm:!h-5" />
        </button>
      </div>
    </div>
  );
}
