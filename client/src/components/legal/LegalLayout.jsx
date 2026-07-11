import { useEffect, useState } from 'react';

/**
 * `LegalLayout` — layout común para las 4 páginas legales.
 *
 * Estructura:
 *   - Header con título + versión + fecha
 *   - ToC lateral con scroll spy (las secciones se marcan en active
 *     al hacer scroll)
 *   - Contenido principal con `prose` (Tailwind typography)
 *   - Footer con aviso "Última actualización"
 *
 * Props:
 *   - title: string
 *   - subtitle: string
 *   - version: string (ej. "v1.0-2026-07-10")
 *   - updatedAt: string (ej. "10 de julio de 2026")
 *   - toc: [{ id, label }]  → items de la tabla de contenidos
 *   - children: ReactNode  → el contenido (secciones con `id`)
 */
export default function LegalLayout({ title, subtitle, version, updatedAt, toc = [], children }) {
  const [activeId, setActiveId] = useState(toc[0]?.id || null);

  // Scroll spy: marca como active la sección cuyo top está más cerca
  // del borde superior del viewport. Usamos IntersectionObserver con
  // rootMargin para que se active un poco antes de llegar al borde
  // exacto (UX más natural).
  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Tomar la entry que esté más cerca del top visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col gap-1">
            <span className="inline-block self-start text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wide">
              Documento legal
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-600 text-sm sm:text-base mt-1">{subtitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs sm:text-sm text-gray-500">
              <span>
                Versión: <span className="font-mono text-gray-700">{version}</span>
              </span>
              <span className="hidden sm:inline">•</span>
              <span>Última actualización: {updatedAt}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
          {/* ToC lateral — sticky en desktop, oculto en mobile */}
          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <nav className="sticky top-8">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Contenido
                </p>
                <ul className="space-y-1 border-l-2 border-gray-200">
                  {toc.map(({ id, label }) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className={[
                          'block pl-3 py-1 text-sm border-l-2 -ml-[2px] transition-colors',
                          activeId === id
                            ? 'border-indigo-600 text-indigo-700 font-semibold'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {/* Contenido principal con estilo "prose" hecho a mano para no
              depender del plugin @tailwindcss/typography. */}
          <article className="legal-prose max-w-none text-gray-800 text-sm sm:text-base leading-relaxed">
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
