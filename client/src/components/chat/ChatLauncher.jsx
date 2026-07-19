import { memo } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { MessageCircle, X } from 'lucide-react';

/**
 * Botón flotante del chat. Se posiciona abajo-izquierda para no chocar
 * con ClientHelpButton (abajo-derecha). Memoizado para no re-renderear
 * cuando cambian otras partes del ChatContext.
 */
function ChatLauncherBase() {
  const { panelOpen, openPanel, closePanel, conversacion, mensajes } = useChat();

  // Contar mensajes del vendedor (o sistema) que el cliente no ha leído.
  // Para MVP: si hay cualquier mensaje del vendedor y el panel está
  // cerrado, mostramos el dot pulsante.
  let noLeidos = 0;
  if (!panelOpen && conversacion) {
    noLeidos = mensajes.filter(
      (m) => m.emisor_tipo === 'vendedor' || m.emisor_tipo === 'sistema'
    ).length;
  }

  const handleClick = panelOpen ? closePanel : openPanel;
  const ariaLabel = panelOpen
    ? 'Cerrar chat'
    : noLeidos > 0
      ? `Abrir chat con el local (${noLeidos} sin leer)`
      : 'Abrir chat con el local';

  return (
    <button
      onClick={handleClick}
      aria-label={ariaLabel}
      className="fixed bottom-5 left-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-95 touch-manipulation"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {panelOpen ? <X size={24} /> : <MessageCircle size={24} />}
      {!panelOpen && noLeidos > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center text-white pointer-events-none"
          style={{ backgroundColor: '#ef4444' }}
          aria-hidden="true"
        >
          {noLeidos > 9 ? '9+' : noLeidos}
        </span>
      )}
    </button>
  );
}

// memo: solo re-renderea si panelOpen, conversacion, o mensajes cambian
// de referencia (lo cual ya filtramos en el Context con useMemo).
const ChatLauncher = memo(ChatLauncherBase);
export default ChatLauncher;
