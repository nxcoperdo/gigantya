import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para que las páginas del POS obtengan el `restauranteId` correcto
 * sin tener que conocer el detalle de cómo se hidrata.
 *
 * El problema que resuelve: para dueños (`tipo_usuario === 'restaurante'`),
 * `user.restaurante_id` viene `null` en el `localStorage` (la asociación
 * es via `restaurantes.usuario_id`, no `usuarios.restaurante_id`).
 * El POSLayout sí hace el fetch via `/api/restaurants/me` y pasa el
 * restaurante hidratado por Outlet context; este hook combina esa
 * información con la del AuthContext y devuelve el id correcto.
 *
 * Uso:
 *   const { user, restaurante, restauranteId } = usePosRestaurante();
 *   if (!restauranteId) return <SinRestaurante />;
 *   api.get(`/products/restaurant/${restauranteId}`)
 */
export function usePosRestaurante() {
  const { user } = useAuth();
  const ctx = useOutletContext() || {};
  const restaurante = ctx.restaurante || null;
  const restauranteId = user?.restaurante_id ?? restaurante?.id ?? null;
  return { user, restaurante, restauranteId };
}
