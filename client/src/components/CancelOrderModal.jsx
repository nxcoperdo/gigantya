import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Ban } from 'lucide-react';

// Métodos de pago por los que el cliente YA transfirió dinero. Cuando el
// pedido se cancela, el local tiene que devolver la plata por su cuenta.
// Contra entrega (efectivo al recibir) NO requiere devolución.
const PAYMENT_METHODS_REQUIRING_REFUND = new Set(['nequi', 'daviplata', 'bre_b']);

/**
 * Modal para cancelar un pedido.
 *
 * Pide un motivo obligatorio (mínimo 3 chars) y, si el pedido fue pagado
 * por transferencia, muestra un warning visual avisando que el cliente
 * tiene que coordinar la devolución con el local.
 *
 * El backend (PUT /api/orders/:id/cancel) valida:
 *   - motivo ≥ 3 chars
 *   - estado permitido para cliente (Pendiente, Comprobante Enviado,
 *     Pago Confirmado, Pago Rechazado)
 *
 * Props:
 *   - isOpen:     bool
 *   - onClose:    () => void
 *   - order:      pedido a cancelar (necesita id, restaurante_nombre, metodo_pago)
 *   - onConfirm:  async (motivo: string) => void  — tira la cancelación al backend
 */
export default function CancelOrderModal({ isOpen, onClose, order, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Reset state cada vez que se abre
  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setError('');
      // Pequeño delay para que termine la animación del modal antes de focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const requiresRefund = PAYMENT_METHODS_REQUIRING_REFUND.has(order.metodo_pago);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = motivo.trim();
    if (trimmed.length < 3) {
      setError('Por favor contanos el motivo (mínimo 3 caracteres).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirm(trimmed);
      // Si el confirm fue OK, el padre cierra el modal. Si tira error,
      // lo mostramos acá.
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'No pudimos cancelar el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const motivoLength = motivo.trim().length;
  const canSubmit = !loading && motivoLength >= 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-title"
    >
      <div className="relative bg-[color:var(--bg-elevated)] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-[color:var(--border-subtle)] flex justify-between items-center bg-[color:var(--bg-subtle)]/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="cancel-order-title" className="text-lg sm:text-xl font-bold text-[color:var(--text-primary)]">
                Cancelar pedido
              </h2>
              <p className="text-sm text-[color:var(--text-muted)] truncate">
                #{order.id} · {order.restaurante_nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
            className="flex-shrink-0 p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X size={20} className="text-[color:var(--text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning: si el pedido fue pagado por transferencia, el cliente
              debe saber que tiene que coordinar la devolución con el local. */}
          {requiresRefund && (
            <div
              role="note"
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2"
            >
              <AlertCircle
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
                Este pedido fue pagado por <strong>{order.metodo_pago}</strong>. Vas a tener que
                coordinar la devolución del dinero con el local.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="cancel-motivo"
              className="text-sm font-medium text-[color:var(--text-secondary)] block"
            >
              ¿Por qué quieres cancelar? <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="cancel-motivo"
              ref={inputRef}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Me equivoqué de producto, tardaron mucho en confirmar..."
              rows={4}
              disabled={loading}
              aria-required="true"
              aria-invalid={motivoLength > 0 && motivoLength < 3}
              className="w-full p-3 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none disabled:opacity-60"
            />
            <p className="text-xs text-[color:var(--text-muted)] text-right">
              <span className={motivoLength > 0 && motivoLength < 3 ? 'text-red-500 font-semibold' : ''}>
                {motivoLength} caracteres
              </span>
              {' '}(mínimo 3)
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[color:var(--border-default)] text-[color:var(--text-secondary)] font-semibold hover:bg-[color:var(--bg-muted)] transition-colors disabled:opacity-50 min-h-[44px]"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-h-[44px] active:scale-95 motion-reduce:active:scale-100"
            >
              {loading ? 'Cancelando…' : 'Sí, cancelar pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
