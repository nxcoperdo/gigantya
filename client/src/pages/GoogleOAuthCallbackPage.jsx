import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Destino de `GOOGLE_REDIRECT_URI` tras el paso 2 del login con Google por
 * redirect (ver `googleOAuthCallback` en el server). Google ya volvió al
 * backend, que canjeó el code y redirigió acá con el resultado en el
 * fragment de la URL (`#token=...&refreshToken=...&redirect=/algo` o
 * `#error=mensaje`). Usamos el fragment (no query string) para que el JWT
 * nunca quede en logs de acceso ni en el header Referer.
 */
export default function GoogleOAuthCallbackPage() {
  const { completeGoogleRedirectLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    // El fragment solo existe una vez; StrictMode/re-render no debe
    // reintentar el canje con un token que ya consumimos.
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError = params.get('error');
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const redirectTo = params.get('redirect') || '/';

    // Limpiar el fragment de la URL (con el JWT) del historial del
    // navegador apenas lo leemos.
    window.history.replaceState(null, '', window.location.pathname);

    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!token) {
      setError('No se pudo completar el login con Google');
      return;
    }

    completeGoogleRedirectLogin(token, refreshToken)
      .then(() => navigate(redirectTo, { replace: true }))
      .catch(() => {
        setError('No se pudo completar el login con Google');
      });
  }, [completeGoogleRedirectLogin, navigate]);

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center px-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-lg p-8 w-full max-w-md border border-[color:var(--border-subtle)] text-center">
        {error ? (
          <>
            <p className="alert alert-error text-sm mb-6">{error}</p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/login', { replace: true })}>
              Volver al login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={32} />
            <p className="text-[color:var(--text-secondary)] text-sm">Completando el inicio de sesión con Google…</p>
          </>
        )}
      </div>
    </div>
  );
}
