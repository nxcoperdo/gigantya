import React from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function ErrorMessageModal({ isOpen, onClose, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleUp">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">Hubo un problema</h3>
          <p className="text-gray-600 mb-8">
            {message || 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.'}
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark transition-colors shadow-md"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
