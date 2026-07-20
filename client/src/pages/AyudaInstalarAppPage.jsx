import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Share,
  Plus,
  Download,
  Check,
  Bell,
  MessageSquare,
  Wifi,
  ArrowLeft,
  Sparkles,
  Chrome,
  Apple,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Página pública de ayuda: cómo instalar la PWA.
 *
 * Es PÚBLICA (sin auth) para que un dueño pueda mandarle el link a un
 * cliente por WhatsApp. Se accede desde:
 *   - El banner in-app `<PWAInstallPrompt>` (botón "Cómo instalar").
 *   - El FAB "?" de clientes/locales (futuro).
 *   - Link directo.
 *
 * Estructura:
 *   - Hero con copy corto
 *   - 3 secciones por plataforma (Android, iOS, Desktop) con detección
 *     automática de la plataforma del usuario y badge "Tu plataforma"
 *   - Sección de beneficios
 *   - CTA contextual al final según el rol del user
 *
 * Placeholders de screenshots: mockups SVG inline (AndroidMockup,
 * IOSMockup, DesktopMockup) hasta que se suban capturas reales.
 * Si después se reemplazan, basta cambiar el `<svg>` por un
 * `<img src="/help/..." />` con el mismo `aspect-video` y `rounded-xl`.
 */

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Placeholders SVG inline — mockups de las pantallas de instalación
// que el usuario vería en su dispositivo. Cuando se suban capturas
// reales, reemplazar el `<svg>` por un `<img src="/help/..." />` con
// el mismo `aspect-video` y `rounded-xl`.

function ScreenshotPlaceholder({ children, label }) {
  return (
    <figure className="mt-3">
      <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 overflow-hidden flex items-center justify-center">
        {children}
      </div>
      <figcaption className="text-[11px] text-gray-500 text-center mt-1.5 italic">
        {label}
      </figcaption>
    </figure>
  );
}

// Mockup: Chrome en Android con el menú ⋮ abierto, opción "Instalar app" resaltada.
function AndroidMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true">
      {/* Cuerpo del teléfono */}
      <rect x="20" y="10" width="100" height="160" rx="10" fill="#1f2937" />
      <rect x="24" y="22" width="92" height="138" rx="4" fill="#f9fafb" />
      {/* Barra superior Chrome */}
      <rect x="28" y="26" width="84" height="12" rx="2" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="30" y="29" width="60" height="2" rx="1" fill="#9ca3af" />
      <text x="106" y="34" fontSize="6" fill="#374151">⋮</text>
      {/* Menú desplegado */}
      <rect x="60" y="40" width="56" height="56" rx="3" fill="#ffffff" stroke="#d1d5db" strokeWidth="0.5" />
      <rect x="62" y="42" width="52" height="8" rx="1" fill="#f3f4f6" />
      <text x="65" y="48" fontSize="3.5" fill="#374151">Nueva pestaña</text>
      <rect x="62" y="51" width="52" height="8" rx="1" fill="#f3f4f6" />
      <text x="65" y="57" fontSize="3.5" fill="#374151">Marcar como favorito</text>
      {/* Opción destacada */}
      <rect x="62" y="60" width="52" height="8" rx="1" fill="#fee2e2" />
      <text x="65" y="66" fontSize="3.5" fill="#c94b3b" fontWeight="bold">⊕ Instalar app</text>
      <rect x="62" y="69" width="52" height="8" rx="1" fill="#f3f4f6" />
      <text x="65" y="75" fontSize="3.5" fill="#374151">Compartir</text>
      <rect x="62" y="78" width="52" height="8" rx="1" fill="#f3f4f6" />
      <text x="65" y="84" fontSize="3.5" fill="#374151">Configuración</text>
    </svg>
  );
}

