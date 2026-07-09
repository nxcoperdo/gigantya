/**
 * MergeTableModal (Fase 8).
 *
 * Modal para fusionar dos mesas ocupadas. La mesa origen cede sus
 * pedidos activos a la mesa destino, y queda libre.
 *
 * Backend: POST /api/pos/tables/merge con { mesa_origen_id, mesa_destino_id }.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Combine, MapPin } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Combine className="w-5 h-5" />
            Fusionar mesas
          </h2>
          <button onClick={onClose} className="btn btn-outline btn-small">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[color:var(--text-muted)]">Cargando mesas…</p>
        ) : mesasOcupadas.length < 2 ? (
          <p className="text-sm text-[color:var(--text-muted)] py-4 text-center">
            Necesitás al menos 2 mesas ocupadas para fusionar.
          </p>
        ) : (
          <>
            <p className="text-sm text-[color:var(--text-muted)] mb-2">
              Elegí la mesa <strong>origen</strong> (cede sus pedidos) y la mesa{' '}
              <strong>destino</strong> (los recibe).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[color:var(--text-muted)]">
                  ORIGEN
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {mesasOcupadas.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setOrigen(m.id); setDestino(null); }}
                      className={`w-full p-2 rounded text-left text-sm border-2 ${
                        origen === m.id
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-[color:var(--border)] hover:border-red-300'
                      }`}
                    >
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {m.nombre || `Mesa ${m.id}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[color:var(--text-muted)]">
                  DESTINO
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {candidatosDestino.length === 0 ? (
                    <p className="text-xs text-[color:var(--text-muted)] p-2">
                      Seleccioná primero un origen distinto.
                    </p>
                  ) : (
                    candidatosDestino.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setDestino(m.id)}
                        className={`w-full p-2 rounded text-left text-sm border-2 ${
                          destino === m.id
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-[color:var(--border)] hover:border-green-300'
                        }`}
                      >
                        <MapPin className="w-3 h-3 inline mr-1" />
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
          <div className="mt-3 p-2 rounded bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline btn-small">Cancelar</button>
          <button
            onClick={handleFusionar}
            disabled={!origen || !destino || origen === destino || procesando}
            className="btn btn-primary btn-small"
          >
            {procesando ? 'Fusionando…' : 'Fusionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
