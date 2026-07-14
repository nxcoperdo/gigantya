import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Store, AlertCircle, Sparkles, Utensils } from 'lucide-react';
import { searchService } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getImageUrl, IMAGE_DEFAULT_ATTRS } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import RecentSearches from './RecentSearches';

// Debounce del fetch de sugerencias. Mantenemos 250ms (sweet spot entre
// instantáneo y "no martillar el server"). El componente padre actualiza el
// input en vivo; este delay solo aplica al refetch del backend.
const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_MIN_CHARS = 2;

// Altura máxima del dropdown. En desktop lo dejamos cómodo de escanear
// sin tapar todo el hero; en móvil le damos viewport-aware (60dvh) para
// que pueda scrollear internamente sin chocar con el scroll de la home
// y sin quedar tapado por la barra del browser. `overscroll-contain`
// evita el "scroll chaining" (que siga scrolleando la home por debajo).
// 70dvh en lugar de 60dvh para que en mobile se sienta más generoso
// (típicamente ~430-500px en un phone, suficiente para 2-3 items
// visibles sin scrollear, lo que ayuda al usuario a "ver que hay más").
const DROPDOWN_MAX_H = 'max-h-[70dvh] sm:max-h-[460px]';

// =============================================================
// Utilidades de seguridad / render
// =============================================================

/**
 * Escapa caracteres HTML para que un texto "peligroso" del backend
 * (ej. un nombre de local con `<img src=x onerror=...>` que el admin
 * subió mal) se renderice como literal y NO se ejecute.
 *
 * Se usa dentro de `highlightMatchHtml` antes de envolver el texto en
 * `<mark>`. Es la única superficie de XSS del dropdown.
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

/**
 * Devuelve el texto con la primera coincidencia (case-insensitive) del query
 * envuelta en `<mark>`. Escapa HTML antes de marcar.
 *
 * El `<mark>` usa los tokens del sistema (`--mark-bg` / `--mark-text`) para
 * que se vea consistente con el resto de la UI en light + dark mode y
 * cumpla contraste accesible.
 *
 * @param {string} text — texto a renderizar (nombre del local / producto).
 * @param {string} query — query del usuario.
 * @returns {object} { __html: string } listo para `dangerouslySetInnerHTML`,
 *   con el HTML ya escapado (seguro).
 */
function highlightMatchHtml(text, query) {
  const safeText = escapeHtml(text);
  const safeQuery = escapeHtml(query).trim();
  if (!safeQuery) return { __html: safeText };

  // Buscamos la coincidencia case-insensitive en el texto original (antes
  // de escapar) y la replicamos sobre el texto escapado.
  const lowerText = safeText.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return { __html: safeText };

  const before = safeText.slice(0, idx);
  const match = safeText.slice(idx, idx + lowerQuery.length);
  const after = safeText.slice(idx + lowerQuery.length);
  return {
    __html: `${before}<mark class="bg-[color:var(--mark-bg)] text-[color:var(--mark-text)] rounded px-0.5 font-semibold">${match}</mark>${after}`,
  };
}

// =============================================================
// Hook: state + fetch + teclado del autocomplete
// =============================================================

/**
 * Encapsula toda la lógica del autocomplete: debounce del input, fetch al
 * backend, estado de loading/error, items aplanados para teclado y mouse.
 *
 * El padre le pasa un `onSelect` (handler que se invoca cuando el usuario
 * elige un resultado, ya sea con teclado o mouse — el componente
 * SearchAutocomplete se encarga de navegar y cerrar). El hook le devuelve
 * un `composeKeyDown` listo para montar en el `<input>`.
 *
 * Decisión de diseño: separamos state (este hook) de render (el componente
 * `SearchAutocomplete` abajo). El padre consume los valores retornados y
 * monta el dropdown como un hijo más.
 */
