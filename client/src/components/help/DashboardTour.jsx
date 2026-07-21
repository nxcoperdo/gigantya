import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

/**
 * Tour paso a paso del dashboard (Capa 2 del manual contextual).
 *
 * Hecho a mano (sin driver.js / react-joyride) para:
 *   - 0 KB extra de bundle
 *   - control total de estilos y accesibilidad
 *   - respeto de prefers-reduced-motion
 *
 * Estructura de cada step:
 *   - target:       selector CSS del elemento a resaltar (usamos `data-tour="..."`)
 *   - title:        título visible
 *   - description:  descripción breve (2-4 oraciones, una sola idea por oración)
 *   - side:         posición preferida del popover ('bottom' | 'top' | 'left' | 'right')
 *   - activateTab?: id del tab al que cambiar antes de iluminar (opcional).
 *                   Cuando el step pide cambiar de tab, el tour dispara el
 *                   callback `onActivateTab(tabId)` antes de hacer scroll,
 *                   y le da 320ms extra al render del nuevo tab antes de
 *                   medir el rect.
 *
 * Funciona en mobile: si el viewport es < 640px o el target es muy chico,
 * el popover se centra en pantalla con scroll interno.
 *
 * Accesibilidad:
 *   - role="dialog" + aria-modal="true" + aria-labelledby
 *   - focus al primer botón al cambiar de step
 *   - Escape cierra el tour (y marca como completado)
 *   - prefers-reduced-motion desactivado via tailwind `motion-reduce:`
 *   - body scroll bloqueado mientras el tour está abierto
 */
