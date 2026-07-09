import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import Loading from '../../components/Loading';

/**
 * Decide el "home" del POS según el rol:
 *   - mesero  → /pos/mesas
 *   - cocina  → /pos/cocina
 *   - cajero  → /pos/caja
 *   - restaurante / admin → /pos/mesas (puede cambiar desde la sidebar)
 *
 * Si es cliente → /  (defensa, no debería llegar acá por ProtectedRoute).
 * Si no hay restaurante asociado (cliente o staff huérfano) → no se puede
 * usar el POS, mostramos mensaje.
 *
 * Para dueños, `user.restaurante_id` viene null (la asociación es via
 * `restaurantes.usuario_id`), así que usamos `usePosRestaurante` que
 * combina con el restaurante hidratado del POSLayout.
 */
export default function POSHomePage() {
  const { user, loading } = useAuth();
  const { restauranteId } = usePosRestaurante();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (user.tipo_usuario === 'cliente') return; // ya redirigido
    // Si es admin sin restaurante, no podemos mandarlo a un POS
    if (!restauranteId && user.tipo_usuario !== 'admin') {
      // No-op, se muestra el mensaje
      return;
    }
    const home =
      user.tipo_usuario === 'cocina' ? '/pos/cocina' :
      user.tipo_usuario === 'cajero' ? '/pos/caja' :
      '/pos/mesas';
    navigate(home, { replace: true });
  }, [user, loading, navigate, restauranteId]);

  if (loading) return <Loading />;
  if (user?.tipo_usuario === 'cliente') return <Navigate to="/" replace />;

  if (!restauranteId && user?.tipo_usuario !== 'admin') {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Sin restaurante asignado</h1>
        <p className="text-[color:var(--text-muted)]">
          Tu cuenta no está asociada a un restaurante. Pídele al dueño que
          te invite desde el panel de Personal.
        </p>
      </div>
    );
  }

  return <Loading />;
}
