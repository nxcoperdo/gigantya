import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

const RatingModal = ({ isOpen, onClose, restaurantName, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Por favor selecciona una puntuación');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await onSubmit({ rating, comment });
      onClose();
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError('Error al enviar la calificación. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-dark">Calificar Restaurante</h2>
            <p className="text-sm text-gray-500">¿Qué te pareció {restaurantName}?</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center">
          {/* Star Rating */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                className="transition-transform duration-200 hover:scale-125 active:scale-90"
                onClick={() => setRating(num)}
                onMouseEnter={() => setHover(num)}
                onMouseLeave={() => setHover(0)}
              >
                <Star
                  size={40}
                  fill={(hover || rating) >= num ? 'currentColor' : 'none'}
                  className={`transition-colors duration-200 ${
                    (hover || rating) >= num ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment Field */}
          <div className="w-full space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1">Tu experiencia (opcional)</label>
            <textarea
              className="w-full p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none h-32"
              placeholder="Cuéntanos más sobre la comida, la entrega..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 flex gap-3">
          {error && (
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-16 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm shadow-sm animate-fadeIn">
              {error}
            </div>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-primary text-white hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
          >
            {loading ? 'Enviando...' : 'Enviar Calificación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
