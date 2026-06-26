import { useEffect } from 'react';
import { Check, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatHelper';

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
        <div className="relative bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 animate-scaleIn pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] transition-colors p-1 rounded-lg hover:bg-[color:var(--bg-muted)] active:scale-95 touch-feedback"
            aria-label="Cerrar"
          >
            <X size={24} />
          </button>

          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--success-bg)' }}
            >
              <Check className="w-12 h-12 animate-scaleIn" strokeWidth={3} style={{ color: 'var(--success-text)' }} />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-2">
              ¡Agregado al carrito!
            </h2>
            <p className="text-[color:var(--text-secondary)] mb-4">
              {producto.nombre}
            </p>

            {/* Product Info */}
            <div className="bg-[color:var(--bg-subtle)] rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[color:var(--text-secondary)]">Cantidad:</span>
                <span className="text-2xl font-bold text-primary">{cantidad}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--text-secondary)]">Precio unitario:</span>
                <span className="text-xl font-semibold text-[color:var(--text-primary)]">
                  {formatCurrency(producto.precio)}
                </span>
              </div>
              <div className="border-t border-[color:var(--border-default)] mt-3 pt-3 flex items-center justify-between">
                <span className="text-[color:var(--text-secondary)] font-semibold">Subtotal:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(producto.precio * cantidad)}
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
          <p className="text-xs text-[color:var(--text-muted)] text-center mt-4">
            Se cerrará automáticamente en 5 segundos
          </p>
        </div>
      </div>
    </>
  );
}

