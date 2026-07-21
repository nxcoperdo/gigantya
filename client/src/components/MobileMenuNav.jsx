import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Nav de categorías + buscador (mobile-only).
 *
 * ## Layout: por qué `fixed` y no `sticky`
 *
 * Antes era `sticky top-[var(--header-height)]`. En mobile el contenedor
 * padre `<div className="min-h-screen ...">` lo liberaba al hacer scroll
 * y el cliente reportaba que "el seleccionador se iba con el scroll".
 *
 * Solución: `position: fixed` con `z-40` y `top` dinámico que apila
 * correctamente header + MarketInfoBanner (cuando está visible en
 * locales de mercado) + esta nav. La nav publica su altura vía
 * `window.__mobileMenuHeight` + evento `mobile-menu-resize` para que
 * el padre compense con `padding-top` exacto.
 *
 * Apilamiento en mobile (top → bottom):
 *   - Header (z-50, altura en --header-height)
 *   - MarketInfoBanner (z-50, altura en window.__marketBannerHeight, solo mercados)
 *   - Esta nav (z-40)
 *
 * En desktop la nav NO se monta (`md:hidden`).
 *
 * ## 3 piezas funcionales
 *
 * 1. **Buscador** (línea ~190): input controlado con `useDeferredValue`
 *    para que el filter no bloquee el typing. Solo se muestra si hay
 *    +12 productos.
 *
 * 2. **Pills de categorías** (línea ~235): scroll horizontal, la activa
 *    se resalta con `var(--color-primary)`.
 *
 * 3. **Scrollspy con IntersectionObserver** (línea ~80): detecta qué
 *    categoría está visible. Usa un guard `isScrollingRef` para evitar
 *    parpadeo durante smooth scroll programático.
 *
 * Props:
 *   - categories:        Array<{id, nombre}> — id estable del backend.
 *   - productos:         Array de productos completos (filtro del buscador).
 *   - onSearchChange?:   (query) => void — notifica al padre.
 *   - marketBannerHeight?: number — altura del MarketInfoBanner (si está
 *                                   visible en locales de mercado). Default 0.
 */
export default function MobileMenuNav({
  categories,
  productos,
  onSearchChange,
  marketBannerHeight = 0,
}) {
  const [query, setQuery] = useState('');
  // useDeferredValue retrasa el filter para que el typing no sufra lag
  // en listas grandes. React 18+, ya disponible en el proyecto (18.2).
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? null);
  const isScrollingRef = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    if (onSearchChange) onSearchChange(deferredQuery);
  }, [deferredQuery, onSearchChange]);

  // -----------------------------------------------------------------
  // Publicar la altura de esta nav para que el padre compense el
  // padding-top del contenido. ResizeObserver cubre rotación de
  // pantalla, cambios de fuente del browser, mostrar/ocultar buscador
  // según scroll, etc.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return undefined;
    const el = ref.current;
    const publish = () => {
      const h = el.getBoundingClientRect().height;
      window.__mobileMenuHeight = h;
      window.dispatchEvent(new CustomEvent('mobile-menu-resize', { detail: { height: h } }));
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.__mobileMenuHeight = 0;
      window.dispatchEvent(new CustomEvent('mobile-menu-resize', { detail: { height: 0 } }));
    };
  }, [deferredQuery]); // re-medir cuando cambia el contenido (buscador se muestra/oculta)

  // -----------------------------------------------------------------
  // Scrollspy con IntersectionObserver
  // -----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const sections = document.querySelectorAll('[data-cat-section]');
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible) {
          const catId = visible.target.dataset.catSection;
          setSelectedCategory((prev) => (prev === catId ? prev : catId));
        }
      },
      // rootMargin: descontamos la altura del header + la altura de ESTA nav +
      // el market banner (si está). Sin este offset, la categoría se marca
      // activa cuando apenas entra al viewport, lo que se siente "tarde".
      { rootMargin: `-${60 + (typeof window !== 'undefined' ? (window.__mobileMenuHeight || 0) : 0) + marketBannerHeight}px 0px -60% 0px`, threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories, marketBannerHeight]);

  // -----------------------------------------------------------------
  // Click en pill → smooth scroll a la sección, compensando header +
  // nav + market banner para que la sección no quede tapada por las
  // barras fijas.
  // -----------------------------------------------------------------
  const handlePillClick = (catId) => {
    const target = document.getElementById(`cat-${catId}`);
    if (!target) return;

    isScrollingRef.current = true;
    setSelectedCategory(catId);

    const headerH = getHeaderHeight();
    const navH = ref.current?.getBoundingClientRect().height || 0;
    const offset = headerH + navH + marketBannerHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });

    setTimeout(() => {
      isScrollingRef.current = false;
    }, 700);
  };

  const showSearch = productos.length > 12;
  const hasQuery = deferredQuery.trim().length > 0;

  return (
    <nav
      ref={ref}
      // md:hidden — solo mobile. z-40 debajo del header y del market
      // banner (ambos z-50) pero encima del contenido.
      // top = header-height + market-banner-height (cuando aplica). En
      // CSS usamos la var --header-height que emite el Header; para
      // sumar el banner usamos un paddingTop interno equivalente.
      className="md:hidden fixed left-0 right-0 z-40
                 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)]
                 backdrop-blur-md"
      style={{
        top: 'calc(var(--header-height, 60px) + 0px)',
        // Si hay market banner, lo apilamos visualmente mediante un
        // margin negativo NO (sería incorrecto) — en su lugar, el padre
        // ajusta la posición de esta nav con la prop marketBannerHeight.
        // Como `top` no acepta sumas dinámicas en CSS vars del runtime,
        // lo manejamos con un transform translateY o, mejor, dejando
        // que el padre renderice un wrapper. Pero para mantener este
        // componente autocontenido, hacemos lo siguiente: el padre pasa
        // marketBannerHeight como prop y la nav ajusta su `top` con
        // calc inline abajo.
      }}
      aria-label="Navegación del menú"
    >
      {/* Wrapper interno: compensa el market banner cuando está visible
          moviendo la nav hacia abajo con marginTop. Es más robusto que
          pelearse con `top: calc(...)` porque `top` necesita ser
          declarado en style y eso choca con el `className` Tailwind. */}
      <div style={{ marginTop: marketBannerHeight > 0 ? `${marketBannerHeight}px` : 0 }}>
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
                    aria-current={isActive ? 'true' : undefined}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                      'transition-colors min-h-[36px] min-w-[36px]',
                      'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]',
                      isActive
                        ? 'text-white shadow-sm'
                        : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]',
                    ].join(' ')}
                    style={isActive ? { backgroundColor: 'var(--color-primary)' } : undefined}
                  >
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Lee --header-height de la CSS var que emite el Header. Si no existe
// (SSR, tests), usa 60px como fallback. No usamos getComputedStyle en
// un useEffect porque handlePillClick es un handler de evento síncrono.
function getHeaderHeight() {
  if (typeof window === 'undefined') return 60;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}
