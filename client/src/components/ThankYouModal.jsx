import React from 'react';
import { Check } from 'lucide-react';

const ThankYouModal = ({ isOpen, onClose, message = '¡Gracias por tu calificación!' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-scaleUp">
        <div className="p-8 flex flex-col items-center gap-4">
          <div className="rounded-full bg-green-100 p-4">
            <Check size={36} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{message}</h3>
          <p className="text-sm text-gray-500 text-center">Tu opinión ayuda a mejorar el servicio.</p>
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

