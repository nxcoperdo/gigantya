import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Sticky-nav de categorías + buscador (mobile-only).
 *
 * Se monta debajo del Header (top-[var(--header-height,60px)]), queda
 * pegada durante el scroll, y permite al cliente saltar entre categorías
 * con un solo tap en vez de scrollear 5-10 viewports hacia abajo.
 *
 * 3 piezas:
 *
 *   1. **Buscador** (línea ~75): input controlado con `useDeferredValue`
 *      para que el filter no bloquee el typing. Solo se muestra si hay
 *      +12 productos (no estorba en menús chicos).
 *
 *   2. **Pills de categorías** (línea ~95): scroll horizontal de pills,
 *      la activa se resalta con `var(--color-primary)` (respeta el color
 *      custom del local). Click → smooth scroll al `<section>` de la
 *      categoría correspondiente.
 *
 *   3. **Scrollspy con IntersectionObserver** (línea ~55): detecta qué
 *      categoría está visible y marca la pill activa. Usa un guard
 *      `isScrollingRef` para no actualizar la pill durante un smooth
 *      scroll programático (evita el parpadeo de "va a X, vuelve a Y"
 *      mientras la animación está en curso).
 *
 * ⚠️ El observer mira `document.querySelectorAll('[data-cat-section]')`
 *    en lugar de recibir refs. Esto desacopla el componente del padre
 *    y es robusto a re-renders. El padre solo necesita poner
 *    `data-cat-section={catId} id={`cat-${catId}`}` en cada bloque.
 *
 * Props:
 *   - categories:  Array<{id, nombre}> — id estable del backend (string o number).
 *   - productos:   Array de productos completos (para el filtro del buscador).
 *   - onSearchChange?: (query: string) => void — opcional, llamado cada vez
 *                      que cambia la query. Lo usa el padre para decidir
 *                      si renderizar las categorías agrupadas o la lista
 *                      plana de resultados. Si no se pasa, el padre puede
 *                      derivar el estado del query con su propio listener.
 */
export default function MobileMenuNav({ categories, productos, onSearchChange }) {
  const [query, setQuery] = useState('');
  // useDeferredValue retrasa el filter para que el typing no sufra lag
  // en listas grandes. React 18+, ya disponible en el proyecto (18.2).
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? null);
  const isScrollingRef = useRef(false);

  // Notificar al padre cuando cambia la query. El padre decide si
  // muestra la lista plana de resultados o el layout agrupado.
  useEffect(() => {
    if (onSearchChange) onSearchChange(deferredQuery);
  }, [deferredQuery, onSearchChange]);

  // -----------------------------------------------------------------
  // Scrollspy con IntersectionObserver
  // -----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    // Re-leemos las secciones cada vez que cambian las categorías.
    // querySelectorAll es robusto: si el padre re-renderiza, los nodos
    // viejos ya no están en el DOM y los nuevos sí.
    const sections = document.querySelectorAll('[data-cat-section]');
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Durante un smooth scroll programático, no actualizamos la pill
        // (sería ruido: la animación cruza categorías y la pill parpadearía).
        if (isScrollingRef.current) return;

        // Tomamos la entry intersecting con el top más cercano al borde
        // superior del viewport (la "raíz" del scroll visible).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible) {
          const catId = visible.target.dataset.catSection;
          // Solo update si cambió — evita renders innecesarios.
          setSelectedCategory((prev) => (prev === catId ? prev : catId));
        }
      },
      // rootMargin: el viewport se considera "viewport menos 60px arriba
      // (header+nav), menos 60% abajo". Así la categoría solo se marca
      // activa cuando cruza el 40% superior del viewport.
      { rootMargin: '-60px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, [categories]);

  // -----------------------------------------------------------------
  // Click en pill → smooth scroll a la sección
  // -----------------------------------------------------------------
  const handlePillClick = (catId) => {
    const target = document.getElementById(`cat-${catId}`);
    if (!target) return;

    isScrollingRef.current = true;
    setSelectedCategory(catId);

    // `behavior: 'smooth'` activa el scroll suave del CSS.
    // En prefers-reduced-motion el global pone scroll-behavior: auto
    // y esto se vuelve instantáneo.
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Liberamos el guard después de que la animación smooth haya
    // terminado (~700ms según pruebas en mobile típico). Si aún
    // hay flicker en testing, subir a 1000.
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 700);
  };

  // Mostrar buscador solo si hay +12 productos (no estorbar en menús chicos).
  const showSearch = productos.length > 12;
  const hasQuery = deferredQuery.trim().length > 0;

  // Si hay query activa, la sticky-nav de categorías pierde sentido
  // (estamos mostrando una lista plana de resultados). La ocultamos
  // y dejamos solo el buscador arriba.
  // IMPORTANTE: igual el padre usa onSearchChange para saber cuándo
  // mostrar la lista plana — este componente solo controla su visibilidad.
  return (
    <nav
      // md:hidden — solo mobile. z-40 está debajo del modal (z-50) y de
      // los toasts pero encima del contenido. top-[var(--header-height)]
      // usa la CSS var que emite el Header (L167 de Header.jsx).
      className="md:hidden sticky top-[var(--header-height,60px)] z-40
                 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)]
                 backdrop-blur-md"
      aria-label="Navegación del menú"
    >
      {/* Buscador (solo si hay +12 productos) */}
      {showSearch && (
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos…"
              // isStale = true mientras React está procesando el filter
              // diferido. Le bajamos la opacidad al input para feedback
              // visual de que "algo está pasando" sin bloquear el typing.
              className={`w-full pl-9 pr-9 py-2 rounded-lg text-sm
                          bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]
                          placeholder:text-[color:var(--text-muted)]
                          focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]
                          transition-opacity ${isStale ? 'opacity-60' : 'opacity-100'}`}
              aria-label="Buscar productos en el menú"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full
                           text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]
                           active:scale-95 transition-transform
                           min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pills de categorías — se ocultan cuando hay query activa */}
      {!hasQuery && (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max px-3 pb-2 pt-1">
            {categories.map((c) => {
              const isActive = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handlePillClick(c.id)}
                  // aria-current es lo que screen readers leen para
                  // indicar "página/ítem activo". `true` cuando coincide.
                  aria-current={isActive ? 'true' : undefined}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                    'transition-colors min-h-[36px] min-w-[36px]',
                    'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]',
                    isActive
                      ? 'text-white shadow-sm'
                      : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]',
                  ].join(' ')}
                  // Color de la pill activa se toma del --color-primary
                  // (respeta el custom_config del local). Inline style
                  // para que clases utility de Tailwind (naranjas) no
                  // pisen la decisión del dueño.
                  style={isActive ? { backgroundColor: 'var(--color-primary)' } : undefined}
                >
                  {c.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
