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
 * Placeholders de screenshots: como todavía no tenemos capturas reales
 * de la app instalada, dejamos `aspect-video` con un texto "Acá va un
 * screenshot" y borde dashed. Si después se suben, se reemplazan los
 * placeholders por `<img>` con el `src` correspondiente.
 */

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function ScreenshotPlaceholder({ caption }) {
  return (
    <div className="mt-3 aspect-video rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400 italic">
      {caption}
    </div>
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
                Instalá Gigantya en tu pantalla
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
            automático. Si lo rechazaste, podés instalarla manualmente.
          </p>
          <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
            <li>
              Abrí <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span> en el navegador.
            </li>
            <li>
              Tocá el menú{' '}
              <strong className="font-semibold">⋮ (tres puntos)</strong>{' '}
              arriba a la derecha → elegí{' '}
              <strong className="font-semibold">&ldquo;Instalar app&rdquo;</strong>{' '}
              o{' '}
              <strong className="font-semibold">&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.
            </li>
            <li>
              Confirmá tocando{' '}
              <strong className="font-semibold">Instalar</strong>. El
              ícono de Gigantya aparece en tu pantalla de inicio.
            </li>
          </ol>
          <ScreenshotPlaceholder caption="Acá va un screenshot del menú ⋮ con la opción 'Instalar app'" />
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
            tenés que usar <strong className="font-semibold">Safari</strong>{' '}
            (no funciona desde Chrome iOS ni otros navegadores).
          </p>
          <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
            <li>
              Abrí{' '}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span>{' '}
              en Safari.
            </li>
            <li>
              Tocá el botón{' '}
              <strong className="font-semibold inline-flex items-center gap-1">
                <Share className="w-4 h-4 inline" aria-hidden="true" /> Compartir
              </strong>{' '}
              (el cuadrado con la flecha hacia arriba, abajo en el medio).
            </li>
            <li>
              Bajá y elegí{' '}
              <strong className="font-semibold inline-flex items-center gap-1">
                <Plus className="w-4 h-4 inline" aria-hidden="true" /> Agregar a pantalla de inicio
              </strong>
              .
            </li>
            <li>
              Tocá{' '}
              <strong className="font-semibold">Agregar</strong> arriba a la
              derecha. El ícono de Gigantya aparece junto a tus otras apps.
            </li>
          </ol>
          <ScreenshotPlaceholder caption="Acá va un screenshot del menú Compartir de Safari con 'Agregar a pantalla de inicio'" />
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
              Abrí{' '}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">gigantya.com</span>{' '}
              en el navegador.
            </li>
            <li>
              A la derecha de la barra de direcciones aparece un ícono{' '}
              <Download className="w-4 h-4 inline" aria-hidden="true" />{' '}
              <strong className="font-semibold">⊕ Instalar</strong> (o un
              botón &ldquo;Instalar Gigantya&rdquo;). Si no lo ves, usá
              el menú{' '}
              <strong className="font-semibold">⋮ → Instalar Gigantya</strong>.
            </li>
            <li>
              Confirmá tocando{' '}
              <strong className="font-semibold">Instalar</strong>. Gigantya
              se abre en su propia ventana, sin barra de navegador.
            </li>
          </ol>
          <ScreenshotPlaceholder caption="Acá va un screenshot del ícono ⊕ Instalar en la barra de direcciones" />
        </section>

        {/* ========== Beneficios ========== */}
        <section className="bg-gradient-to-br from-primary/5 to-amber-50 border border-primary/20 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-heading font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
            ¿Qué ganás con la app instalada?
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
            ¿Problemas para instalar? Escribinos por{' '}
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
