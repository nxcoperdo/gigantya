import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, X, Smartphone, Share, Plus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/api';

/**
 * Banner in-app para sugerir instalar la PWA.
 *
 * Eventos distintos que NO mezclar con PWAUpdatePrompt (esos son los
 * "nueva versión disponible" del service worker; este es el de "puedes
 * tener un ícono en tu pantalla de inicio"). Ver vite.config.js para
 * la config de `registerType: 'prompt'`.
 *
 * Flujo:
 *   1. El navegador dispara `beforeinstallprompt` cuando la PWA cumple
 *      los requisitos de instalación (HTTPS, manifest válido, SW activo).
 *      Guardamos el evento en `deferredPrompt` para usarlo más tarde.
 *   2. Si NO lo dispara (iOS Safari, o usuario que ya instaló) no
 *      mostramos el botón "Instalar", pero igual dejamos el link a
 *      la página de ayuda con instrucciones.
 *   3. Cuando el usuario clickea "Instalar app", llamamos
 *      `deferredPrompt.prompt()`. El `userChoice` nos dice si aceptó
 *      o rechazó. En cualquier caso, persistimos `dismissed` para no
 *      volver a molestar.
 *
 * Persistencia:
 *   - Logueado: `user.otros_datos.onboarding.pwa_install_prompt_state`
 *     vía setOnboardingKey (mismo patrón que el resto de Fase 13).
 *   - Anónimo: `localStorage` con key `gigantya:pwa_install_prompt_dismissed`.
 *     Necesario porque la página `/ayuda/instalar-app` es pública.
 *
 * Rutas excluidas (en `allowedPaths`):
 *   - /pos/*, /admin/* (kiosk / admin, no aporta)
 *   - /login, /register, /forgot-password, /reset-password (auth flow)
 *   - /terminos, /privacidad, /cookies, /legal/* (legales)
 *   - /ayuda/instalar-app (sería redundante)
 *   - Cualquier 404
 *
 * UX:
 *   - Aparece con 3s de delay para que el usuario vea primero el
 *     contenido (patrón de la industria, PWABuilder/AddThis).
 *   - Auto-cierre tras instalar/rechazar (persiste dismissed).
 *   - Si ya está instalada (`display-mode: standalone` o
 *     `navigator.standalone`), no se muestra nunca.
 *   - iOS: en vez de "Instalar app" muestra un mini-tip con los 2
 *     pasos del "Compartir → Agregar a pantalla de inicio".
 */

// Rutas donde mostrar el banner. Excluimos todas las que no aportan:
// POS (kiosk), admin (power users), auth (flujo), legales (sin espacio
// para el banner), la propia página de ayuda (redundante).
const ALLOWED_PREFIXES = [
  '/',            // HomePage (matches exact via / también)
  '/restaurant',
  '/cart',
  '/checkout',
  '/orders',
  '/chats',
  '/profile',
  '/dashboard',
];

const EXCLUDED_PREFIXES = [
  '/pos',
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/terminos',
  '/privacidad',
  '/cookies',
  '/legal/',
  '/ayuda/instalar-app',
];

const LOCAL_STORAGE_KEY = 'gigantya:pwa_install_prompt_dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  // Android/Desktop Chrome + iOS Safari
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isExcludedPath(pathname) {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isAllowedPath(pathname) {
  // Raíz coincide con cualquier cosa, pero las excluidas tienen prioridad.
  if (isExcludedPath(pathname)) return false;
  return ALLOWED_PREFIXES.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p)
  );
}

