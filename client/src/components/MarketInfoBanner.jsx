/**
 * Modal informativo para locales de mercado / abarrotes.
 *
 * Explica al cliente que en este tipo de local:
 *   1. Los productos se venden por presentación (libra, kilo, unidad, etc.)
 *   2. Puede chatear con el local para coordinar tamaño / peso / extras
 *
 * Aparece como modal centrado la primera vez que el cliente entra al
 * restaurante. El cliente puede cerrarlo con la X, el botón "Entendido"
 * o tocando el backdrop. El estado "cerrado" se guarda en sessionStorage
 * por restaurante_id (no localStorage: si el cliente vuelve otro día
 * queremos que lo vea de nuevo — es un local nuevo desde su perspectiva
 * y la info le sigue siendo útil).
 *
 * Props:
 *   - restauranteId: id del local. Necesario para la clave de sessionStorage.
 *
 * Accesibilidad:
 *   - role="dialog" + aria-modal + aria-labelledby para screen readers.
 *   - El modal atrapa el foco y se cierra con Escape.
 *   - Cierra con click en el backdrop.
 *
 * Animación: fade-in del backdrop + scale-in del contenido. Respeta
 * prefers-reduced-motion (definido en el global CSS).
 */
import { useEffect, useRef, useState } from 'react';
import { ShoppingBasket, MessageCircle, X, MessageSquare } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'market_banner_dismissed_';

export default function MarketInfoBanner({ restauranteId }) {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!restauranteId) return;
    try {
      const dismissed = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${restauranteId}`);
      // Solo visible si NO fue cerrado antes en esta sesión.
      setVisible(!dismissed);
    } catch {
      // sessionStorage puede fallar en modo incógnito restrictivo o SSR.
      // En ese caso, mostramos el modal (mejor excederse que no mostrar).
      setVisible(true);
    }
  }, [restauranteId]);

  // Cerrar con Escape + lock del scroll del body mientras está abierto.
  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleKey);

    // Mover foco al botón "Entendido" al abrir (target razonable para
    // lector de pantalla y teclado). Si el botón no existe aún, foco al
    // contenedor del modal.
    requestAnimationFrame(() => {
      const focusTarget = dialogRef.current?.querySelector('[data-autofocus]');
      if (focusTarget) focusTarget.focus();
      else dialogRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4
                 bg-black/50 backdrop-blur-sm
                 animate-fade-in"
      onClick={(e) => {
        // Cierra solo si el click fue en el backdrop, no en el modal.
        if (e.target === e.currentTarget) handleDismiss();
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl shadow-2xl
                   bg-[color:var(--bg-elevated)]
                   border border-[color:var(--border-subtle)]
                   animate-scale-in
                   focus:outline-none"
      >
        {/* Botón cerrar (esquina superior derecha) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className="absolute top-3 right-3 p-1.5 rounded-full
                     text-[color:var(--text-muted)]
                     hover:bg-[color:var(--bg-subtle)]
                     active:scale-95 transition-transform
                     min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Header con ícono grande + título */}
        <div
          className="px-6 pt-6 pb-4 rounded-t-2xl
                     bg-gradient-to-b from-amber-50 to-transparent
                     dark:from-amber-950/20"
        >
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full
                         bg-amber-100 dark:bg-amber-900/40
                         flex items-center justify-center
                         ring-1 ring-amber-200 dark:ring-amber-800"
              aria-hidden="true"
            >
              <ShoppingBasket
                size={24}
                style={{ color: 'var(--warning-text, #92400E)' }}
              />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2
                id="market-modal-title"
                className="text-lg font-bold leading-tight
                           text-[color:var(--text-primary)]"
              >
                ¿Tamaño, peso o extra?
              </h2>
              <p
                className="text-sm font-medium mt-0.5 flex items-center gap-1.5"
                style={{ color: 'var(--warning-text, #92400E)' }}
              >
                <MessageCircle size={14} aria-hidden="true" />
                Chatea con el local
              </p>
            </div>
          </div>
        </div>

        {/* Body con explicación */}
        <div className="px-6 pb-6 pt-1">
          <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
            Aquí todo se vende por <strong>presentación</strong>: libra, kilo o por unidad.
            Si tienes dudas,{' '}
            <span className="font-semibold text-[color:var(--text-primary)]">
              chatea con el local y ellos te confirman antes de pagar.
            </span>
          </p>

          {/* Call to action: ícono de chat + label */}
          <div
            className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg
                       bg-[color:var(--bg-subtle)]
                       border border-[color:var(--border-subtle)]"
          >
            <MessageSquare
              size={18}
              className="flex-shrink-0 text-[color:var(--color-primary)]"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                Escríbenos al local
              </p>
              <p className="text-xs text-[color:var(--text-secondary)]">
                Cuéntanos qué necesitas y te armamos el pedido.
              </p>
            </div>
          </div>

          {/* Botón principal de acción */}
          <button
            type="button"
            onClick={handleDismiss}
            data-autofocus
            className="mt-5 w-full py-3 px-4 rounded-xl
                       text-white font-semibold text-sm
                       shadow-sm active:scale-[0.98] transition-transform
                       min-h-[44px]
                       focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: 'var(--color-primary, #f97316)',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
