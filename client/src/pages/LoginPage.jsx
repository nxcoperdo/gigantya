import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, clearLocalSession } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'EMAIL_NOT_FOUND') {
        setError('Ese correo no está registrado. ¿Quieres crear una cuenta?');
      } else if (data?.code === 'INVALID_PASSWORD') {
        setError('La contraseña es incorrecta. ¿Olvidaste tu contraseña?');
      } else {
        setError(data?.error || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    clearLocalSession();
    setError('');
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center px-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-lg p-8 w-full max-w-md border border-[color:var(--border-subtle)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Gigantya</h1>
          <p className="text-[color:var(--text-secondary)]">Inicia sesión en tu cuenta</p>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-6"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Separador + login con Google */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
          <span className="text-[color:var(--text-muted)] text-sm">o</span>
          <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
        </div>
        <GoogleLoginButton onError={setError} redirectTo="/" />

        <div className="mt-6 text-center text-[color:var(--text-secondary)]">
          <p>¿No tienes cuenta?{' '}
            <Link to="/register" className="text-primary font-semibold">
              Regístrate aquí
            </Link>
          </p>
          <p className="mt-2">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <button
            type="button"
            onClick={handleClearSession}
            className="mt-3 text-xs text-[color:var(--text-subtle)] hover:text-[color:var(--text-secondary)] underline"
          >
            Limpiar sesión guardada
          </button>
        </div>
      </div>
    </div>
  );
}

