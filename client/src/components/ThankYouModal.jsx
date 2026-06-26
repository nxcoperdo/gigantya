import React from 'react';
import { Check } from 'lucide-react';

const ThankYouModal = ({ isOpen, onClose, message = '¡Gracias por tu calificación!' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[color:var(--bg-elevated)] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-scaleUp">
        <div className="p-8 flex flex-col items-center gap-4">
          <div
            className="rounded-full p-4"
            style={{ backgroundColor: 'var(--success-bg)' }}
          >
            <Check size={36} style={{ color: 'var(--success-text)' }} />
          </div>
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">{message}</h3>
          <p className="text-sm text-[color:var(--text-muted)] text-center">Tu opinión ayuda a mejorar el servicio.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThankYouModal;

