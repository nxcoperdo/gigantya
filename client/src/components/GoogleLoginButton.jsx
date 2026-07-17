import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

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
 * Botón "Continuar con Google". Renderiza el botón oficial de Google y, al
 * autenticarse, canjea el credential por nuestro JWT vía AuthContext.
 *
 * Props:
 *  - onError(msg): reporta errores al padre para mostrarlos con su UI.
 *  - redirectTo: a dónde navegar tras el login (default "/").
 */
export default function GoogleLoginButton({ onError, redirectTo = '/' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    // Sin Client ID configurado no hay nada que renderizar (degrada suave:
    // el login por email/contraseña sigue funcionando).
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
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
          locale: 'es',
        });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, navigate, redirectTo, onError]);

  if (unavailable) return null;

  // El botón real lo inyecta Google dentro de este div. Lo centramos.
  return <div ref={containerRef} className="flex justify-center" />;
}
