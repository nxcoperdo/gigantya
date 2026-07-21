import { useState } from 'react';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';

/**
 * Mini popover que aparece cuando el cliente toca "Agregar" en un
 * producto del local 4. Le da a elegir entre:
 *  - "Enviar al chat" → manda el producto como adjunto al chat con
 *    un mensaje "Quiero X".
 *  - "Agregar al carrito" → comportamiento normal (sigue el flujo del
 *    ProductCustomizationModal si el producto tiene modificadores).
 *
 * El botón se renderiza inline debajo del botón "Agregar" original en
 * la card del producto. Si el cliente solo quiere el comportamiento
 * viejo, hace click directamente en "Agregar al carrito" (no se rompe).
 */
export default function ProductQuickSend({ producto, onAddToCart, onSendToChat }) {
  const [mostrar, setMostrar] = useState(false);
  const { cart } = useCart();

  const handleClick = () => {
    setMostrar((v) => !v);
  };

  const handleAddToCart = () => {
    setMostrar(false);
    onAddToCart();
  };

  const handleSendToChat = () => {
    setMostrar(false);
    onSendToChat();
  };

  // Si el carrito está vacío Y no hay chat abierto todavía, ofrecer los dos.
  // Si ya hay productos en el carrito, asumimos que el cliente está en
  // modo "armar pedido" y le mostramos solo "Enviar al chat" (con un
  // texto más explícito).
  const enModoPedido = cart.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={!producto.disponible}
        aria-label={`Opciones para ${producto.nombre}`}
        className="text-white disabled:opacity-50 active:scale-95 touch-feedback min-h-[44px] flex items-center justify-center gap-1.5 sm:mt-4 sm:w-full w-10 h-10 rounded-full p-0 self-end sm:w-full sm:py-3 sm:rounded-md"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <ShoppingCart size={16} aria-hidden="true" className="sm:mr-1.5" />
        <span className="hidden sm:inline text-sm font-semibold">Agregar</span>
      </button>

      {mostrar && (
        <>
          {/* Overlay invisible para cerrar al click fuera */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setMostrar(false)}
            aria-hidden="true"
          />
          <div
            className="absolute z-30 bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            role="menu"
          >
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                ¿Cómo quieres pedir <span className="font-semibold">{producto.nombre}</span>?
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendToChat}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm"
            >
              <MessageCircle size={16} className="text-[var(--color-primary)] flex-shrink-0" />
              <span>
                <span className="font-medium block">
                  {enModoPedido ? 'Sumar al chat' : 'Enviar al chat'}
                </span>
                <span className="text-xs text-gray-500 block">
                  {enModoPedido
                    ? 'Lo agregamos a la conversación con el local'
                    : 'El local te pregunta qué necesitás y arma el pedido'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm border-t border-gray-100 dark:border-gray-700"
            >
              <ShoppingCart size={16} className="text-gray-600 flex-shrink-0" />
              <span>
                <span className="font-medium block">Agregar al carrito</span>
                <span className="text-xs text-gray-500 block">
                  Pides tú, pagas online
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
