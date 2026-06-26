import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import { ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      setError('Token no proporcionado');
    } else {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword(token, password);
      setSuccess(response.data.mensaje);

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al resetear la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center px-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-lg p-8 w-full max-w-md border border-[color:var(--border-subtle)]">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center text-sm text-[color:var(--text-muted)] hover:text-primary mb-4">
            <ArrowLeft size={16} className="mr-1" />
            Volver al login
          </Link>
          <h1 className="text-2xl font-bold text-primary mb-2">Nueva Contraseña</h1>
          <p className="text-[color:var(--text-secondary)] text-sm">
            Ingresa tu nueva contraseña
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-6 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-6 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Nueva Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              required
              disabled={!!success}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Confirmar Contraseña</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              required
              disabled={!!success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="btn btn-primary w-full mt-6"
          >
            {loading ? 'Procesando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
