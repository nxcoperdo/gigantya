import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// La PWA instalada (`display: standalone`) corre en un WebView aislado que
// no tiene acceso a las cookies de sesión del navegador del sistema, así
// que el botón/iframe normal de Google Identity Services nunca puede
// mostrar las cuentas ya logueadas (el usuario tiene que escribir su
// email/contraseña a mano). `navigator.standalone` cubre Safari/iOS, que
// no soporta el media query `display-mode`.
function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// El botón oficial de Google tiene un ancho máximo de 400px. Lo renderizamos
// al ancho del contenedor (el form) clampeado a ese rango, así llena la
// tarjeta en PC y móvil sin desbordar.
const GSI_MIN_WIDTH = 220;
const GSI_MAX_WIDTH = 400;

// Carga el script de Google Identity Services una sola vez (aunque haya
// varios botones montados). Resuelve cuando `window.google` está listo.
let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/**
 * Botón "Continuar con Google". Renderiza el botón oficial de Google (ancho
 * responsivo) y, al autenticarse, canjea el credential por nuestro JWT.
 *
 * Props:
 *  - onError(msg): reporta errores al padre para mostrarlos con su UI.
 *  - redirectTo: a dónde navegar tras el login (default "/").
 */
export default function GoogleLoginButton({ onError, redirectTo = '/' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const wrapRef = useRef(null);   // mide el ancho disponible (full-width)
  const btnRef = useRef(null);    // Google inyecta el botón aquí (React lo deja vacío)
  const lastWidthRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [standalone] = useState(isStandalonePwa);

  // (Re)renderiza el botón de Google al ancho actual del contenedor. Se
  // llama al estar listo y cada vez que cambia el ancho (resize / rotación).
  const renderButton = useCallback(() => {
    if (!ready || !wrapRef.current || !btnRef.current || !window.google?.accounts?.id) return;
    const raw = Math.round(wrapRef.current.getBoundingClientRect().width);
    const width = Math.max(GSI_MIN_WIDTH, Math.min(GSI_MAX_WIDTH, raw));
    if (width === lastWidthRef.current) return; // evita re-render redundante
    lastWidthRef.current = width;
    btnRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(btnRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width,
      locale: 'es',
    });
  }, [ready]);

  // Cargar GIS + inicializar (una sola vez). En modo standalone no cargamos
  // GIS: se renderiza un <a> que navega de página completa a
  // /api/auth/google/start en vez de usar el iframe (ver el `if (standalone)`
  // más abajo).
  useEffect(() => {
    if (standalone) return;
    if (!GOOGLE_CLIENT_ID) {
      setUnavailable(true);
      return;
    }
    let cancelled = false;

    const handleCredential = async (response) => {
      try {
        await loginWithGoogle(response.credential);
        if (!cancelled) navigate(redirectTo);
      } catch (err) {
        const msg = err.response?.data?.error || 'No se pudo iniciar sesión con Google';
        onError?.(msg);
      }
    };

    loadGsi()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });

    return () => { cancelled = true; };
  }, [standalone, loginWithGoogle, navigate, redirectTo, onError]);

  // Render inicial + re-render al cambiar el ancho del contenedor
  useEffect(() => {
    if (standalone || !ready) return;
    renderButton();
    const ro = new ResizeObserver(() => renderButton());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [standalone, ready, renderButton]);

  if (standalone) {
    if (!GOOGLE_CLIENT_ID) return null;
    // Navegación de página completa (no fetch, no popup): es lo que le da
    // acceso al selector de cuentas real del navegador del sistema, cosa
    // que el iframe de GIS no tiene dentro del WebView de la PWA instalada.
    const startUrl = `${API_URL}/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`;
    return (
      <a
        href={startUrl}
        className="h-11 w-full max-w-[400px] mx-auto flex items-center justify-center gap-3 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] font-medium hover:bg-[color:var(--bg-subtle)] transition-colors"
      >
        <GoogleGlyph />
        Continuar con Google
      </a>
    );
  }

  return (
    <div ref={wrapRef} className="w-full">
      {/* Google inyecta su botón aquí */}
      <div ref={btnRef} className="flex justify-center" />
      {/* Skeleton mientras carga GIS: evita el salto de layout */}
      {!ready && (
        <div className="flex justify-center">
          <div className="h-11 w-full max-w-[400px] rounded-full bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Logo oficial de Google ("G" de 4 colores), inline para no depender de un
// asset extra. Solo se usa en el botón de fallback (modo standalone) — el
// botón normal lo dibuja Google directamente dentro de su iframe.
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5C29.4 34.8 26.8 36 24 36c-5.3 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.5 5.5C40.3 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
