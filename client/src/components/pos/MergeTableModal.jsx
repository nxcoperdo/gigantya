/**
 * MergeTableModal (Fase 8).
 *
 * Modal para fusionar dos mesas ocupadas. La mesa origen cede sus
 * pedidos activos a la mesa destino, y queda libre.
 *
 * Backend: POST /api/pos/tables/merge con { mesa_origen_id, mesa_destino_id }.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Combine, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { posTablesService, posSplitTransferService } from '../../services/api';

export default function MergeTableModal({ mesaInicial, onClose, onMerged }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [origen, setOrigen] = useState(mesaInicial?.id || null);
  const [destino, setDestino] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await posTablesService.list();
        const list = r.data?.mesas || r.mesas || r.data || [];
        setMesas(list);
        if (mesaInicial?.id) setOrigen(mesaInicial.id);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [mesaInicial]);

  const mesasOcupadas = useMemo(
    () => mesas.filter((m) => m.estado === 'ocupada'),
    [mesas]
  );
  const candidatosDestino = useMemo(
    () => mesasOcupadas.filter((m) => m.id !== origen),
    [mesasOcupadas, origen]
  );

  async function handleFusionar() {
    if (!origen || !destino) return;
    setError(null);
    setProcesando(true);
    try {
      await posSplitTransferService.mergeTables({
        mesa_origen_id: origen,
        mesa_destino_id: destino,
      });
      onMerged?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error fusionando');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-lg border border-[color:var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              aria-hidden="true"
            >
              <Combine className="w-5 h-5 text-white" />
            </div>
            <h2 id="merge-title" className="text-lg font-heading font-bold">Fusionar mesas</h2>
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

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-[color:var(--text-muted)] flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando mesas…
            </div>
          ) : mesasOcupadas.length < 2 ? (
            <div className="flex flex-col items-center text-center py-6 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-xl">
              <Combine className="w-7 h-7 mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm">Necesitás al menos 2 mesas ocupadas para fusionar.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[color:var(--text-muted)] mb-3">
                Elige la mesa <strong className="text-rose-400">origen</strong> (cede sus pedidos) y la mesa{' '}
                <strong className="text-emerald-400">destino</strong> (los recibe).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-rose-300">
                    Origen
                  </label>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {mesasOcupadas.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setOrigen(m.id); setDestino(null); }}
                        className={[
                          'w-full p-2.5 rounded-lg text-left text-sm font-medium border-2 transition-all',
                          origen === m.id
                            ? 'border-rose-500 bg-rose-500/10 text-rose-200'
                            : 'border-[color:var(--border)] hover:border-rose-500/40 text-[color:var(--text)]',
                        ].join(' ')}
                        type="button"
                      >
                        <MapPin className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                        {m.nombre || `Mesa ${m.id}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden sm:flex items-center justify-center pt-6 text-[color:var(--text-muted)]">
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-emerald-300">
                    Destino
                  </label>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {candidatosDestino.length === 0 ? (
                      <p className="text-xs text-[color:var(--text-muted)] p-2 italic">
                        Seleccioná primero un origen distinto.
                      </p>
                    ) : (
                      candidatosDestino.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setDestino(m.id)}
                          className={[
                            'w-full p-2.5 rounded-lg text-left text-sm font-medium border-2 transition-all',
                            destino === m.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                              : 'border-[color:var(--border)] hover:border-emerald-500/40 text-[color:var(--text)]',
                          ].join(' ')}
                          type="button"
                        >
                          <MapPin className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                          {m.nombre || `Mesa ${m.id}`}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mt-3 p-2.5 rounded-lg bg-rose-500/10 text-rose-300 text-sm border border-rose-500/30"
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
            onClick={handleFusionar}
            disabled={!origen || !destino || origen === destino || procesando}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            type="button"
          >
            {procesando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Fusionando…</>
            ) : (
              <><Combine className="w-4 h-4" /> Fusionar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