// Mockup: Safari iOS con el menú Compartir abierto, opción "Agregar a pantalla de inicio" resaltada.
function IOSMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true">
      {/* Cuerpo del teléfono */}
      <rect x="20" y="10" width="100" height="160" rx="14" fill="#111827" />
      <rect x="24" y="22" width="92" height="138" rx="6" fill="#f9fafb" />
      {/* Notch */}
      <rect x="55" y="14" width="30" height="4" rx="2" fill="#111827" />
      {/* Safari UI */}
      <rect x="28" y="26" width="84" height="10" rx="2" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="30" y="29" width="60" height="2" rx="1" fill="#9ca3af" />
      <text x="100" y="34" fontSize="6" fill="#374151">AA</text>
      {/* Contenido (página web) */}
      <rect x="28" y="40" width="84" height="60" rx="2" fill="#ffffff" />
      <rect x="32" y="44" width="40" height="6" rx="1" fill="#c94b3b" />
      <rect x="32" y="54" width="76" height="2" rx="1" fill="#e5e7eb" />
      <rect x="32" y="58" width="60" height="2" rx="1" fill="#e5e7eb" />
      <rect x="32" y="62" width="70" height="2" rx="1" fill="#e5e7eb" />
      <rect x="32" y="72" width="50" height="20" rx="1" fill="#fef3c7" />
      <rect x="86" y="72" width="22" height="20" rx="1" fill="#fef3c7" />
      {/* Sheet inferior Compartir */}
      <rect x="22" y="105" width="96" height="55" rx="6" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="26" y="108" width="88" height="3" rx="1" fill="#e5e7eb" />
      {/* Iconos de acciones */}
      <circle cx="34" cy="120" r="5" fill="#fee2e2" />
      <text x="32" y="122" fontSize="5" fill="#c94b3b">⤴</text>
      <text x="29" y="132" fontSize="3" fill="#374151">Compartir</text>
      <circle cx="54" cy="120" r="5" fill="#f3f4f6" />
      <text x="52" y="122" fontSize="5" fill="#374151">★</text>
      <text x="50" y="132" fontSize="3" fill="#374151">Favorito</text>
      {/* Opción destacada */}
      <rect x="68" y="115" width="22" height="14" rx="2" fill="#fee2e2" />
      <text x="74" y="123" fontSize="6" fill="#c94b3b">+</text>
      <text x="65" y="132" fontSize="3" fill="#c94b3b" fontWeight="bold">Agregar inicio</text>
      <rect x="26" y="140" width="88" height="18" rx="3" fill="#f3f4f6" />
      <text x="30" y="148" fontSize="3.5" fill="#374151">Lista de lectura</text>
      <text x="30" y="155" fontSize="3" fill="#9ca3af">Historial y marcadores</text>
    </svg>
  );
}

// Mockup: Chrome en desktop con el ícono ⊕ en la barra de direcciones.
function DesktopMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true">
      {/* Ventana del navegador */}
      <rect x="10" y="15" width="300" height="155" rx="6" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />
      {/* Barra de título */}
      <rect x="10" y="15" width="300" height="14" rx="6" fill="#f3f4f6" />
      <rect x="10" y="22" width="300" height="7" fill="#f3f4f6" />
      <circle cx="20" cy="22" r="2.5" fill="#ef4444" />
      <circle cx="29" cy="22" r="2.5" fill="#f59e0b" />
      <circle cx="38" cy="22" r="2.5" fill="#10b981" />
      {/* Barra de direcciones */}
      <rect x="50" y="32" width="240" height="14" rx="3" fill="#ffffff" stroke="#d1d5db" strokeWidth="0.5" />
      <text x="56" y="41" fontSize="6" fill="#9ca3af">🔒</text>
      <text x="66" y="41" fontSize="6" fill="#374151">gigantya.com</text>
      {/* Ícono ⊕ Instalar (destacado) */}
      <rect x="265" y="34" width="14" height="10" rx="2" fill="#fee2e2" />
      <text x="270" y="42" fontSize="7" fill="#c94b3b" fontWeight="bold">⊕</text>
      {/* Contenido de la página */}
      <rect x="20" y="52" width="280" height="40" rx="2" fill="#fef3c7" />
      <rect x="28" y="60" width="60" height="6" rx="1" fill="#c94b3b" />
      <rect x="28" y="72" width="240" height="3" rx="1" fill="#e5e7eb" />
      <rect x="28" y="78" width="220" height="3" rx="1" fill="#e5e7eb" />
      <rect x="28" y="84" width="180" height="3" rx="1" fill="#e5e7eb" />
      {/* Cards de locales */}
      <rect x="20" y="100" width="88" height="60" rx="3" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="24" y="104" width="80" height="30" rx="2" fill="#f3f4f6" />
      <rect x="24" y="138" width="50" height="3" rx="1" fill="#374151" />
      <rect x="24" y="144" width="40" height="3" rx="1" fill="#9ca3af" />
      <rect x="24" y="150" width="30" height="6" rx="1" fill="#c94b3b" />
      <rect x="116" y="100" width="88" height="60" rx="3" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="120" y="104" width="80" height="30" rx="2" fill="#f3f4f6" />
      <rect x="120" y="138" width="50" height="3" rx="1" fill="#374151" />
      <rect x="120" y="144" width="40" height="3" rx="1" fill="#9ca3af" />
      <rect x="120" y="150" width="30" height="6" rx="1" fill="#c94b3b" />
      <rect x="212" y="100" width="88" height="60" rx="3" fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.5" />
      <rect x="216" y="104" width="80" height="30" rx="2" fill="#f3f4f6" />
      <rect x="216" y="138" width="50" height="3" rx="1" fill="#374151" />
      <rect x="216" y="144" width="40" height="3" rx="1" fill="#9ca3af" />
      <rect x="216" y="150" width="30" height="6" rx="1" fill="#c94b3b" />
    </svg>
  );
}

function PlatformBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
      <Sparkles className="w-3 h-3" aria-hidden="true" />
      Tu plataforma
    </span>
  );
}

export default function AyudaInstalarAppPage() {
  const { user } = useAuth();
  const [platform, setPlatform] = useState('desktop');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // CTA contextual según el rol (solo si está logueado).
  // Si no, el CTA es "Crear cuenta".
  const cta = (() => {
    if (!user) {
      return { label: 'Crear cuenta gratis', to: '/register' };
    }
    if (user.tipo_usuario === 'cliente') {
      return { label: 'Ver mis pedidos', to: '/orders' };
    }
    if (
      ['restaurante', 'cajero', 'mesero', 'cocina'].includes(user.tipo_usuario)
    ) {
      return { label: 'Ir al dashboard', to: '/dashboard' };
    }
    if (user.tipo_usuario === 'admin') {
      return { label: 'Ir al panel', to: '/admin' };
    }
    return { label: 'Volver al inicio', to: '/' };
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver al inicio
          </Link>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-extrabold leading-tight">
                Instala Gigantya en tu pantalla
              </h1>
              <p className="text-white/90 text-sm sm:text-base mt-2 leading-relaxed">
                Acceso en 1 toque, notificaciones de tus pedidos y chat,
                y funciona aunque tengas internet lento.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* ========== Android ========== */}
        <section
          id="android"
          className={[
            'bg-white rounded-2xl border shadow-sm p-5 sm:p-6 scroll-mt-8',
            platform === 'android'
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-gray-200',
          ].join(' ')}
          aria-labelledby="android-title"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2
              id="android-title"
              className="text-lg sm:text-xl font-heading font-bold text-gray-900 flex items-center gap-2"
            >
              <Chrome className="w-5 h-5 text-primary" aria-hidden="true" />
              Android (Chrome / Edge / Samsung Internet)
            </h2>
            {platform === 'android' && <PlatformBadge />}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            La forma más rápida: tu navegador te ofrece un banner
            automático. Si lo rechazaste, puedes instalarla manualmente.
          </p>
          <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
            <li>
              Abre <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span> en el navegador.
            </li>
            <li>
              Toca el menú{' '}
              <strong className="font-semibold">⋮ (tres puntos)</strong>{' '}
              arriba a la derecha y elige{' '}
              <strong className="font-semibold">&ldquo;Instalar app&rdquo;</strong>{' '}
              o{' '}
              <strong className="font-semibold">&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.
            </li>
            <li>
              Confirma tocando{' '}
              <strong className="font-semibold">Instalar</strong>. El
              ícono de Gigantya aparece en tu pantalla de inicio.
            </li>
          </ol>
          <ScreenshotPlaceholder label="Menú ⋮ de Chrome con la opción 'Instalar app'">
            <AndroidMockup />
          </ScreenshotPlaceholder>
        </section>

        {/* ========== iOS ========== */}
        <section
          id="ios"
          className={[
            'bg-white rounded-2xl border shadow-sm p-5 sm:p-6 scroll-mt-8',
            platform === 'ios'
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-gray-200',
          ].join(' ')}
          aria-labelledby="ios-title"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2
              id="ios-title"
              className="text-lg sm:text-xl font-heading font-bold text-gray-900 flex items-center gap-2"
            >
              <Apple className="w-5 h-5 text-primary" aria-hidden="true" />
              iPhone / iPad (Safari)
            </h2>
            {platform === 'ios' && <PlatformBadge />}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            <strong className="font-semibold text-amber-700">Importante:</strong>{' '}
            tienes que usar <strong className="font-semibold">Safari</strong>{' '}
            (no funciona desde Chrome iOS ni otros navegadores).
          </p>
          <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
            <li>
              Abre{' '}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span>{' '}
              en Safari.
            </li>
            <li>
              Toca el botón{' '}
              <strong className="font-semibold inline-flex items-center gap-1">
                <Share className="w-4 h-4 inline" aria-hidden="true" /> Compartir
              </strong>{' '}
              (el cuadrado con la flecha hacia arriba, abajo en el medio).
            </li>
            <li>
              Baja y elige{' '}
              <strong className="font-semibold inline-flex items-center gap-1">
                <Plus className="w-4 h-4 inline" aria-hidden="true" /> Agregar a pantalla de inicio
              </strong>
              .
            </li>
            <li>
              Toca{' '}
              <strong className="font-semibold">Agregar</strong> arriba a la
              derecha. El ícono de Gigantya aparece junto a tus otras apps.
            </li>
          </ol>
          <ScreenshotPlaceholder label="Menú Compartir de Safari con 'Agregar a pantalla de inicio'">
            <IOSMockup />
          </ScreenshotPlaceholder>
        </section>

        {/* ========== Desktop ========== */}
        <section
          id="desktop"
          className={[
            'bg-white rounded-2xl border shadow-sm p-5 sm:p-6 scroll-mt-8',
            platform === 'desktop'
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-gray-200',
          ].join(' ')}
          aria-labelledby="desktop-title"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2
              id="desktop-title"
              className="text-lg sm:text-xl font-heading font-bold text-gray-900 flex items-center gap-2"
            >
              <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
              Computador (Chrome / Edge / Brave)
            </h2>
            {platform === 'desktop' && <PlatformBadge />}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Funciona en Windows, Mac y Linux.
          </p>
          <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
            <li>
              Abre{' '}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span>{' '}
              en el navegador.
            </li>
            <li>
              A la derecha de la barra de direcciones aparece un ícono{' '}
              <Download className="w-4 h-4 inline" aria-hidden="true" />{' '}
              <strong className="font-semibold">⊕ Instalar</strong> (o un
              botón &ldquo;Instalar Gigantya&rdquo;). Si no lo ves, usa
              el menú{' '}
              <strong className="font-semibold">⋮ → Instalar Gigantya</strong>.
            </li>
            <li>
              Confirma tocando{' '}
              <strong className="font-semibold">Instalar</strong>. Gigantya
              se abre en su propia ventana, sin barra de navegador.
            </li>
          </ol>
          <ScreenshotPlaceholder label="Ícono ⊕ Instalar en la barra de direcciones de Chrome">
            <DesktopMockup />
          </ScreenshotPlaceholder>
        </section>

        {/* ========== Beneficios ========== */}
        <section className="bg-gradient-to-br from-primary/5 to-amber-50 border border-primary/20 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-heading font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
            ¿Qué ganas con la app instalada?
          </h2>
          <ul className="space-y-2.5 text-sm text-gray-800">
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Acceso en 1 toque</strong>{' '}
                desde tu pantalla de inicio, sin abrir el navegador.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Notificaciones</strong>{' '}
                de tus pedidos y respuestas del chat aunque no tengas la app
                abierta.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Chat siempre conectado</strong>{' '}
                con tu local: hablá directo con el vendedor sin perder
                mensajes.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Wifi className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Funciona con internet lento</strong>:
                la app cachea lo esencial y carga más rápido que el navegador.
              </span>
            </li>
          </ul>
        </section>

        {/* ========== CTA final contextual ========== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">
            ¿Listo para empezar?
          </p>
          <Link
            to={cta.to}
            className="inline-flex items-center justify-center gap-2 btn btn-primary px-6 py-3 text-base font-semibold"
          >
            {cta.label}
          </Link>
          <p className="text-xs text-gray-500 mt-3">
            ¿Tienes problemas para instalar? Escríbenos por{' '}
            <a
              href="https://wa.me/573115320211"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WhatsApp
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