export function useSearchAutocomplete({
  searchTerm,
  isOpen,
  tipoNegocioFilter,
  limit,
  onSelect,
  onClose,
}) {
  const debouncedTerm = useDebouncedValue(searchTerm, SUGGEST_DEBOUNCE_MS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({ restaurantes: [], productos: [] });
  // selectedIndex apunta al item actualmente highlighted en la lista
  // concatenada [0..restLen-1 = restaurantes, restLen.. = productos].
  // -1 = nada seleccionado (Enter hace submit del término en lugar de
  // navegar a un resultado).
  const [selectedIndex, setSelectedIndex] = useState(-1);
  // Ref para no disparar el suggest cuando el input tiene < SUGGEST_MIN_CHARS
  // o cuando el término debounced coincide con el último que ya pedimos.
  const lastFetchedTermRef = useRef('');

  // Aplanamos los resultados a una lista con tipo y referencia para navegar.
  // La fuente de verdad para el highlight/keyboard es este array.
  const flatItems = useMemo(() => {
    const r = results.restaurantes.map((item) => ({
      kind: 'restaurant',
      id: item.id,
      restaurante_id: item.id,
    }));
    const p = results.productos.map((item) => ({
      kind: 'product',
      id: item.id,
      restaurante_id: item.restaurante_id,
    }));
    return [...r, ...p];
  }, [results]);

  // Reset del highlight cuando cambia el term debounced (el usuario borró,
  // navegó con flechas y se "desplazó" la lista, etc.).
  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedTerm]);

  // Fetch de sugerencias. Solo se dispara cuando el término debounced tiene
  // ≥ SUGGEST_MIN_CHARS chars y el dropdown está abierto. `tipoNegocioFilter`
  // se traduce a null cuando es 'todos' para no enviar el param.
  useEffect(() => {
    const term = debouncedTerm.trim();
    if (!isOpen || term.length < SUGGEST_MIN_CHARS) {
      setResults({ restaurantes: [], productos: [] });
      setLoading(false);
      setError(null);
      lastFetchedTermRef.current = '';
      return undefined;
    }

    // Evitamos refetch si el término debounced coincide con el último que ya
    // pedimos (escenario típico: cambio de tipoNegocioFilter sin cambiar el
    // texto — el debounced value se vuelve a actualizar y dispararíamos dos
    // veces innecesariamente).
    if (lastFetchedTermRef.current === term) return undefined;
    lastFetchedTermRef.current = term;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = { q: term, limit };
    if (tipoNegocioFilter && tipoNegocioFilter !== 'todos') {
      params.tipo_negocio = tipoNegocioFilter;
    }

    searchService
      .suggest(params)
      .then((data) => {
        if (cancelled) return;
        setResults({
          restaurantes: data?.restaurantes || [],
          productos: data?.productos || [],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Error en /api/search:', err);
        setError('No pudimos buscar sugerencias. Probá de nuevo.');
        setResults({ restaurantes: [], productos: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, isOpen, tipoNegocioFilter, limit]);

  // Handler de teclado listo para montar en el `<input>`. Si hay un item
  // highlighted, Enter lo selecciona (llama a `onSelect`); si no, dejamos
  // que el `parentHandler` del padre maneje el submit del término. Escape
  // siempre cierra el dropdown. ArrowDown/Up siempre las interceptamos.
  // Home/End llevan al primer/último item (accesibilidad teclado-friendly,
  // patrón WAI-ARIA para combobox/listbox).
  const composeKeyDown = useCallback(
    (parentHandler) => (e) => {
      const total = flatItems.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (total === 0) return;
        setSelectedIndex((i) => (i + 1 >= total ? 0 : i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (total === 0) return;
        setSelectedIndex((i) => (i <= 0 ? total - 1 : i - 1));
      } else if (e.key === 'Home') {
        if (total > 0) {
          e.preventDefault();
          setSelectedIndex(0);
        }
      } else if (e.key === 'End') {
        if (total > 0) {
          e.preventDefault();
          setSelectedIndex(total - 1);
        }
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < total) {
          e.preventDefault();
          onSelect?.(flatItems[selectedIndex]);
        }
        // Si no hay highlight, dejamos que el padre maneje el submit
        // (no preventDefault, no onClose — el padre decide).
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }

      // Encadenamos con el handler del padre (ej: submit del término en
      // Enter sin highlight). Solo lo llamamos si nosotros NO hicimos
      // preventDefault — así no ejecutamos dos acciones en el mismo Enter.
      if (!e.defaultPrevented && parentHandler) {
        parentHandler(e);
      }
    },
    [flatItems, selectedIndex, onSelect, onClose],
  );

  // El padre pasa un `onSelect(item)` que se invoca cuando el usuario elige
  // un resultado (mouse o teclado). Este callback típicamente: navega,
  // cierra el dropdown y guarda el término. El componente SearchAutocomplete
  // recibe este mismo callback por prop y lo llama desde su onClick de cada
  // item; el hook no necesita conocer al componente.
  return {
    loading,
    error,
    results,
    selectedIndex,
    setSelectedIndex,
    flatItems,
    composeKeyDown,
  };
}

// =============================================================
// Componente presentacional
// =============================================================

/**
 * Dropdown predictivo para la barra de búsqueda del home del cliente.
 *
 * Renderiza uno de tres estados:
 *   - `searchTerm` vacío → `<RecentSearches>` con el historial del usuario.
 *   - `searchTerm` con < SUGGEST_MIN_CHARS → hint "tipeá al menos 2 chars".
 *   - `searchTerm` con ≥ SUGGEST_MIN_CHARS → dropdown con 2 secciones
 *     (Restaurantes / Productos), skeletons durante el fetch, empty state
 *     si no hay resultados, footer con conteo.
 *
 * El state (loading, error, results, debounce, fetch) vive en el hook
 * `useSearchAutocomplete` que el padre usa en su `<input>` para obtener
 * `composeKeyDown` y montarlo en el `onKeyDown`. Este componente solo lee
 * los valores y renderiza — no tiene estado propio.
 *
 * Props (todo el state viene del hook `useSearchAutocomplete` en el padre —
 * este componente NO tiene estado propio):
 *   - searchTerm (string) — valor actual del input controlado por el padre.
 *   - isOpen (bool) — si el padre quiere que el dropdown esté visible.
 *   - recentSearches (string[]) — historial del usuario.
 *   - onSelectRecent (fn) — click en un término reciente.
 *   - onClearHistory (fn) — botón "Borrar todo" del historial.
 *   - onSelectResult (fn) — click en un resultado del suggest. Recibe
 *     `{ kind, id, restaurante_id }` y debe navegar a `/restaurant/:id`
 *     y cerrar el dropdown.
 *   - onClose (fn) — cerrar el dropdown.
 *   - limit (number) — cantidad máxima de sugerencias por sección. Default 5.
 *   - loading (bool), error (string|null), results (object), selectedIndex
 *     (number), setSelectedIndex (fn), flatItems (array) — vienen del hook.
 *
 * Decisiones de diseño (ui-ux-pro-max, jul 2026):
 *   - Mobile-first: el contenedor scrollea internamente con
 *     `max-h-[60dvh] sm:max-h-[420px]` y `overscroll-contain` para que no
 *     choque con el scroll de la home (problema clásico en dropdowns).
 *   - Touch targets ≥ 44px en cada item (py-3 + flex items-center).
 *   - Highlight `<mark>` con tokens del sistema (no gris-amarillo genérico)
 *     para contraste accesible en light + dark mode.
 *   - Animaciones con `motion-safe:` para respetar `prefers-reduced-motion`.
 *   - Stagger sutil de entrada en items (≤60ms — no mareante).
 *   - Empty/loading/error states con icono + copy claro, no solo texto.
 *   - Press feedback con `active:scale-[0.99]` (≤5% — no layout shift).
 *   - Header sticky de sección con `sticky top-0` para que al scrollear
 *     la lista siempre sepas en qué sección estás.
 *   - Sin emoji como ícono: usamos Lucide en todos lados.
 */
export default function SearchAutocomplete({
  searchTerm,
  isOpen = false,
  recentSearches = [],
  onSelectRecent,
  onClearHistory,
  onSelectResult,
  onClose,
  limit = 5,
  loading = false,
  error = null,
  results = { restaurantes: [], productos: [] },
  selectedIndex = -1,
  setSelectedIndex = () => {},
  flatItems = [],
}) {
  const navigate = useNavigate();

  // Click en un resultado → navegar al local correspondiente.
  // Para productos, el destino es el restaurante padre (no existe vista de
  // detalle de producto individual). Para restaurantes, el destino es el
  // local. Después de navegar, cerramos el dropdown.
  const handleClickResult = (item) => {
    if (!item) return;
    onSelectResult?.(item);
    navigate(`/restaurant/${item.restaurante_id}`);
    onClose?.();
  };

  // Si el input está vacío, mostramos el historial de búsquedas recientes
  // (reutiliza el componente existente sin cambios). RecentSearches ya
  // devuelve null si no hay términos, así que no duplicamos ese check acá.
  const trimmed = searchTerm.trim();
  const showRecent = trimmed.length === 0;

  if (showRecent) {
    return (
      <RecentSearches
        searches={recentSearches}
        onSelect={onSelectRecent}
        onClear={onClearHistory}
      />
    );
  }

  // Si hay menos de SUGGEST_MIN_CHARS chars, no mostramos el suggest. En su
  // lugar devolvemos un mini-hint que invita a tipear más.
  if (trimmed.length < SUGGEST_MIN_CHARS) {
    return (
      <div
        className={`absolute top-full left-0 w-full mt-2 bg-[color:var(--bg-elevated)] shadow-2xl ring-1 ring-black/5 rounded-xl border border-[color:var(--border-subtle)] overflow-hidden motion-safe:animate-slideDown z-50`}
        role="status"
      >
        <div className="px-4 py-3.5 flex items-center gap-3 text-sm text-[color:var(--text-muted)]">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] flex-shrink-0">
            <Search size={15} aria-hidden="true" />
          </span>
          <span>
            Tipeá al menos <strong className="text-[color:var(--text-primary)] font-semibold">{SUGGEST_MIN_CHARS}</strong> caracteres
            para ver sugerencias.
          </span>
        </div>
      </div>
    );
  }

  const totalRest = results.restaurantes.length;
  const totalProd = results.productos.length;
  const total = totalRest + totalProd;

  return (
    <div
      className={`absolute top-full left-0 w-full mt-2 bg-[color:var(--bg-elevated)] shadow-2xl ring-1 ring-black/5 rounded-xl border border-[color:var(--border-subtle)] overflow-hidden motion-safe:animate-slideDown z-50`}
      role="listbox"
      aria-label="Sugerencias de búsqueda"
      aria-busy={loading || undefined}
    >
      <div className={`${DROPDOWN_MAX_H} overflow-y-auto overscroll-contain`}>
        {/* Estado: cargando (skeletons) */}
        {loading && (
          <div className="p-2 space-y-1" aria-busy="true" aria-label="Buscando sugerencias">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-3 animate-pulse motion-reduce:animate-none">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[color:var(--bg-muted)] flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-3 bg-[color:var(--bg-muted)] rounded w-2/3" />
                  <div className="h-2.5 bg-[color:var(--bg-muted)] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estado: error */}
        {!loading && error && (
          <div
            className="px-4 py-4 flex items-start gap-3 text-sm"
            role="alert"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--danger-bg)] text-[color:var(--danger-text)] flex-shrink-0">
              <AlertCircle size={16} aria-hidden="true" />
            </span>
            <div className="flex-1 pt-1">
              <p className="font-medium text-[color:var(--text-primary)]">No pudimos buscar</p>
              <p className="text-[color:var(--text-muted)] mt-0.5">Probá de nuevo en unos segundos.</p>
            </div>
          </div>
        )}

        {/* Estado: sin resultados */}
        {!loading && !error && total === 0 && (
          <div className="px-4 py-6 flex flex-col items-center text-center">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--bg-muted)] text-[color:var(--text-muted)] mb-3">
              <Search size={20} aria-hidden="true" />
            </span>
            <p className="text-sm text-[color:var(--text-primary)] font-medium">
              Sin resultados para &ldquo;{trimmed}&rdquo;
            </p>
            <p className="text-xs text-[color:var(--text-muted)] mt-1 max-w-[28ch]">
              Probá con otro término o revisá la ortografía.
            </p>
          </div>
        )}

        {/* Sección: Restaurantes */}
        {!loading && !error && totalRest > 0 && (
          <section aria-labelledby="suggest-section-rest">
            <header className="sticky top-0 z-[1] px-4 pt-3 pb-1.5 bg-[color:var(--bg-elevated)]/95 backdrop-blur-sm">
              <h3
                id="suggest-section-rest"
                className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)] flex items-center gap-1.5"
              >
                <Store size={11} aria-hidden="true" />
                Restaurantes
                <span className="ml-auto text-[color:var(--text-muted)] font-medium normal-case tracking-normal">
                  {totalRest}
                </span>
              </h3>
            </header>
            <ul className="py-1">
              {results.restaurantes.map((r, idx) => {
                const flatIdx = idx;
                const isActive = flatIdx === selectedIndex;
                return (
                  <li key={`r-${r.id}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-index={flatIdx}
                      onClick={() => handleClickResult(flatItems[flatIdx])}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className={`w-full px-3 sm:px-4 py-3 text-left flex items-center gap-3 rounded-lg mx-1 motion-safe:transition-colors motion-safe:duration-150 active:scale-[0.99] motion-reduce:active:scale-100 min-h-[56px] sm:min-h-[60px] ${
                        isActive
                          ? 'bg-[color:var(--bg-muted)]'
                          : 'hover:bg-[color:var(--bg-muted)]/60'
                      }`}
                      style={{ width: 'calc(100% - 0.5rem)' }}
                    >
                      {getImageUrl(r.imagen_url) ? (
                        <img
                          src={getImageUrl(r.imagen_url)}
                          alt=""
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0 ring-1 ring-[color:var(--border-subtle)]"
                          {...IMAGE_DEFAULT_ATTRS}
                        />
                      ) : (
                        <span
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primaryLight to-accent flex items-center justify-center flex-shrink-0 ring-1 ring-[color:var(--border-subtle)]"
                          aria-hidden="true"
                        >
                          <Utensils size={18} className="text-white opacity-90" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm sm:text-[15px] font-semibold text-[color:var(--text-primary)] truncate leading-snug"
                          dangerouslySetInnerHTML={highlightMatchHtml(r.nombre, trimmed)}
                        />
                        <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)] mt-0.5">
                          {Number(r.total_calificaciones) > 0 ? (
                            <span className="inline-flex items-center gap-0.5 font-medium text-[color:var(--text-secondary)]">
                              <Star size={11} className="text-yellow-500 fill-yellow-500" aria-hidden="true" />
                              <span className="tabular-nums">
                                {Number(r.calificacion_promedio).toFixed(1)}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[color:var(--text-muted)]">
                              <Sparkles size={11} aria-hidden="true" />
                              Nuevo
                            </span>
                          )}
                          {r.ciudad && (
                            <>
                              <span aria-hidden="true" className="text-[color:var(--text-muted)]/50">·</span>
                              <span className="truncate">{r.ciudad}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Sección: Productos */}
        {!loading && !error && totalProd > 0 && (
          <section
            aria-labelledby="suggest-section-prod"
            className={totalRest > 0 ? 'border-t border-[color:var(--border-subtle)]' : ''}
          >
            <header className="sticky top-0 z-[1] px-4 pt-3 pb-1.5 bg-[color:var(--bg-elevated)]/95 backdrop-blur-sm">
              <h3
                id="suggest-section-prod"
                className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)] flex items-center gap-1.5"
              >
                <Utensils size={11} aria-hidden="true" />
                Productos
                <span className="ml-auto text-[color:var(--text-muted)] font-medium normal-case tracking-normal">
                  {totalProd}
                </span>
              </h3>
            </header>
            <ul className="py-1">
              {results.productos.map((p, idx) => {
                const flatIdx = totalRest + idx;
                const isActive = flatIdx === selectedIndex;
                return (
                  <li key={`p-${p.id}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-index={flatIdx}
                      onClick={() => handleClickResult(flatItems[flatIdx])}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className={`w-full px-3 sm:px-4 py-3 text-left flex items-center gap-3 rounded-lg mx-1 motion-safe:transition-colors motion-safe:duration-150 active:scale-[0.99] motion-reduce:active:scale-100 min-h-[56px] sm:min-h-[60px] ${
                        isActive
                          ? 'bg-[color:var(--bg-muted)]'
                          : 'hover:bg-[color:var(--bg-muted)]/60'
                      }`}
                      style={{ width: 'calc(100% - 0.5rem)' }}
                    >
                      {getImageUrl(p.imagen_url) ? (
                        <img
                          src={getImageUrl(p.imagen_url)}
                          alt=""
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0 ring-1 ring-[color:var(--border-subtle)]"
                          {...IMAGE_DEFAULT_ATTRS}
                        />
                      ) : (
                        <span
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primaryLight to-accent flex items-center justify-center flex-shrink-0 ring-1 ring-[color:var(--border-subtle)]"
                          aria-hidden="true"
                        >
                          <Utensils size={18} className="text-white opacity-90" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm sm:text-[15px] font-semibold text-[color:var(--text-primary)] truncate leading-snug"
                          dangerouslySetInnerHTML={highlightMatchHtml(p.nombre, trimmed)}
                        />
                        <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)] mt-0.5 min-w-0">
                          {p.restaurante_nombre && (
                            <span className="inline-flex items-center gap-1 truncate min-w-0">
                              <Store size={11} aria-hidden="true" className="flex-shrink-0" />
                              <span className="truncate">{p.restaurante_nombre}</span>
                            </span>
                          )}
                          {p.categoria_nombre && (
                            <>
                              <span aria-hidden="true" className="text-[color:var(--text-muted)]/50">·</span>
                              <span className="truncate">{p.categoria_nombre}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {p.precio !== undefined && p.precio !== null && (
                        <div className="text-sm sm:text-[15px] font-bold text-primary tabular-nums flex-shrink-0 pl-2">
                          ${formatCurrency(Number(p.precio))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Footer: conteo de resultados. aria-live para lectores de pantalla. */}
      {!loading && !error && total > 0 && (
        <div
          className="px-4 py-2 text-xs text-[color:var(--text-muted)] border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] flex items-center gap-2"
          aria-live="polite"
          aria-atomic="true"
        >
          <Sparkles size={11} aria-hidden="true" className="text-primary/70" />
          <span className="tabular-nums">
            {totalRest > 0 && totalProd > 0
              ? `${totalRest} ${totalRest === 1 ? 'restaurante' : 'restaurantes'} · ${totalProd} ${totalProd === 1 ? 'producto' : 'productos'}`
              : totalRest > 0
                ? `${totalRest} ${totalRest === 1 ? 'restaurante' : 'restaurantes'}`
                : `${totalProd} ${totalProd === 1 ? 'producto' : 'productos'}`}
          </span>
          <span className="ml-auto text-[10px] text-[color:var(--text-muted)]/70 hidden sm:inline">
            ↑↓ navegar · Enter seleccionar · Esc cerrar
          </span>
        </div>
      )}
    </div>
  );
}
