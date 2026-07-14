import { History, X } from 'lucide-react';

// Dropdown de "Búsquedas recientes" que se muestra cuando el input está
// vacío. Estilo sincronizado con `SearchAutocomplete.jsx` (mismo shape de
// contenedor, mismo border-radius, mismo patrón de header sticky) para
// que no haya jump visual cuando se intercambian.
//
// Decisiones de diseño (ui-ux-pro-max, jul 2026):
//   - Touch targets ≥ 44px (py-3 en cada item).
//   - Header con icono + label + botón "Borrar todo" como acción secundaria
//     claramente diferenciada.
//   - Hover state sutil con bg-muted/60 (no full opacity, no layout shift).
//   - Border separator con el token del sistema (no hex hardcodeado).
//   - `motion-safe:animate-slideDown` para respetar prefers-reduced-motion.
const RecentSearches = ({ searches, onSelect, onClear }) => {
  if (!searches || searches.length === 0) return null;

  return (
    <div
      className="absolute top-full left-0 w-full mt-2 bg-[color:var(--bg-elevated)] shadow-2xl ring-1 ring-black/5 rounded-xl border border-[color:var(--border-subtle)] overflow-hidden motion-safe:animate-slideDown z-50"
      role="listbox"
      aria-label="Búsquedas recientes"
    >
      {/* Header sticky: queda fijo cuando hay muchos términos y el usuario
          scrollea. Mismo patrón visual que los headers de sección del
          SearchAutocomplete para que la familia sea coherente. */}
      <header className="sticky top-0 z-[1] px-4 py-2.5 bg-[color:var(--bg-elevated)]/95 backdrop-blur-sm border-b border-[color:var(--border-subtle)] flex justify-between items-center">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)] flex items-center gap-1.5">
          <History size={11} aria-hidden="true" />
          Búsquedas recientes
          <span className="ml-1.5 text-[color:var(--text-muted)] font-medium normal-case tracking-normal">
            {searches.length}
          </span>
        </h3>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-primary hover:text-primary-dark motion-safe:transition-colors motion-safe:duration-150 flex items-center gap-1 px-2 py-1 -mr-2 rounded-md hover:bg-[color:var(--bg-muted)] min-h-[32px]"
          >
            <X size={12} aria-hidden="true" />
            Borrar todo
          </button>
        )}
      </header>

      <ul className="max-h-[70dvh] sm:max-h-[460px] overflow-y-auto overscroll-contain py-1">
        {searches.map((term, idx) => (
          <li key={`${term}-${idx}`} role="presentation">
            <button
              type="button"
              role="option"
              onClick={() => onSelect?.(term)}
              className="w-[calc(100%-0.5rem)] mx-1 px-3 sm:px-4 py-3 text-left text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]/60 active:bg-[color:var(--bg-muted)] motion-safe:transition-colors motion-safe:duration-150 flex items-center gap-3 rounded-lg group min-h-[48px]"
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--bg-muted)] group-hover:bg-[color:var(--bg-elevated)] motion-safe:transition-colors flex-shrink-0"
                aria-hidden="true"
              >
                <History size={14} className="text-[color:var(--text-muted)] group-hover:text-primary" />
              </span>
              <span className="flex-1 truncate font-medium">{term}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentSearches;
