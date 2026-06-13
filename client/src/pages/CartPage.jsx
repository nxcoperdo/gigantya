import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, total, clearCart } = useCart();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center px-4">
        <div className="text-center py-12 max-w-md">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-scaleIn">
            <ShoppingCart size={40} className="text-primary mx-auto" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-gray-800 mb-3">
            Tu carrito está vacío
          </h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-8">
            Explora nuestros restaurantes y agrega algunos deliciosos platillos
          </p>
          <Link to="/" className="btn btn-primary btn-lg min-h-[48px] px-8">
            Explorar Restaurantes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light py-6 sm:py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-4 md:px-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-dark mb-6 sm:mb-8">
          Mi Carrito
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Productos */}
          <div className="lg:col-span-2">
            <div className="card-lg space-y-3 sm:space-y-4">
              {cart.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-gray-200 last:border-0 last:pb-0 animate-slideUp"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Imagen */}
                  <div className="w-full sm:w-24 h-40 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-light">
                    {item.imagen_url ? (
                      <img
                        src={getImageUrl(item.imagen_url)}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-dark truncate">{item.nombre}</h3>
                    <p className="text-gray-600 text-sm sm:text-base">{formatCurrency(item.precio)}</p>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 bg-light px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl">
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-bold text-gray-800 text-base">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Subtotal y Eliminar */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 sm:gap-2">
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      {formatCurrency(item.precio * item.cantidad)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors active:scale-95 touch-feedback"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <Link to="/" className="btn btn-ghost flex-1 min-h-[48px]">
                Seguir Comprando
              </Link>
              <button
                onClick={clearCart}
                className="btn btn-outline flex-1 sm:flex-none min-h-[48px]"
              >
                Limpiar Carrito
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="card-lg bg-white sticky top-20 animate-slideUp">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-dark mb-4 sm:mb-6">
                Resumen del Pedido
              </h2>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                  <span>Envío:</span>
                  <span className="text-green-600 font-semibold">Gratis</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                  <span>Impuestos:</span>
                  <span>{formatCurrency(total * 0.08)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <span className="text-base sm:text-lg font-bold text-dark">Total:</span>
                <span className="text-2xl sm:text-3xl font-heading font-bold text-primary">
                  ${(total * 1.08).toLocaleString('es-CO')}
                </span>
              </div>

              <Link to="/checkout" className="btn btn-primary btn-lg btn-block min-h-[48px]">
                Proceder al Pago
              </Link>

              <p className="text-xs text-gray-500 text-center mt-4">
                Se incluyen impuestos y envío gratis
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

