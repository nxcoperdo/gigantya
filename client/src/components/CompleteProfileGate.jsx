import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addressService } from '../services/api';
import CompleteProfileModal from './CompleteProfileModal';

/**
 * `CompleteProfileGate` — gate global que muestra el modal de completar
 * perfil a los clientes que se registraron con Google.
 *
 * Detección: un cliente que NO tiene ninguna dirección guardada. Los usuarios
 * que se registran por email siempre crean una dirección en el registro, así
 * que en la práctica esto solo dispara para cuentas de Google (que entran sin
 * dirección ni teléfono).
 *
 * Orden respecto al legal: este modal usa z-[90] y el LegalModal z-[100], así
 * que si ambos están abiertos el legal va arriba y este aparece recién cuando
 * el usuario termina de aceptar los documentos.
 *
 * "Completar más tarde": se recuerda por sesión (sessionStorage) para no
 * molestar en cada navegación; vuelve a aparecer en la próxima sesión hasta
 * que el usuario cargue su dirección (o la agregue en el checkout).
 */
export default function CompleteProfileGate() {
  const { user, isAuthenticated } = useAuth();
  const [show, setShow] = useState(false);
  const checkedForRef = useRef(null);

  useEffect(() => {
    const uid = user?.id || null;

    // Solo para clientes autenticados
    if (!isAuthenticated || !uid || user?.tipo_usuario !== 'cliente') {
      setShow(false);
      return;
    }
    // Si ya lo pospuso en esta sesión, no insistir
    if (sessionStorage.getItem(`cp_skip_${uid}`)) {
      setShow(false);
      return;
    }
    // Chequear una sola vez por usuario (evita re-fetch en cada cambio de `user`)
    if (checkedForRef.current === uid) return;
    checkedForRef.current = uid;

    let cancelled = false;
    (async () => {
      try {
        const res = await addressService.getAll();
        const list = res.data.addresses || [];
        if (!cancelled) setShow(list.length === 0);
      } catch (err) {
        // Ante un error de red no bloqueamos ni molestamos al usuario.
        console.warn('[CompleteProfileGate] no se pudo verificar direcciones:', err);
        if (!cancelled) setShow(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAuthenticated]);

  const handleComplete = () => setShow(false);

  const handleSkip = () => {
    if (user?.id) sessionStorage.setItem(`cp_skip_${user.id}`, '1');
    setShow(false);
  };

  if (!show) return null;
  return <CompleteProfileModal onComplete={handleComplete} onSkip={handleSkip} />;
}
