import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * Wrapper de autorización.
 *
 * Acepta DOS modos (compat con código existente):
 *   1) `requiredRole="cliente"` — chequea un único rol.
 *   2) `allowedRoles={['cajero','mesero','cocina','restaurante','admin']}`
 *      — chequea que el rol del usuario esté en la lista. Usado por el
 *      POS para agrupar varios roles en una sola ruta.
 *
 * Si ambos vienen, `allowedRoles` gana. Si ninguno viene, solo requiere
 * autenticación (cualquier rol pasa).
 */
export default function ProtectedRoute({ children, requiredRole = null, allowedRoles = null }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user?.tipo_usuario)) {
      return <Navigate to="/" replace />;
    }
  } else if (requiredRole && user?.tipo_usuario !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

