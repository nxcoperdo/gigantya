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
import { useEffect, useState } from 'react';
import { X, Coffee, ShoppingBag, Truck } from 'lucide-react';
import { posTablesService } from '../../services/api';

export default function TablePickerModal({ onClose, onPicked }) {
  const [tab, setTab] = useState('mesa'); // 'mesa' | 'pickup' | 'delivery'
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const mesasLibres = mesas.filter((m) => m.estado === 'libre');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg w-full max-w-md border border-[color:var(--border)] shadow-xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">¿Para dónde es el pedido?</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex border-b border-[color:var(--border)]">
          <button
            onClick={() => setTab('mesa')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${tab === 'mesa' ? 'border-b-2 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`}
            type="button"
          >
            <Coffee className="w-4 h-4 inline mr-1" /> Mesa
          </button>
          <button
            onClick={() => setTab('pickup')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${tab === 'pickup' ? 'border-b-2 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`}
            type="button"
          >
            <ShoppingBag className="w-4 h-4 inline mr-1" /> Recoger
          </button>
          <button
            onClick={() => setTab('delivery')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${tab === 'delivery' ? 'border-b-2 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`}
            type="button"
          >
            <Truck className="w-4 h-4 inline mr-1" /> Domicilio
          </button>
        </div>

        <div className="p-4 min-h-[200px] max-h-[60vh] overflow-y-auto">
          {error && <p className="text-sm text-rose-300">{error}</p>}

          {tab === 'mesa' && (
            loading ? <p className="text-sm text-[color:var(--text-muted)]">Cargando mesas…</p> :
            mesasLibres.length === 0 ? <p className="text-sm text-[color:var(--text-muted)]">No hay mesas libres</p> :
            <div className="grid grid-cols-3 gap-2">
              {mesasLibres.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onPicked({ tipo: 'dine_in', mesa_id: m.id })}
                  className="p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] hover:border-[color:var(--primary,#3b82f6)] text-center"
                  type="button"
                >
                  <div className="font-medium text-sm">{m.nombre}</div>
                  <div className="text-xs text-[color:var(--text-muted)]">{m.capacidad} pers.</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'pickup' && (
            <div className="space-y-3">
              <p className="text-sm text-[color:var(--text-muted)]">
                El cliente recoge en el local. No se asigna mesa.
              </p>
              <button
                onClick={() => onPicked({ tipo: 'pickup', mesa_id: null })}
                className="w-full px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm"
                type="button"
              >
                Continuar
              </button>
            </div>
          )}

          {tab === 'delivery' && (
            <div className="space-y-3">
              <p className="text-sm text-[color:var(--text-muted)]">
                Vas a tener que ingresar la dirección de entrega antes de enviar.
              </p>
              <input
                type="text"
                id="pos-delivery-address"
                placeholder="Calle 123 #45-67, Apto 101"
                className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              />
              <button
                onClick={() => {
                  const dir = document.getElementById('pos-delivery-address').value.trim();
                  if (!dir) return;
                  onPicked({ tipo: 'delivery', mesa_id: null, direccion_entrega: dir });
                }}
                className="w-full px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm"
                type="button"
              >
                Continuar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
