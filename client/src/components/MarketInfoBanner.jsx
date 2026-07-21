/**
 * Banner informativo para locales de mercado / abarrotes.
 *
 * Explica al cliente que en este tipo de local:
 *   1. Los productos se venden por presentación (libra, kilo, unidad, etc.)
 *   2. Puede chatear con el local para coordinar tamaño / peso / extras
 *
 * ## Layout: por qué `fixed` y no `sticky`
 *
 * El componente se monta dentro de `<RestaurantDetailsPage>` que envuelve
 * todo en `<div className="min-h-screen ...">`. Un `sticky top-0` en ese
 * contexto se comporta bien en desktop (el contenedor padre es alto) pero
 * en mobile muchos usuarios reportaban que el banner se "iba" al hacer
 * scroll porque quedaba atado al contenedor scrollable, no al viewport.
 *
 * Solución: `position: fixed; top: 0` con `z-50` para que flote sobre
 * TODA la app y siempre esté visible. En mobile sumamos
 * `env(safe-area-inset-top)` para no chocar con el notch / status bar
 * en iPhone y Android con corte.
 *
 * Como `fixed` saca al elemento del flujo, el `<RestaurantDetailsPage>`
 * necesita empujar el contenido hacia abajo con `padding-top` igual a la
 * altura del banner. El padre aplica `pt-[var(--market-banner-h)]` solo
 * cuando el banner está visible (ver `useMarketBannerOffset` en
 * `RestaurantDetailsPage`).
 *
 * ## Persistencia
 *
 * Estado "cerrado" se guarda en sessionStorage por restaurante_id (no
 * localStorage: si el cliente vuelve otro día queremos que lo vea de
 * nuevo — es un local nuevo desde su perspectiva).
 */
import { useEffect, useRef, useState } from 'react';
import { ShoppingBasket, MessageCircle, X } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'market_banner_dismissed_';

export default function MarketInfoBanner({ restauranteId }) {
  const [visible, setVisible] = useState(false);
  // Altura real del banner en px (medida con ResizeObserver) para que el
  // padre pueda hacer padding-top exacto sin adivinar. Exportada vía
  // window.__marketBannerHeight para que el padre la lea sin prop drilling.
  // Es un hack aceptable porque solo hay UN banner de mercado activo a
  // la vez en toda la app.
  const ref = useRef(null);

  useEffect(() => {
    if (!restauranteId) return;
    try {
      const dismissed = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${restauranteId}`);
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [restauranteId]);

  // Mide la altura real del banner y la publica en window para que el
  // padre pueda offsetear su contenido. ResizeObserver cubre los casos
  // de rotación de pantalla, cambio de tamaño de fuente del browser, etc.
  useEffect(() => {
    if (!visible || !ref.current) return undefined;
    const el = ref.current;
    const publish = () => {
      const h = el.getBoundingClientRect().height;
      window.__marketBannerHeight = h;
      // Disparamos un evento custom para que el padre (u otros listeners)
      // reaccione sin tener que polear.
      window.dispatchEvent(new CustomEvent('market-banner-resize', { detail: { height: h } }));
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
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
      // No es bloqueante.
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="note"
      aria-label="Información del local de mercado"
      // fixed + z-50 → flota sobre toda la página y NO se va con scroll.
      // En mobile respeta el safe-area del notch/status bar.
      // En desktop top:0 directo.
      className="fixed top-0 left-0 right-0 z-50 shadow-md"
      style={{
        top: 'max(0px, env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
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

        {/* Texto principal — más compacto en mobile */}
        <div className="flex-1 min-w-0 text-[11px] sm:text-sm leading-snug">
          <p className="font-bold flex items-center gap-1 sm:gap-1.5">
            <MessageCircle
              size={12}
              className="sm:!w-4 sm:!h-4 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">¿Tamaño, peso o extra? Chatea con el local</span>
          </p>
          {/* Descripción larga: solo desktop. En mobile el título ya
              transmite la idea y ahorramos espacio vertical. */}
          <p
            className="hidden sm:block opacity-90 mt-0.5"
            style={{ color: 'var(--warning-text, #92400E)' }}
          >
            Acá todo se vende por presentación: libra, kilo o por unidad.
            Si tienes dudas,{' '}
            <span className="font-semibold">chatea con el local y ellos te confirman antes de pagar.</span>
          </p>
        </div>

        {/* Botón cerrar — touch target mínimo 32px (Apple HIG) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className="flex-shrink-0 p-1.5 sm:p-1 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors -mr-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
          style={{ color: 'var(--warning-text, #92400E)' }}
        >
          <X size={16} className="sm:!w-5 sm:!h-5" />
        </button>
      </div>
    </div>
  );
}
