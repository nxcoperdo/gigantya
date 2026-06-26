import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email);
      setSuccess(response.data.mensaje);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
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
          <h1 className="text-2xl font-bold text-primary mb-2">Recuperar Contraseña</h1>
          <p className="text-[color:var(--text-secondary)] text-sm">
            Ingresa tu email y te enviaremos un enlace para resetear tu contraseña
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
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="tu@email.com"
              required
              disabled={!!success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="btn btn-primary w-full mt-6"
          >
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[color:var(--text-muted)]">
          <p>¿Recordaste tu contraseña?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
