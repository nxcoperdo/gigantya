/**
 * TransferTableModal (Fase 8).
 *
 * Modal para transferir un pedido de una mesa a otra. Lista las
 * mesas libres del restaurante (excluyendo la mesa actual) y le
 * permite al staff elegir destino.
 *
 * Backend: POST /api/pos/orders/:id/transfer con { mesa_destino_id }.
 */
import { useEffect, useState } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, Users } from 'lucide-react';
import { posTablesService, posSplitTransferService } from '../../services/api';

export default function TransferTableModal({ pedido, onClose, onTransferred }) {
  const mesaOrigenId = pedido?.mesa_id;
  const [mesasLibres, setMesasLibres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [destino, setDestino] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await posTablesService.list();
        const list = r.data?.mesas || r.mesas || r.data || [];
        const libres = list
          .filter((m) => m.estado === 'libre' && m.id !== mesaOrigenId)
          .sort((a, b) => Number(a.id) - Number(b.id));
        setMesasLibres(libres);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [mesaOrigenId]);

  async function handleTransferir() {
    if (!destino) return;
    setError(null);
    setProcesando(true);
    try {
      await posSplitTransferService.transferOrder(pedido.id, { mesa_destino_id: destino });
      onTransferred?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error transfiriendo');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-md border border-[color:var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}
              aria-hidden="true"
            >
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <h2 id="transfer-title" className="text-lg font-bold">Transferir pedido</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="p-3 rounded-lg bg-[color:var(--bg)] border border-[color:var(--border)] text-sm">
            Pedido <strong className="font-mono">#{pedido?.id}</strong> — actualmente en mesa{' '}
            <strong className="text-[color:var(--primary,#3b82f6)]">#{mesaOrigenId}</strong>
          </div>

          {loading ? (
            <div className="text-sm text-[color:var(--text-muted)] flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando mesas libres…
            </div>
          ) : mesasLibres.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-xl">
              <MapPin className="w-7 h-7 mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">No hay mesas libres</p>
              <p className="text-xs mt-1">Liberá una mesa antes de transferir.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Mesa destino</p>
              <div className="grid grid-cols-3 gap-2">
                {mesasLibres.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDestino(m.id)}
                    className={[
                      'p-3 rounded-lg border-2 transition-all active:scale-95',
                      destino === m.id
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                        : 'border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)]/50',
                    ].join(' ')}
                    type="button"
                  >
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-[color:var(--text-muted)]" aria-hidden="true" />
                    <div className="text-sm font-bold">{m.nombre || `Mesa ${m.id}`}</div>
                    <div className="text-[10px] text-[color:var(--text-muted)] flex items-center justify-center gap-0.5 mt-0.5">
                      <Users className="w-2.5 h-2.5" aria-hidden="true" />{m.capacidad}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-500/10 text-rose-300 text-sm border border-rose-500/30"
            >
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[color:var(--border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[color:var(--border)] hover:bg-[color:var(--bg)] transition-colors"
            type="button"
          >Cancelar</button>
          <button
            onClick={handleTransferir}
            disabled={!destino || procesando}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            type="button"
          >
            {procesando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Transfiriendo…</>
            ) : (
              <><ArrowRightLeft className="w-4 h-4" /> Transferir</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
