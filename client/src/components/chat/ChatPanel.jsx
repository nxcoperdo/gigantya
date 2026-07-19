import { useEffect, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { Send, ShoppingBag, X, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import socketService from '../../services/socket.js';

/**
 * Panel del chat del lado del cliente. Se renderiza como un panel
 * flotante en la esquina inferior derecha cuando `panelOpen` es true.
 *
 * Sigue el patrón visual de las apps de mensajería:
 *  - Header con nombre del local + estado de conexión
 *  - Lista de mensajes con scroll automático
 *  - Input con Enter para enviar + typing indicator
 */
export default function ChatPanel({ restauranteNombre }) {
  const {
    panelOpen,
    closePanel,
    conversacion,
    mensajes,
    loadingConv,
    sendingMensaje,
    error,
    onlineCount,
    otroEscribiendo,
    sendMensaje,
  } = useChat();

  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al último mensaje cuando cambia la lista
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensajes, otroEscribiendo]);

  // Focus en el input al abrir
  useEffect(() => {
    if (panelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [panelOpen]);

  // Avisar al server que estamos escribiendo
  useEffect(() => {
    if (!conversacion) return;
    if (input.trim().length > 0) {
      socketService.sendTyping(conversacion.id, true);
    } else {
      socketService.sendTyping(conversacion.id, false);
    }
  }, [input, conversacion]);

  if (!panelOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || sendingMensaje) return;
    const texto = input;
    setInput('');
    try {
      await sendMensaje(texto);
    } catch (err) {
      // Si falló el envío, devolvemos el texto al input
      setInput(texto);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const estadoBadge = (m) => {
    if (m.emisor_tipo === 'cliente') {
      return <span className="text-[10px] opacity-60 ml-1">✓</span>;
    }
    return null;
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 sm:inset-auto sm:bottom-20 sm:right-4 sm:w-96 sm:max-h-[600px] bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ height: 'min(85vh, 600px)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {restauranteNombre || 'Chat con el local'}
          </div>
          <div className="text-xs opacity-90 flex items-center gap-1">
            {onlineCount > 1 ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{onlineCount > 1 ? 'en línea' : 'conectado'}</span>
            {conversacion?.estado === 'convertida' && (
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                Pedido armado
              </span>
            )}
          </div>
        </div>
        <button
          onClick={closePanel}
          aria-label="Cerrar chat"
          className="p-1.5 hover:bg-white/10 rounded"
        >
          <X size={20} />
        </button>
      </div>

      {/* Lista de mensajes */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-900"
        style={{ scrollBehavior: 'smooth' }}
      >
        {loadingConv && (
          <div className="text-center text-sm text-gray-500 py-4">Cargando…</div>
        )}
        {!loadingConv && mensajes.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8 px-4">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              ¡Hola! 👋
            </p>
            <p className="mt-1">
              Escribinos qué necesitás y te armamos el pedido.
            </p>
            <p className="text-xs mt-3 opacity-70">
              También podés tocar el botón "Enviar al chat" en cualquier
              producto del catálogo.
            </p>
          </div>
        )}
        {mensajes.map((m) => {
          const esMio = m.emisor_tipo === 'cliente';
          const esSistema = m.emisor_tipo === 'sistema';
          if (esSistema) {
            return (
              <div key={m.id} className="text-center text-xs text-gray-500 dark:text-gray-400 py-1">
                {m.contenido}
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={[
                  'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                  esMio
                    ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm',
                ].join(' ')}
              >
                {m.adjuntos_json && typeof m.adjuntos_json === 'object' && m.adjuntos_json.nombre && (
                  <div className="text-xs opacity-80 italic mb-0.5">
                    📦 {m.adjuntos_json.nombre}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.contenido}</div>
                <div className="text-[10px] opacity-60 mt-0.5 text-right">
                  {new Date(m.created_at).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {estadoBadge(m)}
                </div>
              </div>
            </div>
          );
        })}
        {otroEscribiendo && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg rounded-bl-sm px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-2 bg-white dark:bg-gray-800"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={500}
          placeholder="Escribí tu mensaje…"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
          style={{ maxHeight: '80px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sendingMensaje}
          className="px-3 rounded-md text-white disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-primary)' }}
          aria-label="Enviar"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Footer con link a carrito si el user está logueado */}
      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
        <span className="text-gray-500">
          Conversación con el local
        </span>
        <Link
          to="/cart"
          className="text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          <ShoppingBag size={12} />
          Ver mi carrito
        </Link>
      </div>
    </div>
  );
}
