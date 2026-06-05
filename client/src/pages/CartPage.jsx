import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, total, clearCart } = useCart();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-center py-12">
          <ShoppingCart size={80} className="text-primary mb-6 mx-auto opacity-30" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-800 mb-3">
            Tu carrito está vacío
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Explora nuestros restaurantes y agrega algunos deliciosos platillos
          </p>
          <Link to="/" className="btn btn-primary btn-lg">
            Explorar Restaurantes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-8">
          Mi Carrito
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Productos */}
          <div className="lg:col-span-2">
            <div className="card-lg space-y-4">
              {cart.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0 animate-slideUp"
                >
                  {/* Imagen */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-light">
                    {item.imagen_url ? (
                      <img
                        src={getImageUrl(item.imagen_url)}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-dark">{item.nombre}</h3>
                    <p className="text-gray-600 mb-2">{formatCurrency(item.precio)}</p>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center gap-2 bg-light px-3 py-2 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      className="text-primary hover:text-primaryDark transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="w-8 text-center font-bold text-gray-800">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      className="text-primary hover:text-primaryDark transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(item.precio * item.cantidad)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <Link to="/" className="btn btn-ghost flex-1">
                Seguir Comprando
              </Link>
              <button
                onClick={clearCart}
                className="btn btn-outline"
              >
                Limpiar Carrito
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="card-lg bg-white sticky top-24 animate-slideUp">
              <h2 className="text-2xl font-heading font-bold text-dark mb-6">
                Resumen del Pedido
              </h2>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío:</span>
                  <span className="text-green-600 font-semibold">Gratis</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Impuestos:</span>
                  <span>{formatCurrency(total * 0.08)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-dark">Total:</span>
                <span className="text-3xl font-heading font-bold text-primary">
                  ${(total * 1.08).toLocaleString('es-CO')}
                </span>
              </div>

              <Link to="/checkout" className="btn btn-primary btn-lg btn-block">
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

