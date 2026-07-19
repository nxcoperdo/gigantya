import { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { MessageCircle, X } from 'lucide-react';

/**
 * Botón flotante abajo a la derecha con badge de mensajes no leídos.
 * Solo se muestra cuando hay un restaurante activo (gated por
 * RestaurantDetailsPage) y hay identidad (después del modal).
 *
 * En mobile reemplaza a la MobileCartBar para el local 4 (gatillo
 * visual para el chat; el carrito queda accesible por un link dentro
 * del panel si el usuario está logueado).
 */
export default function ChatLauncher() {
  const { panelOpen, openPanel, closePanel, mensajes, conversacion } = useChat();
  const [noLeidos, setNoLeidos] = useState(0);

  // Contar mensajes del vendedor (o sistema) que el cliente no ha leído.
  // No tenemos un flag "leido_por_cliente" persistente todavía, así que
  // usamos un proxy: contar mensajes del vendedor cuyo created_at es
  // posterior a la última vez que el panel estuvo abierto.
  // Para MVP, mostramos un dot pulsante si hay CUALQUIER mensaje del
  // vendedor y el panel está cerrado.
  useEffect(() => {
    if (panelOpen) {
      setNoLeidos(0);
      return;
    }
    if (!conversacion) {
      setNoLeidos(0);
      return;
    }
    const ultDelVendedor = mensajes.filter(
      (m) => m.emisor_tipo === 'vendedor' || m.emisor_tipo === 'sistema'
    ).length;
    setNoLeidos(ultDelVendedor);
  }, [panelOpen, conversacion, mensajes]);

  if (panelOpen) {
    return (
      <button
        onClick={closePanel}
        aria-label="Cerrar chat"
        className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <X size={24} />
      </button>
    );
  }

  return (
    <button
      onClick={openPanel}
      aria-label="Abrir chat con el local"
      className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      <MessageCircle size={24} />
      {noLeidos > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center text-white"
          style={{ backgroundColor: '#ef4444' }}
          aria-label={`${noLeidos} mensajes sin leer`}
        >
          {noLeidos > 9 ? '9+' : noLeidos}
        </span>
      )}
    </button>
  );
}
