/**
 * Modal de selección de destino del pedido POS (Fase 3).
 *
 * El mesero elige UNA opción:
 *   - Mesa: lista de mesas `libre` (no se puede asignar pedido a mesa ocupada
 *     — si ya está ocupada, redirigir a la mesa existente o rechazar).
 *   - Recoger (pickup): para llevar, sin mesa.
 *   - Domicilio (delivery): requiere dirección (se pide después con
 *     `direccion_entrega`).
 *
 * La dirección de delivery NO se pide acá: este modal es de selección de
 * "tipo + mesa". Si el flujo posterior la requiere, el caller (TakeOrder)
 * muestra un campo aparte antes de enviar.
 */
import { useEffect, useState, useRef } from 'react';
import { X, Coffee, ShoppingBag, Truck, Users, ArrowRight, Loader2 } from 'lucide-react';
import { posTablesService } from '../../services/api';

const TABS = [
  { key: 'mesa',     label: 'Mesa',      Icon: Coffee,      desc: 'Atender en el local' },
  { key: 'pickup',   label: 'Recoger',   Icon: ShoppingBag, desc: 'Para llevar' },
  { key: 'delivery', label: 'Domicilio', Icon: Truck,       desc: 'Enviar a dirección' },
];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function TablePickerModal({ onClose, onPicked }) {
  const [tab, setTab] = useState('mesa'); // 'mesa' | 'pickup' | 'delivery'
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [direccion, setDireccion] = useState('');
  const addressRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await posTablesService.list();
        if (!cancelled) {
          const list = r.data.mesas || r.data || [];
          setMesas(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Foco automático al tab de delivery.
  useEffect(() => {
    if (tab === 'delivery') {
      setTimeout(() => addressRef.current?.focus(), 100);
    }
  }, [tab]);

  const mesasLibres = mesas.filter((m) => m.estado === 'libre');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 id="picker-title" className="text-lg font-bold">¿Para dónde es el pedido?</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tabs visuales con cards */}
        <div className="p-3 grid grid-cols-3 gap-2" role="tablist">
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={[
                  'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all active:scale-95',
                  active
                    ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                    : 'border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)]/40',
                ].join(' ')}
                type="button"
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`} aria-hidden="true" />
                <span className={`text-xs font-bold ${active ? 'text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text)]'}`}>{t.label}</span>
                <span className="text-[10px] text-[color:var(--text-muted)] leading-tight text-center">{t.desc}</span>
              </button>
            );
          })}
        </div>

        <div className="p-3 pt-0 min-h-[200px] max-h-[60vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="text-sm px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 mb-2"
            >
              {error}
            </div>
          )}

          {tab === 'mesa' && (
            loading ? (
              <div className="text-sm text-[color:var(--text-muted)] flex items-center gap-2 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando mesas…
              </div>
            ) : mesasLibres.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-xl">
                <Coffee className="w-7 h-7 mb-2 opacity-40" aria-hidden="true" />
                <p className="text-sm font-medium">No hay mesas libres</p>
                <p className="text-xs mt-1">Probá con Recoger o Domicilio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mesasLibres.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onPicked({ tipo: 'dine_in', mesa_id: m.id })}
                    className="p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] hover:border-[color:var(--primary,#3b82f6)] hover:bg-[color:var(--primary,#3b82f6)]/5 text-center transition-all active:scale-95"
                    type="button"
                  >
                    <div className="font-bold text-sm">{m.nombre}</div>
                    <div className="text-[10px] text-[color:var(--text-muted)] flex items-center justify-center gap-0.5 mt-0.5">
                      <Users className="w-2.5 h-2.5" aria-hidden="true" />{m.capacidad} pers.
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'pickup' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-[color:var(--text-muted)]">
                El cliente recoge en el local. No se asigna mesa.
              </p>
              <button
                onClick={() => onPicked({ tipo: 'pickup', mesa_id: null })}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold active:scale-[0.98] transition-all"
                type="button"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {tab === 'delivery' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-[color:var(--text-muted)]">
                Vas a tener que ingresar la dirección de entrega.
              </p>
              <label className="block">
                <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
                  Dirección de entrega <span className="text-rose-400">*</span>
                </span>
                <input
                  ref={addressRef}
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle 123 #45-67, Apto 101"
                  className={inputCls}
                />
              </label>
              <button
                onClick={() => {
                  const dir = direccion.trim();
                  if (!dir) return;
                  onPicked({ tipo: 'delivery', mesa_id: null, direccion_entrega: dir });
                }}
                disabled={!direccion.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                type="button"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