const STEPS = [
  {
    target: 'h1',
    title: '👋 Bienvenido a tu dashboard',
    description: 'Arriba tienes 3 cosas clave: el saldo actual, el plan que tienes contratado y los datos de tu local. Todos se pueden editar desde "Mi cuenta" cuando quieras.',
    side: 'bottom',
  },
  {
    target: '[data-tour="dashboard-refresh"]',
    title: '🔄 Refrescar datos',
    description: 'Los pedidos, ventas y productos se actualizan solos cada 7 segundos. Pero si hiciste algo en otra pestaña o quieres forzar la actualización, haz click aquí. La hora de la última actualización aparece al lado.',
    side: 'bottom',
  },
  {
    target: '[data-tour="dashboard-shipping"]',
    title: '🚚 Envíos e Impuestos',
    description: 'Aquí configuras cuánto cobras por envío a domicilio, el porcentaje de impuesto (IVA) y si quieres aceptar retiro en local. Lo configuras UNA vez y se aplica a todos los pedidos hasta que lo vuelvas a cambiar.',
    side: 'bottom',
  },
  {
    target: '[data-tour="dashboard-tab-pedidos"]',
    title: '📋 Pestaña Pedidos',
    description: 'Aquí ves los pedidos que van entrando en tiempo real. Cada pedido pasa por 4 estados: Pendiente → Preparando → Listo → Entregado. Cámbialos a medida que avanza. También puedes imprimir la comanda o cancelar un pedido si el cliente se arrepiente.',
    side: 'bottom',
    activateTab: 'orders',
  },
  {
    target: '[data-tour="dashboard-tab-gestion"]',
    title: '⚙️ Pestaña Gestión',
    description: 'Aquí viven tus productos, categorías y modificadores. Lo que publiques aquí lo ven tus clientes en la página del local. Te mostramos 2 cosas clave de esta pestaña:',
    side: 'bottom',
    activateTab: 'management',
  },
  {
    target: '[data-tour="dashboard-new-product"]',
    title: '➕ Nuevo producto',
    description: 'Haz click en "+ Nuevo producto" para crear uno. Necesitas: nombre, precio, descripción corta, foto, categoría. Si tiene modificadores (ej: "Tamaño grande", "Sin cebolla") los agregas aparte. Error común: olvidar marcar el switch "Disponible" al final antes de guardar — el producto queda creado pero no se muestra al cliente.',
    side: 'bottom',
  },
  {
    target: '[data-tour="dashboard-toggle-product"]',
    title: '⏸️ Pausar y reanudar productos',
    description: 'El switch verde/rojo a la izquierda de cada producto te permite pausarlo sin eliminarlo. Útil cuando se te agota un ingrediente a la noche, o para sacar de la carta un plato solo los lunes. Cuando lo reactivas, vuelve a aparecer automáticamente.',
    side: 'bottom',
  },
  {
    target: '[data-tour="dashboard-tab-menu-dia"]',
    title: '📅 Pestaña Menú del día',
    description: 'Si manejas corrientazo (el desayuno o almuerzo que cambia cada día), esta pestaña es para ti. Armas una plantilla semanal: para cada día eliges el combo de desayuno y el de almuerzo. La app le muestra a tus clientes solo el combo de hoy y rota sola cada semana, sin que tengas que hacer nada.',
    side: 'bottom',
    activateTab: 'menu-dia',
  },
  {
    target: '[data-tour="dashboard-tab-menu-dia"]',
    title: '🍽️ Cómo cargar un combo',
    description: 'Haz click en la casilla del día (Desayuno o Almuerzo) y luego en "Crear nuevo". Escribe el nombre (ej: "Almuerzo del día"), los componentes (sopa, principio, proteína, jugo), el precio y una foto. Puedes reutilizar el mismo combo en varios días eligiéndolo desde "Combos existentes". Opcional: define las franjas horarias para que cada comida se muestre a su hora.',
    side: 'bottom',
    activateTab: 'menu-dia',
  },
  {
    target: '[data-tour="dashboard-tab-pagos"]',
    title: '💰 Pestaña Pagos',
    description: 'Aquí tienes dos cosas: la sub-pestaña "Validación de Comprobantes" donde apruebas o rechazas los comprobantes que te mandan los clientes, y "Configuración de Pagos" donde escribes tu número de Nequi, Daviplata o BRE-B para que el cliente los vea al pedir y pueda transferirte directo.',
    side: 'bottom',
    activateTab: 'payments',
  },
  {
    target: '[data-tour="dashboard-tab-cupones"]',
    title: '🎟️ Pestaña Cupones',
    description: 'Crea cupones de descuento para tus clientes: por porcentaje (ej: 20% off) o monto fijo (ej: $5.000 off). Define vigencia, cantidad máxima de usos y el código que el cliente ingresa al pedir. Ejemplo: "VERANO20" para 20% los lunes.',
    side: 'bottom',
    activateTab: 'coupons',
  },
  {
    target: '[data-tour="dashboard-tab-stats"]',
    title: '📊 Pestaña Estadísticas',
    description: 'Conoce tu hora pico, tus 10 productos más vendidos, clientes recurrentes vs nuevos, tasa de cancelación, tiempo promedio de preparación y ticket promedio. Todo exportable a Excel para que lleves tu propio registro.',
    side: 'bottom',
    activateTab: 'stats',
  },
  {
    target: '[data-tour="dashboard-fab-help"]',
    title: '❓ ¿Te olvidaste algo?',
    description: 'Este botón "?" lo tienes siempre disponible abajo a la derecha. Te abre este tour de nuevo o te lleva al soporte. También vas a ver tips contextuales en cada pestaña — aparecen arriba de todo y se silencian con un click.',
    side: 'left',
  },
];

