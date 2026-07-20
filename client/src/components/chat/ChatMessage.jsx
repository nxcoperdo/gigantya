import { memo } from 'react';
import { getImageUrl } from '../../utils/imageHelper.js';

// Placeholder que usa el backend cuando se sube una foto sin texto.
// La UI lo oculta para no mostrar "📷 Foto" debajo de la imagen.
const IMG_PLACEHOLDER = '📷 Foto';

/**
 * Burbuja de un mensaje del chat. Memoizada: solo re-renderea si cambia
 * el mensaje o su conversación.
 *
 * Se usa tanto en el panel flotante (ChatPanel) como en la vista de
 * página completa (ChatDetailPage). Mantener una sola implementación
 * garantiza que el estilo y la lógica de "es mío / es del vendedor /
 * es de sistema" sean consistentes.
 *
 * Tipos de emisor (campo `m.emisor_tipo`):
 *   - 'cliente':  se renderiza a la derecha, fondo primary.
 *   - 'vendedor': a la izquierda, fondo blanco con borde.
 *   - 'sistema':  centrado en pill gris claro (mensajes automáticos
 *                como "Pedido #N creado").
 *
 * Adjuntos (`m.adjuntos_json`):
 *   - null: sin adjunto.
 *   - { tipo: 'imagen', url, ... }: render de imagen clickeable.
 *   - { producto_id, nombre, precio }: pill "📦 nombre" (cliente clickeó
 *     en el catálogo).
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

const ChatMessage = memo(function ChatMessage({ m, conversacionId }) {
  const esMio = m.emisor_tipo === 'cliente';
  const esSistema = m.emisor_tipo === 'sistema';

  if (esSistema) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-gray-600 dark:text-gray-300 bg-gray-200/80 dark:bg-gray-700/70 rounded-full px-3 py-1">
          {m.contenido}
        </span>
      </div>
    );
  }

  const adj = (m.adjuntos_json && typeof m.adjuntos_json === 'object') ? m.adjuntos_json : null;
  const esImagen = adj?.tipo === 'imagen' && adj.url;
  const tieneProducto = adj?.nombre && !esImagen;
  // No mostramos el texto si es el placeholder de una foto sin caption.
  const mostrarTexto = m.contenido && !(esImagen && m.contenido === IMG_PLACEHOLDER);

  return (
    <div
      className={[
        'flex',
        esMio ? 'justify-end chat-msg-in-mine' : 'justify-start chat-msg-in-theirs',
      ].join(' ')}
    >
      <div
        className={[
          'max-w-[80%] rounded-2xl text-sm shadow-sm overflow-hidden',
          esImagen ? 'p-1' : 'px-3 py-2',
          esMio
            ? 'bg-[var(--color-primary)] text-white rounded-br-md'
            : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] rounded-bl-md',
        ].join(' ')}
      >
        {tieneProducto && (
          <div className="text-xs opacity-80 italic mb-0.5 px-1">📦 {adj.nombre}</div>
        )}
        {esImagen && (
          <a
            href={getImageUrl(adj.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            aria-label="Ver imagen completa"
          >
            <img
              src={getImageUrl(adj.url)}
              alt="Imagen enviada en el chat"
              loading="lazy"
              decoding="async"
              className="rounded-xl max-h-60 w-full object-cover"
            />
          </a>
        )}
        {mostrarTexto && (
          <div className={`whitespace-pre-wrap break-words ${esImagen ? 'px-2 pt-1.5' : ''}`}>
            {m.contenido}
          </div>
        )}
        <div className={`text-[10px] opacity-60 mt-0.5 text-right flex items-center justify-end gap-1 ${esImagen ? 'px-2 pb-0.5' : ''}`}>
          <span>{formatearHora(m.created_at)}</span>
          {esMio && <span aria-label="Enviado">✓</span>}
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.m === next.m && prev.conversacionId === next.conversacionId);

export default ChatMessage;
