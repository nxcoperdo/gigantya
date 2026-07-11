import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Tour paso a paso para CLIENTES en la HomePage (Capa 2 del manual
 * contextual — versión cliente).
 *
 * Es un clon del DashboardTour, sin la lógica de `activateTab`
 * (la home es una sola vista, no hay tabs que cambiar). Se mantiene
 * como componente separado para no acoplar los 2 tours: si en el
 * futuro el tour del cliente necesita flujos distintos (ej: paso
 * condicional a RestaurantDetailsPage), no tocamos el del dueño.
 *
 * Estructura de cada step:
 *   - target:       selector CSS del elemento a resaltar
 *   - title:        título visible
 *   - description:  descripción breve (2-4 oraciones)
 *   - side:         posición preferida del popover
 *
 * Accesibilidad:
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - focus automático al cambiar de step
 *   - Escape cierra el tour (y marca como completado)
 *   - prefers-reduced-motion respetado
 *   - body scroll bloqueado mientras el tour está abierto
 */
const STEPS = [
  {
    target: '[data-tour="home-search"]',
    title: '🔍 Buscar locales o productos',
    description: 'Escribe el nombre de un local, un plato o una categoría. La búsqueda se actualiza mientras escribes.',
    side: 'bottom',
  },
  {
    target: '[data-tour="home-toggle-domicilio"]',
    title: '🚚 Con o sin domicilio',
    description: 'Elige si quieres ver locales que envían a domicilio o solo los que reciben pedidos para retirar en el mostrador.',
    side: 'bottom',
  },
  {
    target: '[data-tour="home-toggle-nicho"]',
    title: '🍔 Filtrar por tipo de local',
    description: 'Aquí separas restaurantes, comida rápida, mercados y panaderías. Toca uno para ver solo ese tipo.',
    side: 'bottom',
  },
  {
    target: '[data-tour="home-categorias"]',
    title: '🏷️ Filtrar por categoría',
    description: 'Las categorías te permiten acotar la lista: hamburguesas, pizzas, desayunos, etc. Toca una y la lista se actualiza.',
    side: 'bottom',
  },
  {
    target: '[data-tour="home-badge-abierto"]',
    title: '🟢 Abierto o cerrado',
    description: 'El punto verde significa que el local está abierto ahora. El rojo, que está cerrado. Los locales cerrados aparecen atenuados y no se puede pedir.',
    side: 'left',
  },
  {
    target: '[data-tour="home-card-local"]',
    title: '👆 Cómo pedir',
    description: 'Toca la tarjeta de un local para ver su menú. Desde ahí eliges los productos, los agregas al carrito y confirmas el pedido.',
    side: 'left',
  },
  {
    target: '[data-tour="home-fab-help"]',
    title: '❓ ¿Necesitas ayuda?',
    description: 'Este botón "?" siempre está disponible. Te abre este tour cuando quieras o te lleva al soporte.',
    side: 'left',
  },
];

