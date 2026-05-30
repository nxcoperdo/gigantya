import { useEffect } from 'react';
import { Check, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AddToCartModal({ isOpen, onClose, producto, cantidad }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !producto) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 animate-scaleIn pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="text-green-600 w-12 h-12 animate-scaleIn" strokeWidth={3} />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-dark mb-2">
              ¡Agregado al carrito!
            </h2>
            <p className="text-gray-600 mb-4">
              {producto.nombre}
            </p>

            {/* Product Info */}
            <div className="bg-light rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Cantidad:</span>
                <span className="text-2xl font-bold text-primary">{cantidad}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Precio unitario:</span>
                <span className="text-xl font-semibold text-dark">
                  ${producto.precio?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between">
                <span className="text-gray-700 font-semibold">Subtotal:</span>
                <span className="text-2xl font-bold text-primary">
                  ${(producto.precio * cantidad).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn btn-outline flex-1"
            >
              Seguir Comprando
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/cart');
              }}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              Ver Carrito
            </button>
          </div>

          {/* Auto-close message */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Se cerrará automáticamente en 5 segundos
          </p>
        </div>
      </div>
    </>
  );
}

