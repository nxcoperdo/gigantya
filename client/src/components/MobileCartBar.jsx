import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/formatHelper';

/**
 * Mini-banner inferior con info del carrito (mobile-only).
 *
 * Reemplaza la idea original de un FAB "ir al carrito" porque comunica
 * más valor: el cliente ve CUÁNTOS items agregó y CUÁNTO va a gastar,
 * no solo un numerito. Es el patrón de Rappi / Didi Food / PedidosYa.
 *
 * Decisión vs FAB:
 *   - FAB solo muestra contador, este banner muestra items + total + CTA
 *     inline. Más denso, más útil.
 *   - El FAB competiría con el botón "Ver carrito" del AddToCartModal
 *     (que se abre cada vez que se agrega un producto). El banner es
 *     persistente y nunca se cierra.
 *   - El banner lee de `cart` directamente, no del state local
 *     `cantidades` (que es lo que se desincronizaba con cart al volver
 *     de /cart). Esto es más robusto: la fuente de verdad es CartContext.
 *
 * Solo mobile: en desktop ya hay un header con el contador en el ícono
 * del carrito, no se duplica acá.
 *
 * A11y: el botón completo es un único foco tab. aria-label describe
 * cuántos items hay para screen readers (el conteo visual es decorativo).
 */
export default function MobileCartBar() {
  const { cart, total } = useCart();
  const navigate = useNavigate();

  // Si no hay carrito, no rendereamos nada. Importante: el return null
  // también evita el pb-20 huérfano en el padre (lo agregamos condicional
  // en RestaurantDetailsPage).
  if (!cart || cart.length === 0) return null;

  // Total de unidades (sumando cantidades si hay productos con qty > 1
  // por modificadores). Coincide con cómo se renderiza el badge en
  // Header.jsx.
  const totalItems = cart.reduce((s, i) => s + (Number(i.cantidad) || 1), 0);

  const handleClick = () => {
    navigate('/cart');
  };

  return (
    <div
      // md:hidden — desktop ya tiene su propio flujo de carrito en el header.
      // bottom-0 + inset-x-0 → fixed full-width en la parte inferior.
      // safe-bottom → respeta home indicator de iOS.
      // z-30 → debajo de modales (z-40+) y de la sticky-nav (z-40), pero
      //         encima del contenido scrolleable.
      className="md:hidden fixed bottom-0 inset-x-0 z-30
                 bg-[color:var(--bg-elevated)] border-t border-[color:var(--border-default)]
                 safe-bottom shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.08)]
                 animate-slideUp"
      role="region"
      aria-label="Resumen del carrito"
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Ver carrito: ${totalItems} ${totalItems === 1 ? 'item' : 'items'}, total ${formatCurrency(total)}`}
        // min-h-[56px] = touch target generoso. justify-between para
        // separar ícono+items del total del CTA derecho.
        className="w-full px-4 py-3 flex items-center justify-between gap-2
                   text-white font-semibold text-sm min-h-[56px]
                   active:scale-[0.98] transition-transform
                   focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2
                   focus:ring-offset-[color:var(--color-primary)]"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {/* Izquierda: ícono carrito + N items */}
        <span className="flex items-center gap-2 min-w-0">
          <ShoppingCart size={18} aria-hidden="true" />
          <span className="truncate">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </span>
        </span>

        {/* Centro: total */}
        <span className="font-extrabold tabular-nums">{formatCurrency(total)}</span>

        {/* Derecha: CTA */}
        <span className="flex items-center gap-1 flex-shrink-0">
          <span className="hidden xs:inline">Ver carrito</span>
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
