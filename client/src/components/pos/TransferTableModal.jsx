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
import { X, ArrowRightLeft, MapPin } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir pedido
          </h2>
          <button onClick={onClose} className="btn btn-outline btn-small">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-3 p-3 rounded-lg bg-[color:var(--bg-elevated)] text-sm">
          Pedido <strong>#{pedido?.id}</strong> — actualmente en mesa{' '}
          <strong>#{mesaOrigenId}</strong>.
        </div>

        {loading ? (
          <p className="text-sm text-[color:var(--text-muted)]">Cargando mesas libres…</p>
        ) : mesasLibres.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)] py-4 text-center">
            No hay mesas libres para transferir.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {mesasLibres.map((m) => (
              <button
                key={m.id}
                onClick={() => setDestino(m.id)}
                className={`p-3 rounded border-2 transition-colors ${
                  destino === m.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[color:var(--border)] hover:border-primary/50'
                }`}
              >
                <MapPin className="w-4 h-4 mx-auto mb-1" />
                <div className="text-sm font-semibold">{m.nombre || `Mesa ${m.id}`}</div>
                <div className="text-xs text-[color:var(--text-muted)]">cap. {m.capacidad}</div>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 rounded bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline btn-small">Cancelar</button>
          <button
            onClick={handleTransferir}
            disabled={!destino || procesando}
            className="btn btn-primary btn-small"
          >
            {procesando ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
}