export default function PWAInstallPrompt() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUserFromResponse, refreshUser } = useAuth();

  // Estado del navegador
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [iosTipOpen, setIosTipOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showDelayPassed, setShowDelayPassed] = useState(false);

  // Estado de visibilidad del banner
  // - 'hidden' → no se muestra (no aplica, ya instalado, etc.)
  // - 'visible' → mostrar
  // - 'dismissed' → usuario lo cerró, no se muestra más
  const [visibility, setVisibility] = useState('hidden');

  // ========== Lectura inicial del flag de "ya lo descartó" ==========
  useEffect(() => {
    if (!user) return;
    const state = user?.otros_datos?.onboarding?.pwa_install_prompt_state;
    if (state === 'dismissed') {
      setVisibility('dismissed');
    }
  }, [user]);

  // Para anónimos, leer del localStorage en el mount inicial
  useEffect(() => {
    if (user) return; // logueado usa el flag del user
    try {
      if (localStorage.getItem(LOCAL_STORAGE_KEY) === '1') {
        setVisibility('dismissed');
      }
    } catch {
      // localStorage puede estar deshabilitado (modo privado) — ignorar
    }
  }, [user]);

  // ========== Detección de "ya está instalada" ==========
  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      setVisibility('hidden');
    }
  }, []);

  // ========== Detección de instalación posterior ==========
  // Cuando el usuario acepta el prompt, la app pasa a standalone y se
  // dispara el evento `appinstalled`. Lo escuchamos para ocultar el
  // banner en tiempo real sin esperar al próximo mount.
  useEffect(() => {
    const onAppInstalled = () => {
      setInstalled(true);
      setVisibility('hidden');
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onAppInstalled);
    return () => window.removeEventListener('appinstalled', onAppInstalled);
  }, []);

  // ========== Capturar beforeinstallprompt ==========
  // Solo Chromium-based (Android Chrome/Edge/Samsung/Brave/Desktop).
  // iOS Safari nunca lo dispara, Firefox tampoco.
  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      // El browser sugiere por su cuenta pero aquí lo "atrapamos" para
      // mostrar NUESTRO banner en vez del prompt nativo inmediato.
      e.preventDefault();
      setDeferredPrompt(e);
      // Si el usuario todavía no descartó, queda 'hidden' hasta que
      // pase el delay (seteado abajo en otro useEffect).
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  // ========== Delay de 3s para mostrar el banner ==========
  // Si todavía está 'hidden' después de cargar + 3s, y aplica,
  // pasamos a 'visible'. Da tiempo a que el usuario vea primero
  // el contenido de la página (patrón PWABuilder/AddThis).
  useEffect(() => {
    if (visibility !== 'hidden') return;
    if (installed) return;
    if (!isAllowedPath(location.pathname)) return;

    const t = setTimeout(() => setShowDelayPassed(true), 3000);
    return () => clearTimeout(t);
  }, [visibility, installed, location.pathname]);

  // Cuando el delay pasa, si hay deferredPrompt o es iOS, mostramos
  useEffect(() => {
    if (!showDelayPassed) return;
    if (visibility !== 'hidden') return;
    if (installed) return;
    if (!isAllowedPath(location.pathname)) return;
    // Hay algo para ofrecer: prompt nativo disponible, o al menos
    // instrucciones para iOS.
    if (deferredPrompt || isIOS()) {
      setVisibility('visible');
    }
  }, [showDelayPassed, deferredPrompt, visibility, installed, location.pathname]);

  // ========== Acciones ==========
  const persistDismissed = useCallback(async () => {
    if (user) {
      try {
        const res = await userService.setOnboardingKey(
          'onboarding.pwa_install_prompt_state',
          'dismissed'
        );
        if (res?.usuario && setUserFromResponse) {
          setUserFromResponse(res.usuario);
        } else if (refreshUser) {
          await refreshUser();
        }
      } catch (err) {
        // Si falla el server, igual cerramos local. El flag se va a
        // re-sincronizar en la próxima lectura del user.
        console.error('[PWAInstallPrompt] no se pudo persistir dismissed:', err?.message);
      }
    } else {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, '1');
      } catch {
        // Sin localStorage, no podemos persistir — aceptamos el costo
        // de mostrarlo de nuevo en la próxima visita.
      }
    }
  }, [user, setUserFromResponse, refreshUser]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return; // No debería pasar (botón solo se muestra si hay prompt)
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // choice.outcome: 'accepted' | 'dismissed'
      // En cualquier caso, no queremos volver a mostrar el banner.
      setVisibility('hidden');
      await persistDismissed();
      // 'appinstalled' se va a disparar solo si fue 'accepted', pero
      // seteamos installed manualmente como red de seguridad por si el
      // evento no llega (algunos browsers viejos).
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
      }
    } catch (err) {
      console.error('[PWAInstallPrompt] prompt() falló:', err);
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, persistDismissed]);

  const handleClose = useCallback(async () => {
    setVisibility('dismissed');
    setIosTipOpen(false);
    await persistDismissed();
  }, [persistDismissed]);

  const handleOpenHelpPage = useCallback(() => {
    // No persistimos "dismissed" al ir a la página de ayuda — el usuario
    // puede volver y seguir teniendo el botón "Instalar" disponible.
    // Solo cerramos este mount.
    setVisibility('hidden');
    navigate('/ayuda/instalar-app');
  }, [navigate]);

  // ========== Render ==========
  if (visibility !== 'visible') return null;

  const showInstallBtn = !!deferredPrompt; // En iOS no hay prompt nativo

  return (
    <div
      role="region"
      aria-label="Instalar Gigantya"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[9998] animate-slideUp motion-reduce:animate-none"
    >
      <div className="bg-[color:var(--bg-elevated,#fff)] border border-[color:var(--border-subtle,#e5e7eb)] rounded-2xl shadow-lg-soft p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[color:var(--text-primary,#111827)]">
            Instala Gigantya en tu pantalla
          </p>
          <p className="text-sm text-[color:var(--text-secondary,#6b7280)] mt-0.5">
            Acceso en 1 toque, notificaciones de tus pedidos y chat.
          </p>

          {showInstallBtn ? (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstallClick}
                className="btn btn-primary btn-sm"
              >
                <Download size={14} className="mr-1" aria-hidden="true" />
                Instalar app
              </button>
              <button
                type="button"
                onClick={handleOpenHelpPage}
                className="text-sm font-medium text-[color:var(--text-secondary,#6b7280)] px-3 py-1.5 hover:text-[color:var(--text-primary,#111827)] transition-colors"
              >
                Cómo instalar
              </button>
            </div>
          ) : (
            // iOS Safari: no hay prompt nativo, mostramos el mini-tip inline
            <div className="mt-3 space-y-2">
              {!iosTipOpen ? (
                <button
                  type="button"
                  onClick={() => setIosTipOpen(true)}
                  className="btn btn-primary btn-sm"
                >
                  Ver instrucciones para iPhone
                </button>
              ) : (
                <ol className="text-xs text-[color:var(--text-secondary,#6b7280)] space-y-1 list-decimal list-inside bg-[color:var(--bg-muted,#f3f4f6)] rounded-lg p-2.5">
                  <li className="flex items-start gap-1.5">
                    <span className="flex-1">
                      Toca el botón <Share size={11} className="inline -mt-0.5" aria-hidden="true" /> Compartir abajo.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="flex-1">
                      Elige <Plus size={11} className="inline -mt-0.5" aria-hidden="true" /> &ldquo;Agregar a pantalla de inicio&rdquo;.
                    </span>
                  </li>
                </ol>
              )}
              <button
                type="button"
                onClick={handleOpenHelpPage}
                className="block text-sm font-medium text-[color:var(--text-secondary,#6b7280)] hover:text-[color:var(--text-primary,#111827)] transition-colors"
              >
                Ver guía completa →
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          title="No mostrar más"
          className="text-[color:var(--text-secondary,#9ca3af)] hover:text-[color:var(--text-primary,#111827)] transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
