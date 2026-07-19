import { useState } from 'react';
import { Share2, Copy, Check, X, MessageCircle, ExternalLink } from 'lucide-react';

/**
 * Modal para compartir el enlace público del local con los clientes
 * (WhatsApp, copiar, compartir nativo). Controlado por el padre.
 *
 * Props:
 *  - isOpen, onClose
 *  - restauranteId: id del local (para armar /restaurant/:id)
 */
export default function ShareLocalModal({ isOpen, onClose, restauranteId }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !restauranteId) return null;

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
      const el = document.getElementById('share-url-input');
      if (el) { el.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    }
  };

  const compartirNativo = async () => {
    try {
      await navigator.share({ title: 'Mi local en Gigantya', text: '¡Haz tu pedido en línea!', url });
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[color:var(--bg-elevated)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <button
            onClick={onClose}
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
            Con este enlace tus clientes entran directo a tu menú y hacen el pedido en línea, sin necesidad de instalar nada.
          </p>

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
  );
}
