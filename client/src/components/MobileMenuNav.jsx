import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Nav de categorías + buscador (mobile-only).
 *
 * ## Apilamiento móvil (single source of truth = CSS vars)
 *
 * Esta nav es el TERCER elemento fijo en mobile. Su `top` se calcula
 * con las CSS vars publicadas por sus padres:
 *
 *   top = var(--header-height) + var(--market-banner-h, 0px)
 *         + env(safe-area-inset-top, 0px)
 *
 * Publica su propia altura vía `var(--mobile-menu-h)` para que el
 * `padding-top` del contenedor raíz la sume y no tape contenido.
 *
 *   Header             → top: 0                                  (z-50, sticky)
 *   MarketInfoBanner   → top: calc(header + safe-area)           (z-49, fixed)
 *   MobileMenuNav      → top: calc(header + banner + safe-area)   (z-48, fixed)
 *
 * ## Por qué `position: fixed`
 *
 * Versión anterior usaba `sticky top-[var(--header-height)]`. En
 * mobile el contenedor padre `<div className="min-h-screen">` lo
 * liberaba al hacer scroll y el cliente reportaba que "el
 * seleccionador se iba con el scroll". `position: fixed` lo pega
 * al viewport. Tradeoff: el padre aplica `padding-top` con la
 * altura real para que el contenido no quede tapado.
 *
 * ## 3 piezas funcionales
 *
 *   1. Buscador (useDeferredValue para no bloquear typing en +12 productos)
 *   2. Pills de categorías con scroll horizontal
 *   3. Scrollspy con IntersectionObserver
 */
export default function MobileMenuNav({ categories, productos, onSearchChange }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? null);
  const isScrollingRef = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    if (onSearchChange) onSearchChange(deferredQuery);
  }, [deferredQuery, onSearchChange]);

  // Publica la altura de esta nav en CSS var + window. ResizeObserver
  // cubre el caso de mostrar/ocultar buscador según productos.length > 12
  // y la rotación de pantalla.
  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return undefined;
    const el = ref.current;
    const publish = (h) => {
      document.documentElement.style.setProperty('--mobile-menu-h', `${h}px`);
      window.__mobileMenuHeight = h;
      window.dispatchEvent(new CustomEvent('mobile-menu-resize', { detail: { height: h } }));
    };
    publish(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) publish(entry.contentRect.height);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--mobile-menu-h', '0px');
      window.__mobileMenuHeight = 0;
      window.dispatchEvent(new CustomEvent('mobile-menu-resize', { detail: { height: 0 } }));
    };
  }, [deferredQuery]);

  // Scrollspy
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
      // rootMargin descuenta el alto del header + esta nav + market banner
      // (cuando esté visible) para que la categoría se marque activa
      // cuando entra al viewport visible real, no apenas aparece.
      {
        rootMargin: `-${
          60 + (typeof window !== 'undefined' ? (window.__mobileMenuHeight || 0) : 0) +
          (typeof window !== 'undefined' ? (window.__marketBannerHeight || 0) : 0)
        }px 0px -60% 0px`,
        threshold: 0,
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  // Click en pill → smooth scroll compensando todas las barras fijas
  const handlePillClick = (catId) => {
    const target = document.getElementById(`cat-${catId}`);
    if (!target) return;

    isScrollingRef.current = true;
    setSelectedCategory(catId);

    const headerH = getHeaderHeight();
    const navH = ref.current?.getBoundingClientRect().height || 0;
    const bannerH = typeof window !== 'undefined' ? (window.__marketBannerHeight || 0) : 0;
    const offset = headerH + navH + bannerH;
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
      aria-label="Navegación del menú"
      // z-48 debajo del header (z-50) y del banner (z-49). md:hidden lo
      // oculta en desktop. top: calc(header + banner + safe-area).
      // backgroundColor translúcido + backdrop-blur estilo app nativa:
      // el contenido que pasa por debajo se ve borroso, no interrumpido.
      className="md:hidden fixed left-0 right-0 z-[48] border-b border-[color:var(--border-subtle)]"
      style={{
        top: 'calc(var(--header-height, 60px) + var(--market-banner-h, 0px) + env(safe-area-inset-top, 0px))',
        backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        backdropFilter: 'blur(12px) saturate(180%)',
      }}
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
              className={`w-full pl-9 pr-9 py-2.5 rounded-lg text-base
                          bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]
                          placeholder:text-[color:var(--text-muted)]
                          focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]
                          transition-opacity ${isStale ? 'opacity-60' : 'opacity-100'}`}
              aria-label="Buscar productos en el menú"
              // 16px base + py-2.5 = altura ~44px. iOS no auto-zoomea
              // porque respetamos el mínimo de 16px (ver UX rule
              // "readable-font-size").
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full
                           text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]
                           active:scale-95 transition-transform
                           min-w-[32px] min-h-[32px] flex items-center justify-center"
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
                    'px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap',
                    'transition-colors',
                    // min-h 36 + gap 8dp (gap-2 del contenedor) cumple
                    // touch target + touch spacing de Apple HIG.
                    'min-h-[36px]',
                    'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]',
                    'active:scale-95 transition-transform',
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
    </nav>
  );
}

function getHeaderHeight() {
  if (typeof window === 'undefined') return 60;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}
