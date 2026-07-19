import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Share2, Copy, Check, X, MessageCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Botón flotante para que el DUEÑO comparta el enlace público de su local
 * con sus clientes (WhatsApp, copiar, o el compartir nativo del celular).
 *
 * - Solo para `tipo_usuario === 'restaurante'` en /dashboard y /pos/*.
 * - Posición: abajo-izquierda (el HelpButton "?" ocupa abajo-derecha).
 * - El enlace es la página pública del local: /restaurant/:id
 */
export default function ShareLinkButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user || user.tipo_usuario !== 'restaurante') return null;

  const onPath =
    location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/pos');
  if (!onPath) return null;

  const restauranteId = user.restaurante_id;
  if (!restauranteId) return null;

  const url = `${window.location.origin}/restaurant/${restauranteId}`;
  const mensaje = `¡Haz tu pedido en línea de forma fácil! 🍽️👇\n${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  const puedeCompartirNativo = typeof navigator !== 'undefined' && !!navigator.share;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: seleccionar el texto del input para copiar a mano
      const el = document.getElementById('share-url-input');
      if (el) { el.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    }
  };

  const compartirNativo = async () => {
    try {
      await navigator.share({ title: 'Mi local en Gigantya', text: '¡Haz tu pedido en línea!', url });
    } catch {
      /* el usuario canceló el share nativo */
    }
  };

  return (
    <>
      {/* FAB abajo-izquierda */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Compartir el enlace de mi local"
        title="Compartir el enlace de mi local"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-transform font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
      >
        <Share2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span>Compartir mi local</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-[color:var(--bg-elevated)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="relative px-6 py-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Share2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-heading leading-tight">Comparte tu local</h2>
                  <p className="text-white/85 text-sm">Envía este enlace a tus clientes</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-[color:var(--text-secondary)]">
                Con este enlace tus clientes entran directo a tu menú y hacen el pedido en línea.
              </p>

              {/* Enlace + copiar */}
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] p-1.5">
                <input
                  id="share-url-input"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm text-[color:var(--text-primary)] outline-none"
                />
                <button
                  onClick={copiar}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:bg-primaryDark'}`}
                >
                  {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
                </button>
              </div>

              {/* Acciones */}
              <div className="space-y-2">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
                >
                  <MessageCircle size={20} /> Compartir por WhatsApp
                </a>

                {puedeCompartirNativo && (
                  <button
                    onClick={compartirNativo}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[color:var(--border-default)] text-[color:var(--text-primary)] font-semibold hover:bg-[color:var(--bg-subtle)] transition-colors"
                  >
                    <Share2 size={18} /> Compartir…
                  </button>
                )}

                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-[color:var(--text-secondary)] hover:text-primary transition-colors"
                >
                  <ExternalLink size={16} /> Ver cómo lo ven tus clientes
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
