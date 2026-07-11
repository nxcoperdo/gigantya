import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { legalService } from '../../services/api';
import LegalModal from './LegalModal';

/**
 * `LegalGate` — gate global que bloquea la app hasta que el usuario
 * acepte los documentos legales correspondientes a su rol.
 *
 * Comportamiento:
 *   - Al montar (o al loguearse un usuario), consulta
 *     `GET /api/legal/estado` para saber qué le falta aceptar.
 *   - Si le falta TyC y/o Privacidad, abre el modal con esos documentos.
 *   - Si es dueño de un restaurante y le falta el Merchant Agreement,
 *     agrega ese doc a la lista después de TyC/Privacidad.
 *   - Una vez aceptado todo, cierra el modal y la app queda desbloqueada.
 *   - No es dismissable: no se puede cerrar sin aceptar.
 *
 * Decisiones:
 *   - El check se dispara cada vez que cambia `user` (login, logout, etc.).
 *   - El check NO se dispara en cada navegación (sería redundante). Solo
 *     cambia cuando aparece un nuevo "missing".
 *   - Si la API falla, NO bloqueamos la app (mejor UX: mostrar un warning
 *     que romper el flujo). El usuario igual ve la página legal cuando
 *     navega a ella.
 *   - El modal es un portal visualmente pero vive en el árbol normal
 *     de React (no es ReactDOM.createPortal), porque los estilos del
 *     modal usan fixed/z-100 que escapa del contexto.
 *
 * `silent` prop: si true, NO se abre el modal. Útil para tests o para
 * esconder el gate en alguna ruta específica (ej. la página del propio
 * documento legal, donde no tiene sentido).
 */
export default function LegalGate({ silent = false }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState(null); // { versions, user: {tyc, privacidad, missing}, merchants: [...] }
  const [loading, setLoading] = useState(false);
  const [docsToAccept, setDocsToAccept] = useState([]); // queue para el modal
  const lastUserIdRef = useRef(null);

  const refreshState = useCallback(async () => {
    if (!isAuthenticated) {
      setState(null);
      setDocsToAccept([]);
      return;
    }
    try {
      setLoading(true);
      const data = await legalService.getEstado();
      setState(data);
      // Construir la lista de docs a aceptar, en orden:
      //   1. TyC
      //   2. Privacidad
      //   3. Merchant (por cada local donde es dueño y no haya firmado)
      const queue = [];
      if (data.user?.missing?.includes('tyc')) {
        queue.push({ tipo: 'tyc', version: data.versions.tyc });
      }
      if (data.user?.missing?.includes('privacidad')) {
        queue.push({ tipo: 'privacidad', version: data.versions.privacidad });
      }
      for (const m of data.merchants || []) {
        if (m.missing?.includes('merchant')) {
          queue.push({
            tipo: 'merchant',
            version: data.versions.merchant,
            restaurante_id: m.restaurante_id,
            restaurante_nombre: m.restaurante_nombre,
          });
        }
      }
      setDocsToAccept(queue);
    } catch (err) {
      console.warn('[LegalGate] No se pudo obtener el estado legal:', err);
      // No bloqueamos la app por un error de la API legal.
      setState(null);
      setDocsToAccept([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Re-chequear al cambiar el usuario (login, logout)
  useEffect(() => {
    const userId = user?.id || null;
    if (userId !== lastUserIdRef.current) {
      lastUserIdRef.current = userId;
      refreshState();
    }
  }, [user, refreshState]);

  const handleModalClose = useCallback(() => {
    setDocsToAccept([]);
  }, []);

  const handleAccepted = useCallback(() => {
    // Re-chequear el estado por si queda algo (en la última iteración no hay
    // que re-chequear, pero si en el futuro hay N+1 docs conviene).
    // En la práctica el modal se cierra solo al terminar todos, así que esto
    // se llama 0 veces hasta cerrar.
  }, []);

  if (silent) return null;
  if (!isAuthenticated) return null;
  if (docsToAccept.length === 0) return null;

  return (
    <LegalModal
      open={docsToAccept.length > 0}
      docs={docsToAccept}
      onClose={handleModalClose}
      onAccepted={handleAccepted}
    />
  );
}
