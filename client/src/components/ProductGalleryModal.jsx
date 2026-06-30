import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Lightbox de galería de producto.
 * - Mobile: swipe horizontal con handlers touch nativos (drag en tiempo real,
 *   snap a la imagen más cercana al soltar, resistencia en los extremos).
 * - Desktop: flechas laterales + dots clickeables.
 * - Teclado: ESC cierra, flechas ←/→ navegan.
 * - Una sola imagen: no muestra dots ni flechas.
 *
 * Implementación: un track flex se mueve con `transform: translateX(-N%) +
 * dragOffset` y `transition: transform 350ms`. El drag desactiva la
 * transición (sigue el dedo). Al soltar, snap a la imagen más cercana.
 *
 * Props:
 *   isOpen:       boolean
 *   onClose:      () => void
 *   images:       string[]   URLs absolutas (producto.imagen_url ya procesado por getImageUrl)
 *   productName:  string
 */
export default function ProductGalleryModal({ isOpen, onClose, images = [], productName = '' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const containerRef = useRef(null);

  // Reset al cambiar de producto o al reabrir
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [isOpen, images]);

  // Lock del scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const goTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(index, images.length - 1));
    setActiveIndex(clamped);
  }, [images.length]);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Teclado: ESC cierra, flechas navegan
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, next, prev]);

  // Swipe handlers (touch)
  const handleTouchStart = (e) => {
    if (images.length <= 1) return;
    // Si el touch empieza sobre un botón (flecha o dot), ignorar — el botón
    // se encarga. Evita swipe fantasma al tappear una flecha accidentalmente.
    if (e.target.closest('button')) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    // Resistencia en los extremos: si está en la primera y arrastra a la
    // derecha, o en la última y arrastra a la izquierda, aplica 30% de
    // resistencia. Evita que se "salga" del track.
    const atEdge = (activeIndex === 0 && deltaX > 0) || (activeIndex === images.length - 1 && deltaX < 0);
    setDragOffset(deltaX * (atEdge ? 0.3 : 1));
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / elapsed; // px/ms
    const containerWidth = containerRef.current?.clientWidth || 0;
    const threshold = containerWidth * 0.2;
    // Avanza si pasó el 20% del ancho O la velocidad es alta
    if (Math.abs(deltaX) > threshold || velocity > 0.5) {
      if (deltaX < 0) goTo(activeIndex + 1);
      else goTo(activeIndex - 1);
    }
    setIsDragging(false);
    setDragOffset(0);
  };

  // Cerrar al click en el backdrop (no en el modal)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;
  if (images.length === 0) return null;

  const trackTransform = `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`;
  const trackTransition = isDragging ? 'none' : 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header absoluto */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 sm:p-5 text-white bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold line-clamp-1 drop-shadow-md">
              {productName}
            </h2>
            {images.length > 1 && (
              <p className="text-xs sm:text-sm text-white/80 mt-0.5 drop-shadow">
                {activeIndex + 1} / {images.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all touch-feedback pointer-events-auto flex-shrink-0 ml-2"
            aria-label="Cerrar galería"
          >
            <X size={24} />
          </button>
        </div>

        {/* Track de imágenes (transform) */}
        <div
          className="absolute inset-0 flex"
          style={{
            transform: trackTransform,
            transition: trackTransition,
            willChange: 'transform',
          }}
        >
          {images.map((url, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-full h-full flex items-center justify-center p-12 sm:p-16"
            >
              <img
                src={url}
                alt={`${productName} - foto ${i + 1}`}
                className="max-w-full max-h-full object-contain select-none"
                draggable="false"
                onDragStart={(e) => e.preventDefault()}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* Flechas desktop (absolutas, centradas verticalmente en la pantalla) */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={activeIndex === 0}
              className="hidden sm:flex absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 touch-feedback"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={next}
              disabled={activeIndex === images.length - 1}
              className="hidden sm:flex absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 touch-feedback"
              aria-label="Siguiente foto"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Dots (absolutos abajo, no compiten con la imagen) */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-1 px-4">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Ir a foto ${i + 1}`}
                className="group p-1.5 touch-feedback"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? 'w-8 h-2 bg-white'
                      : 'w-2 h-2 bg-white/40 group-hover:bg-white/70 group-active:bg-white'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
