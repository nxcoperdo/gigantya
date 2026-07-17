import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

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
  const btnRef = useRef(null);    // Google inyecta el botón acá (React lo deja vacío)
  const lastWidthRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

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

  // Cargar GIS + inicializar (una sola vez)
  useEffect(() => {
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
  }, [loginWithGoogle, navigate, redirectTo, onError]);

  // Render inicial + re-render al cambiar el ancho del contenedor
  useEffect(() => {
    if (!ready) return;
    renderButton();
    const ro = new ResizeObserver(() => renderButton());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [ready, renderButton]);

  if (unavailable) return null;

  return (
    <div ref={wrapRef} className="w-full">
      {/* Google inyecta su botón acá */}
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
