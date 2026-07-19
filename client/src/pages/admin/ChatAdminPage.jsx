import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import chatService from '../../services/chat.js';
import socketService from '../../services/socket.js';
import { MessageCircle, Send, ArrowLeft, ShoppingCart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import ArmarPedidoModal from './ArmarPedidoModal.jsx';

/**
 * Página del chat del lado del VENDEDOR.
 *
 * Ruta: /dashboard/chat (accesible por cualquier rol staff del local).
 * Piloto: solo el dueño del local 4 lo usa realmente, pero la ruta está
 * abierta a todos los roles.
 *
 * Layout:
 *  - Mobile-first: tabs entre "Conversaciones" y el chat activo.
 *  - Desktop: 2 columnas fijas (lista + chat).
 *  - Lista: avatar con inicial, último mensaje, hora, badge de no leídos,
 *    dot verde si el cliente está online.
 *  - Chat: header con nombre+tel del cliente + botón "Armar pedido", body
 *    con burbujas, footer con textarea.
 */
export default function ChatAdminPage() {
  const { user } = useAuth();
  const [conversaciones, setConversaciones] = useState([]);
  const [convActivaId, setConvActivaId] = useState(null);
  const [convActiva, setConvActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const [online, setOnline] = useState(false);
  const [noLeidosTotal, setNoLeidosTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [armarPedidoOpen, setArmarPedidoOpen] = useState(false);

  // Mobile: en mobile se muestra una pantalla a la vez. Si no hay conv
  // activa, mostramos la lista. Si hay, mostramos el chat con un botón
  // para volver.
  const [mobileMostrarChat, setMobileMostrarChat] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const convActivaIdRef = useRef(null);
  convActivaIdRef.current = convActivaId;

  // ============ Carga inicial ============

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await chatService.adminListConversaciones({ estado: 'todas' });
        if (cancelled) return;
        setConversaciones(data.conversaciones || []);
        setNoLeidosTotal(data.no_leidos_total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ============ Listeners de socket ============

  useEffect(() => {
    const handleNew = (payload) => {
      if (!payload || !payload.mensaje) return;
      // Actualizar el item de la conversación en la lista
      setConversaciones((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversacion_id);
        if (idx < 0) return prev;
        const updated = {
          ...prev[idx],
          ultimo_mensaje_en: payload.mensaje.created_at,
          ultimo_mensaje_preview: payload.mensaje.contenido,
          // Si es del cliente, incrementar no_leidos (a menos que sea la activa)
          no_leidos: payload.mensaje.emisor_tipo === 'cliente'
            ? (Number(prev[idx].no_leidos) || 0) + (convActivaIdRef.current === payload.conversacion_id ? 0 : 1)
            : prev[idx].no_leidos,
        };
        // Reordenar por actividad
        const sinEste = prev.filter((_, i) => i !== idx);
        return [updated, ...sinEste];
      });
      // Si es la conv activa, agregar el mensaje a la lista
      if (convActivaIdRef.current === payload.conversacion_id) {
        setMensajes((prev) => prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]);
      }
    };
    const handleTyping = (payload) => {
      if (!payload) return;
      if (payload.conversacion_id !== convActivaIdRef.current) return;
      if (payload.typing) {
        setOtroEscribiendo(true);
      } else {
        setOtroEscribiendo(false);
      }
    };
    const handlePresence = (payload) => {
      if (!payload) return;
      if (payload.conversacion_id !== convActivaIdRef.current) return;
      setOnline(payload.online > 1); // >1 porque el vendedor también está en el room
    };
    const handleNewAdmin = (payload) => {
      // Broadcast de nueva mensaje al restaurante (incluye los del vendedor
      // que el cliente no haya leído). Lo tratamos igual que handleNew pero
      // ya tenemos el mensaje en el room; simplemente refrescamos contadores.
      if (!payload) return;
      setConversaciones((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversacion_id);
        if (idx < 0) return prev;
        return prev.map((c, i) => i === idx
          ? { ...c, ultimo_mensaje_en: payload.mensaje.created_at, ultimo_mensaje_preview: payload.mensaje.contenido }
          : c);
      });
    };

    socketService.onNewChatMessage(handleNew);
    socketService.onChatTyping(handleTyping);
    socketService.onChatPresence(handlePresence);
    socketService.onNewChatMessage(handleNewAdmin);
    return () => {
      socketService.offNewChatMessage(handleNew);
      socketService.offChatTyping(handleTyping);
      socketService.offChatPresence(handlePresence);
      socketService.offNewChatMessage(handleNewAdmin);
    };
  }, []);

  // ============ Abrir conversación ============

  const abrirConversacion = useCallback(async (conv) => {
    setConvActivaId(conv.id);
    setConvActiva(conv);
    setMobileMostrarChat(true);
    setMensajes([]);
    setOtroEscribiendo(false);
    // Unirse al room
    try {
      const ack = await socketService.joinConversation(conv.id);
      setOnline(ack.online > 1);
    } catch (e) {
      console.warn('[chat] joinConversation admin:', e.message);
    }
    // Cargar historial
    try {
      const data = await chatService.listMensajes(conv.id);
      setMensajes(data.mensajes || []);
      // Marcar como leído
      await chatService.markRead(conv.id);
      // Limpiar no_leidos de esta conv en la lista
      setConversaciones((prev) => prev.map((c) => c.id === conv.id ? { ...c, no_leidos: 0 } : c));
      setNoLeidosTotal((n) => Math.max(0, n - (conv.no_leidos || 0)));
    } catch (err) {
      setError(err.message);
    }
    // Focus en el input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ============ Enviar mensaje ============

  const enviarMensaje = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending || !convActivaId) return;
    const texto = input;
    setInput('');
    setSending(true);
    try {
      const msg = await chatService.sendMensaje(convActivaId, { contenido: texto });
      setMensajes((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      setInput(texto); // devolver al input si falló
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  useEffect(() => {
    if (convActivaId) {
      socketService.sendTyping(convActivaId, input.trim().length > 0);
    }
  }, [input, convActivaId]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [mensajes, otroEscribiendo]);

  // ============ Helpers ============

  const formatHora = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const iniciales = (nombre) => {
    if (!nombre) return '?';
    return nombre.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
  };

  const conversacionesFiltradas = conversaciones.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.cliente_nombre || '').toLowerCase().includes(q) ||
           (c.cliente_telefono || '').toLowerCase().includes(q);
  });

  const volverALista = () => {
    setMobileMostrarChat(false);
    if (convActivaId) {
      socketService.leaveConversation(convActivaId);
      setConvActivaId(null);
      setConvActiva(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[color:var(--bg-subtle)]">
      {/* Header */}
      <div className="bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] px-4 py-3 flex items-center gap-3">
        {mobileMostrarChat && (
          <button
            onClick={volverALista}
            className="md:hidden p-1 -ml-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            aria-label="Volver a la lista"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <MessageCircle size={20} className="text-[var(--color-primary)]" />
        <h1 className="font-bold text-lg text-[color:var(--text-primary)]">Chat con clientes</h1>
        {noLeidosTotal > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#ef4444' }}>
            {noLeidosTotal}
          </span>
        )}
        <Link to="/dashboard" className="ml-auto text-sm text-[var(--color-primary)] hover:underline">
          Volver al panel
        </Link>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de conversaciones */}
        <aside
          className={[
            'w-full md:w-80 md:border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] flex flex-col overflow-hidden',
            mobileMostrarChat ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >
          <div className="p-3 border-b border-[color:var(--border-subtle)]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full pl-9 pr-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-sm text-[color:var(--text-muted)]">Cargando…</div>
            )}
            {error && (
              <div className="p-4 text-center text-sm text-red-600">{error}</div>
            )}
            {!loading && conversacionesFiltradas.length === 0 && (
              <div className="p-8 text-center text-sm text-[color:var(--text-muted)]">
                {search ? 'Sin resultados' : 'No hay conversaciones todavía.'}
              </div>
            )}
            {conversacionesFiltradas.map((c) => (
              <button
                key={c.id}
                onClick={() => abrirConversacion(c)}
                className={[
                  'w-full text-left px-3 py-3 flex gap-3 hover:bg-[color:var(--bg-subtle)] border-b border-[color:var(--border-subtle)] transition-colors',
                  convActivaId === c.id ? 'bg-[color:var(--bg-subtle)]' : '',
                ].join(' ')}
              >
                <div className="relative w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {iniciales(c.cliente_nombre)}
                  {/* Dot verde: indicador de online (placeholder por ahora;
                      podríamos wirearlo al evento chat:presence global) */}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-sm text-[color:var(--text-primary)] truncate">
                      {c.cliente_nombre || `Cliente #${c.id}`}
                    </span>
                    <span className="text-[10px] text-[color:var(--text-muted)] flex-shrink-0">
                      {formatHora(c.ultimo_mensaje_en || c.updated_at)}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] truncate">
                    {c.ultimo_mensaje_preview || <em>Sin mensajes</em>}
                  </div>
                </div>
                {Number(c.no_leidos) > 0 && (
                  <span className="flex-shrink-0 self-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: '#ef4444' }}>
                    {c.no_leidos > 9 ? '9+' : c.no_leidos}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Panel de chat activo */}
        <section
          className={[
            'flex-1 flex flex-col bg-[color:var(--bg-subtle)] overflow-hidden',
            mobileMostrarChat ? 'flex' : 'hidden md:flex',
          ].join(' ')}
        >
          {!convActivaId && (
            <div className="flex-1 flex items-center justify-center text-[color:var(--text-muted)]">
              <div className="text-center px-4">
                <MessageCircle size={48} className="mx-auto opacity-30 mb-3" />
                <p className="text-sm">Elegí una conversación para empezar</p>
              </div>
            </div>
          )}

          {convActivaId && (
            <>
              {/* Header del chat activo */}
              <div className="px-4 py-3 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm">
                  {iniciales(convActiva?.cliente_nombre)}
                  {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[color:var(--text-primary)] truncate">
                    {convActiva?.cliente_nombre || 'Cliente'}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {convActiva?.cliente_telefono || '—'}
                    {convActiva?.estado === 'convertida' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">
                        Pedido #{convActiva?.pedido_id} creado
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setArmarPedidoOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-sm font-semibold active:scale-95 transition-transform"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <ShoppingCart size={14} />
                  Armar pedido
                </button>
              </div>

              {/* Lista de mensajes */}
              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {mensajes.length === 0 && (
                  <div className="text-center text-sm text-[color:var(--text-muted)] py-8">
                    Sin mensajes todavía. ¡Escribíle al cliente!
                  </div>
                )}
                {mensajes.map((m) => {
                  const esMio = m.emisor_tipo === 'vendedor';
                  const esSistema = m.emisor_tipo === 'sistema';
                  if (esSistema) {
                    return (
                      <div key={m.id} className="text-center text-xs text-[color:var(--text-muted)] py-1">
                        {m.contenido}
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={[
                          'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                          esMio
                            ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] rounded-bl-sm',
                        ].join(' ')}
                      >
                        {m.adjuntos_json && typeof m.adjuntos_json === 'object' && m.adjuntos_json.nombre && (
                          <div className="text-xs opacity-80 italic mb-0.5">
                            📦 {m.adjuntos_json.nombre}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.contenido}</div>
                        <div className="text-[10px] opacity-60 mt-0.5 text-right">
                          {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {otroEscribiendo && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-700 border border-[color:var(--border-subtle)] rounded-lg rounded-bl-sm px-3 py-2 text-sm">
                      <span className="inline-flex gap-0.5">
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={enviarMensaje}
                className="border-t border-[color:var(--border-subtle)] p-2 flex gap-2 bg-[color:var(--bg-elevated)]"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={500}
                  placeholder="Escribí un mensaje…"
                  className="flex-1 px-3 py-2 border border-[color:var(--border-subtle)] rounded-md bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] text-sm resize-none"
                  style={{ maxHeight: '80px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="px-3 rounded-md text-white disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  aria-label="Enviar"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Modal de armar pedido */}
      {armarPedidoOpen && convActiva && (
        <ArmarPedidoModal
          conversacion={convActiva}
          onClose={() => setArmarPedidoOpen(false)}
          onCreated={(pedidoId) => {
            setArmarPedidoOpen(false);
            // Refrescar la conv para que muestre el badge "Pedido #N creado"
            setConvActiva((c) => c ? { ...c, estado: 'convertida', pedido_id: pedidoId } : c);
          }}
        />
      )}
    </div>
  );
}