export default function ClientTour({ onClose }) {
  const { refreshUser } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [targetFound, setTargetFound] = useState(true);
  const firstButtonRef = useRef(null);
  // Se persiste solo 1 vez (en handleClose) para no golpear la API
  // cada vez que el user navega entre steps.
  const completedRef = useRef(false);

  const currentStep = STEPS[stepIndex];

  const recomputeRect = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTargetFound(false);
      setTargetRect(null);
      return;
    }
    setTargetFound(true);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, 280);
  }, [currentStep]);

  useEffect(() => {
    recomputeRect();
    window.addEventListener('resize', recomputeRect);
    window.addEventListener('scroll', recomputeRect, true);
    return () => {
      window.removeEventListener('resize', recomputeRect);
      window.removeEventListener('scroll', recomputeRect, true);
    };
  }, [recomputeRect]);

  useEffect(() => {
    if (firstButtonRef.current) firstButtonRef.current.focus();
  }, [stepIndex]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(async () => {
    onClose();
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      await userService.setOnboardingKey('onboarding.client_tour_completed', true);
      if (refreshUser) await refreshUser();
    } catch (err) {
      console.error('[ClientTour] no se pudo persistir completed:', err?.response?.data?.error || err.message);
    }
  }, [onClose, refreshUser]);

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else handleClose();
  };
  const prev = () => { if (stepIndex > 0) setStepIndex(stepIndex - 1); };

  const popoverStyle = useMemo(
    () => computePopoverPosition(targetRect, currentStep?.side),
    [targetRect, currentStep]
  );

  if (!currentStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[110]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-tour-step-title"
    >
      {targetRect ? (
        <>
          <div
            className="absolute bg-black/65 transition-all duration-200"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - 8) }}
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="absolute bg-black/65 transition-all duration-200"
            style={{
              top: Math.max(0, targetRect.top - 8),
              left: 0,
              width: Math.max(0, targetRect.left - 8),
              height: targetRect.height + 16,
            }}
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="absolute bg-black/65 transition-all duration-200"
            style={{
              top: Math.max(0, targetRect.top - 8),
              left: targetRect.left + targetRect.width + 8,
              right: 0,
              height: targetRect.height + 16,
            }}
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="absolute bg-black/65 transition-all duration-200"
            style={{
              top: targetRect.top + targetRect.height + 8,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="absolute border-2 border-primary rounded-lg pointer-events-none animate-fadeIn motion-reduce:animate-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            aria-hidden="true"
          />
        </>
      ) : !targetFound ? (
        <div
          className="absolute inset-0 bg-black/65"
          onClick={handleClose}
          aria-hidden="true"
        />
      ) : null}

      <div
        className="absolute bg-white dark:bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl p-4 sm:p-5 w-[min(360px,90vw)] border border-gray-200 dark:border-gray-700 animate-fadeIn motion-reduce:animate-none"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 id="client-tour-step-title" className="text-base sm:text-lg font-bold text-[color:var(--text-primary)] pr-2">
            {currentStep.title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar tour"
            className="flex-shrink-0 -mr-1 -mt-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-[color:var(--text-secondary)] mb-4 leading-relaxed">
          {currentStep.description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[color:var(--text-muted)] font-medium">
            Paso {stepIndex + 1} de {STEPS.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              ref={isFirst ? firstButtonRef : null}
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-[color:var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed min-h-[36px] inline-flex items-center gap-0.5"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <button
              ref={!isFirst ? firstButtonRef : null}
              type="button"
              onClick={next}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-transform min-h-[36px] inline-flex items-center gap-0.5"
            >
              <span>{isLast ? 'Finalizar' : 'Siguiente'}</span>
              {!isLast && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="mt-3 w-full text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] underline min-h-[32px]"
        >
          Saltar tour
        </button>
      </div>
    </div>
  );
}

function computePopoverPosition(rect, preferredSide) {
  if (!rect || (typeof window !== 'undefined' && (window.innerWidth < 640 || rect.width < 80 || rect.height < 80))) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxHeight: '80vh',
      overflowY: 'auto',
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const POPOVER_W = 360;
  const POPOVER_H_ESTIMATE = 220;
  const GAP = 16;
  const EDGE = 12;

  const fits = (top, left) =>
    top >= EDGE &&
    left >= EDGE &&
    top + POPOVER_H_ESTIMATE <= vh - EDGE &&
    left + POPOVER_W <= vw - EDGE;

  const clampLeft = (left) => Math.max(EDGE, Math.min(left, vw - POPOVER_W - EDGE));

  if (preferredSide === 'bottom') {
    const top = rect.top + rect.height + GAP;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }
  {
    const top = rect.top + rect.height + GAP;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }
  {
    const top = rect.top - GAP - POPOVER_H_ESTIMATE;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }
  if (rect.left + rect.width + GAP + POPOVER_W <= vw - EDGE) {
    const top = Math.max(EDGE, Math.min(rect.top, vh - POPOVER_H_ESTIMATE - EDGE));
    return { top, left: rect.left + rect.width + GAP };
  }
  if (rect.left - GAP - POPOVER_W >= EDGE) {
    const top = Math.max(EDGE, Math.min(rect.top, vh - POPOVER_H_ESTIMATE - EDGE));
    return { top, left: rect.left - GAP - POPOVER_W };
  }
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxHeight: '80vh',
    overflowY: 'auto',
  };
}