export default function DashboardTour({ onClose, onActivateTab }) {
  const { refreshUser, setUserFromResponse } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [targetFound, setTargetFound] = useState(true);
  const firstButtonRef = useRef(null);
  // Se persiste solo 1 vez (en handleClose) para evitar golpear la API
  // cada vez que el user navega entre steps.
  const completedRef = useRef(false);

  const currentStep = STEPS[stepIndex];

  // Calcular posición del target y hacer scrollIntoView. Recalcula en
  // cada cambio de step y cada vez que el viewport cambia (resize/scroll).
  //
  // Si el step pide `activateTab`, disparamos el callback del padre
  // ANTES de buscar el target. Esto le da tiempo al nuevo tab de
  // renderear antes de que midamos el rect (320ms en vez de 280ms).
  const recomputeRect = useCallback(() => {
    if (!currentStep) return;
    if (currentStep.activateTab && onActivateTab) {
      onActivateTab(currentStep.activateTab);
    }
    const el = document.querySelector(currentStep.target);
    if (!el) {
      // Target no presente: el popover se centra en pantalla para no
      // romper el flujo. Útil para steps que aún no se renderizaron
      // (p.ej. el tab "Stats" en plan basico).
      setTargetFound(false);
      setTargetRect(null);
      return;
    }
    setTargetFound(true);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Esperamos un poco para que el smooth scroll + el render del tab
    // (si hubo activateTab) terminen antes de medir el rect.
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, currentStep.activateTab ? 320 : 280);
  }, [currentStep, onActivateTab]);

  useEffect(() => {
    recomputeRect();
    window.addEventListener('resize', recomputeRect);
    window.addEventListener('scroll', recomputeRect, true);
    return () => {
      window.removeEventListener('resize', recomputeRect);
      window.removeEventListener('scroll', recomputeRect, true);
    };
  }, [recomputeRect]);

  // Focus automático al cambiar step (accesibilidad teclado).
  useEffect(() => {
    if (firstButtonRef.current) firstButtonRef.current.focus();
  }, [stepIndex]);

  // Bloquear scroll del body mientras el tour está abierto. Restauramos
  // el valor original (no siempre '') por si la página ya estaba en un
  // estado especial (poco probable, pero defendámonos).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape cierra el tour (y marca como completado).
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
      // Sincronizamos con el `usuario` que devuelve el PUT (incluye
      // `otros_datos.onboarding.dashboard_tour_completed = true`),
      // no con un round-trip a /profile. Esto evita que el auto-tour
      // se vuelva a disparar si React remonta el padre antes de que
      // llegue el refresh.
      const res = await userService.setOnboardingKey('onboarding.dashboard_tour_completed', true);
      if (res?.usuario && setUserFromResponse) {
        setUserFromResponse(res.usuario);
      } else if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      console.error('[DashboardTour] no se pudo persistir completed:', err?.response?.data?.error || err.message);
    }
  }, [onClose, refreshUser, setUserFromResponse]);

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
      aria-labelledby="tour-step-title"
    >
      {/* Backdrop con cutout: 4 paneles que forman un marco alrededor del
          target. El click en cualquier panel cierra el tour. Si el target
          no existe, solo se muestra el backdrop uniforme (sin marco). */}
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

          {/* Highlight ring: marco visual alrededor del target. */}
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

      {/* Popover con el contenido del step */}
      <div
        className="absolute bg-white dark:bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl p-4 sm:p-5 w-[min(360px,90vw)] border border-gray-200 dark:border-gray-700 animate-fadeIn motion-reduce:animate-none"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 id="tour-step-title" className="text-base sm:text-lg font-bold text-[color:var(--text-primary)] pr-2">
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

/**
 * Decide dónde colocar el popover en función de la posición del target
 * y del viewport.
 *
 * Reglas:
 *   - Si no hay rect (target no encontrado) → centrado.
 *   - Si el viewport es chico (<640px) o el target es muy chico (<80px)
 *     → centrado (no hay espacio para anclar bien).
 *   - Si no, intenta la `preferredSide`. Si no entra, busca arriba,
 *     derecha o izquierda, en ese orden.
 */
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
  const POPOVER_H_ESTIMATE = 220; // estimación; el contenido real puede ser más alto
  const GAP = 16;
  const EDGE = 12;

  const fits = (top, left) =>
    top >= EDGE &&
    left >= EDGE &&
    top + POPOVER_H_ESTIMATE <= vh - EDGE &&
    left + POPOVER_W <= vw - EDGE;

  const clampLeft = (left) => Math.max(EDGE, Math.min(left, vw - POPOVER_W - EDGE));

  // 1) preferredSide = bottom (caso más común en este tour)
  if (preferredSide === 'bottom') {
    const top = rect.top + rect.height + GAP;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }

  // 2) bottom sin preferredSide también
  {
    const top = rect.top + rect.height + GAP;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }

  // 3) top
  {
    const top = rect.top - GAP - POPOVER_H_ESTIMATE;
    const left = clampLeft(rect.left);
    if (fits(top, left)) return { top, left };
  }

  // 4) right
  if (rect.left + rect.width + GAP + POPOVER_W <= vw - EDGE) {
    const top = Math.max(EDGE, Math.min(rect.top, vh - POPOVER_H_ESTIMATE - EDGE));
    return { top, left: rect.left + rect.width + GAP };
  }

  // 5) left
  if (rect.left - GAP - POPOVER_W >= EDGE) {
    const top = Math.max(EDGE, Math.min(rect.top, vh - POPOVER_H_ESTIMATE - EDGE));
    return { top, left: rect.left - GAP - POPOVER_W };
  }

  // 6) fallback: centrado
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxHeight: '80vh',
    overflowY: 'auto',
  };
}
