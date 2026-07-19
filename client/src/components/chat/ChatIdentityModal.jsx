import { useState } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { X } from 'lucide-react';

/**
 * Modal que pide nombre y teléfono la primera vez que el cliente abre
 * el chat con un local. Se persiste en localStorage (clave por
 * restaurante) para no volver a pedirlo.
 */
export default function ChatIdentityModal() {
  const { identityNeeded, setIdentityNeeded, saveIdentity, identity } = useChat();
  const [nombre, setNombre] = useState(identity.nombre || '');
  const [telefono, setTelefono] = useState(identity.telefono || '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  if (!identityNeeded) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await saveIdentity({ nombre, telefono });
    } catch (e2) {
      setErr(e2.message || 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const telLimpio = telefono.replace(/\D/g, '');
  const telValido = telLimpio.length >= 7 && telLimpio.length <= 15;
  const nombreValido = nombre.trim().length >= 2;
  const puedeEnviar = nombreValido && telValido && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50"
      onClick={() => setIdentityNeeded(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full p-5 sm:p-6 pb-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Escríbenos al local
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Decinos qué necesitás y te armamos el pedido.
            </p>
          </div>
          <button
            onClick={() => setIdentityNeeded(false)}
            aria-label="Cerrar"
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tu nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
              minLength={2}
              maxLength={100}
              placeholder="Cómo te llamamos"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tu teléfono (WhatsApp)
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              inputMode="tel"
              placeholder="3001234567"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base tabular-nums"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lo usa el local para avisarte cuando tu pedido esté listo.
            </p>
          </div>

          {err && (
            <div className="text-sm text-red-600 dark:text-red-400">{err}</div>
          )}

          <button
            type="submit"
            disabled={!puedeEnviar}
            className="w-full py-3 rounded-md font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-transform touch-manipulation"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {submitting ? 'Abriendo chat…' : 'Empezar a chatear'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            No necesitás registrarte. Tu número queda en este local.
          </p>
        </form>
      </div>
    </div>
  );
}
