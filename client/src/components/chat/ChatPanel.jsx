import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { Send, ShoppingBag, X, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Panel del chat del lado del cliente. Se renderiza como un panel
 * flotante cuando `panelOpen` es true.
 *
 * Optimizaciones para mobile:
 *  - BurbujaMensaje es un componente memoizado — solo se re-renderean
 *    los mensajes que cambiaron.
 *  - Auto-scroll inteligente: solo baja si el usuario ya estaba cerca
 *    del final (no le "salta" el scroll si scrolleó hacia arriba
 *    para leer histórico).
 *  - Textarea con auto-resize (rows dinámicos) para que ocupe bien
 *    en mobile sin necesidad de hacer zoom.
 *  - Header con altura fija (sin truncado) — el restauranteNombre
 *    se trunca con CSS.
 *  - Layout bottom-0 full-width en mobile (teclado nativo no tapa el input
 *    porque el panel ya ocupa el bottom).
 */

function formatearHora(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Burbuja memoizada. Re-renderea solo si cambia el mensaje o su
 * conversación (en la práctica: cuando llega un mensaje nuevo).
 */
const BurbujaMensaje = memo(function BurbujaMensaje({ m, conversacionId }) {
  const esMio = m.emisor_tipo === 'cliente';
  const esSistema = m.emisor_tipo === 'sistema';

  if (esSistema) {
    return (
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-1 px-2">
        {m.contenido}
      </div>
    );
  }

  const tieneAdjunto = m.adjuntos_json && typeof m.adjuntos_json === 'object' && m.adjuntos_json.nombre;

  return (
    <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm',
          esMio
            ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm',
        ].join(' ')}
      >
        {tieneAdjunto && (
          <div className="text-xs opacity-80 italic mb-0.5">
            📦 {m.adjuntos_json.nombre}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{m.contenido}</div>
        <div className="text-[10px] opacity-60 mt-0.5 text-right flex items-center justify-end gap-1">
          <span>{formatearHora(m.created_at)}</span>
          {esMio && <span aria-label="Enviado">✓</span>}
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.m === next.m && prev.conversacionId === next.conversacionId);

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
    sendTypingDebounced,
  } = useChat();

  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottomRef = useRef(true);   // ¿el user está abajo del todo?
  const prevMensajesLenRef = useRef(0);

  // Detectar si el usuario está cerca del final del scroll (en px).
  // Si está lejos, NO le saltamos el scroll — está leyendo histórico.
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < 80; // 80px de tolerancia
  }, []);

  // Auto-scroll SOLO si el usuario está abajo (o si llegan mensajes
  // nuevos y no se ha movido). Esto evita el "salto" cuando scrolleás
  // para arriba a leer algo.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const newLen = mensajes.length;
    const grew = newLen > prevMensajesLenRef.current;
    prevMensajesLenRef.current = newLen;
    if (grew && stickToBottomRef.current) {
      // requestAnimationFrame para esperar a que el DOM pinte
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [mensajes]);

  // Auto-scroll al abrir
  useEffect(() => {
    if (panelOpen && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
        stickToBottomRef.current = true;
      });
    }
  }, [panelOpen]);

  // Focus en el input al abrir (mobile: esto dispara el teclado)
  useEffect(() => {
    if (panelOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [panelOpen]);

  // Typing con debounce (en lugar de emitir cada keystroke)
  useEffect(() => {
    sendTypingDebounced(input.trim().length > 0);
  }, [input, sendTypingDebounced]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!input.trim() || sendingMensaje) return;
    const texto = input;
    setInput('');
    // Scroll al final cuando mandamos
    stickToBottomRef.current = true;
    try {
      await sendMensaje(texto);
    } catch (err) {
      setInput(texto);
    }
  }, [input, sendingMensaje, sendMensaje]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Estilo del contenedor, memoizado.
  // Mobile: bottom-24 para dejar el ChatLauncher (bottom-5) y la nav
  // del browser visible. z-40 para estar encima del catálogo
  // (que tiene z-30 con transform/filter en algunos componentes).
  // En desktop, esquina derecha como antes.
  const panelClass = useMemo(() => (
    'fixed z-40 ' +
    'inset-x-2 bottom-24 ' +
    'sm:inset-auto sm:bottom-20 sm:right-4 sm:w-96 ' +
    'bg-white dark:bg-gray-800 rounded-2xl sm:rounded-lg ' +
    'shadow-2xl flex flex-col overflow-hidden ' +
    'border border-gray-200 dark:border-gray-700'
  ), []);

  if (!panelOpen) return null;

  // Mientras la conversación no esté lista
  if (!conversacion) {
    return (
      <div
        role="dialog"
        aria-label="Cargando chat"
        className="fixed z-40 inset-x-2 bottom-24 sm:inset-auto sm:bottom-20 sm:right-4 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        style={{ maxHeight: 'calc(100vh - 9rem)' }}
      >
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">
              {restauranteNombre || 'Chat con el local'}
            </div>
            <div className="text-xs opacity-90">conectando…</div>
          </div>
          <button onClick={closePanel} aria-label="Cerrar chat" className="p-1.5 hover:bg-white/10 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400 flex-1 flex items-center justify-center">
          {loadingConv ? 'Cargando conversación…' : 'Por esperá un momento…'}
        </div>
      </div>
    );
  }

  const isConvertida = conversacion.estado === 'convertida';

  return (
    <div
      role="dialog"
      aria-label={`Chat con ${restauranteNombre || 'el local'}`}
      className={panelClass}
      style={{
        // En mobile la altura la limita el viewport considerando el bottom-24
        // (deja el ChatLauncher visible). En sm+ queda top-auto y usa max-h.
        maxHeight: 'calc(100vh - 9rem)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-white flex-shrink-0"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {restauranteNombre || 'Chat con el local'}
          </div>
          <div className="text-[11px] opacity-90 flex items-center gap-1">
            {onlineCount > 1 ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{onlineCount > 1 ? 'en línea' : 'conectado'}</span>
            {isConvertida && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                Pedido armado
              </span>
            )}
          </div>
        </div>
        <button
          onClick={closePanel}
          aria-label="Cerrar chat"
          className="p-1.5 hover:bg-white/10 rounded flex-shrink-0"
        >
          <X size={20} />
        </button>
      </div>

      {/* Lista de mensajes */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-gray-50 overscroll-contain"
        style={{ backgroundColor: '#f9fafb' }}
      >
        {loadingConv && mensajes.length === 0 && (
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
        {mensajes.map((m) => (
          <BurbujaMensaje key={m.id} m={m} conversacionId={conversacion.id} />
        ))}
        {otroEscribiendo && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg rounded-bl-sm px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="inline-flex gap-0.5" aria-label="Escribiendo">
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
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs flex-shrink-0">
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-2 bg-white dark:bg-gray-800 flex-shrink-0"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={500}
          placeholder="Escribí tu mensaje…"
          aria-label="Mensaje"
          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base resize-none"
          style={{ maxHeight: '120px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sendingMensaje}
          className="flex-shrink-0 min-h-[44px] min-w-[52px] rounded-md text-white disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center touch-manipulation"
          style={{ backgroundColor: 'var(--color-primary)' }}
          aria-label="Enviar mensaje"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Footer con link a carrito — en mobile lo mostramos más compacto
          (sin el texto "Conversación con el local" para ganar ~24px) y
          solo el link a carrito. En desktop sí va el texto. */}
      <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-end text-xs flex-shrink-0">
        <span className="hidden sm:inline text-gray-500 mr-auto">
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
