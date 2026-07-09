/**
 * CashCountModal (Fase 5).
 *
 * Modal de arqueo de caja. El cajero cuenta los billetes y monedas
 * físicas en la caja registradora al final del turno; la app calcula
 * el total automáticamente, lo compara con el esperado, y muestra la
 * diferencia (sobrante / faltante).
 *
 * Denominaciones COP soportadas (ordenadas mayor a menor):
 *   50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50
 *
 * Inputs:
 *   - `esperado` (number) — monto que el sistema calcula como
 *     `monto_apertura + Σ pagos en efectivo de la sesión`.
 *   - `onClose()` — cerrar sin archivar.
 *   - `onConfirm({ monto_real, desglose_billetes, notas_cierre })` —
 *     padre cierra la sesión enviando el arqueo al backend
 *     (con `Idempotency-Key`).
 */
import { useMemo, useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatHelper';

// Billetes y monedas colombianas, ordenados de mayor a menor.
// En Colombia no circulan $2, pero la lista cubre todas las
// denominaciones activas que la banca entrega.
const DENOMINACIONES = [
  { valor: 50000, tipo: 'billete' },
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000,  tipo: 'billete' },
  { valor: 2000,  tipo: 'billete' },
  { valor: 1000,  tipo: 'billete' },
  { valor: 500,   tipo: 'moneda'  },
  { valor: 200,   tipo: 'moneda'  },
  { valor: 100,   tipo: 'moneda'  },
  { valor: 50,    tipo: 'moneda'  },
];

function formatDenom(v) {
  return new Intl.NumberFormat('es-CO').format(v);
}

export default function CashCountModal({ esperado = 0, onClose, onConfirm }) {
  // Inicializa la grilla en 0.
  const [conteos, setConteos] = useState(() =>
    Object.fromEntries(DENOMINACIONES.map((d) => [d.valor, 0]))
  );
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const totalReal = useMemo(
    () => DENOMINACIONES.reduce(
      (s, d) => s + d.valor * Number(conteos[d.valor] || 0),
      0
    ),
    [conteos]
  );
  const diferencia = useMemo(
    () => totalReal - Number(esperado || 0),
    [totalReal, esperado]
  );

  const setCantidad = (valor, raw) => {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setConteos((prev) => ({ ...prev, [valor]: n }));
  };

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      // Solo mandamos las denominaciones con cantidad > 0 para
      // mantener el JSON del desglose limpio.
      const desglose = Object.fromEntries(
        Object.entries(conteos).filter(([, n]) => Number(n) > 0)
      );
      await onConfirm({
        monto_real: Number(totalReal.toFixed(2)),
        desglose_billetes: desglose,
        notas_cierre: notas.trim() || null,
      });
    } catch (e) {
      setError(e.message || 'Error al cerrar la caja');
      setEnviando(false);
    }
  };

  // Atajo de teclado: ESC cierra, Enter confirma (sólo si diferencia = 0)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg w-full max-w-3xl border border-[color:var(--border)] shadow-xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Arqueo de caja</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[color:var(--bg)]"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {DENOMINACIONES.map((d) => {
              const cant = Number(conteos[d.valor] || 0);
              const subtotal = cant * d.valor;
              return (
                <div
                  key={d.valor}
                  className="rounded-md border border-[color:var(--border)] p-3 bg-[color:var(--bg)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">${formatDenom(d.valor)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
                      {d.tipo}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={cant || ''}
                    onChange={(e) => setCantidad(d.valor, e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm text-center"
                  />
                  <div className="text-xs text-[color:var(--text-muted)] mt-1 text-right font-mono">
                    = {formatCurrency(subtotal)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">
              Notas del cierre (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones, faltantes reportados, etc."
              className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded border border-[color:var(--border)] p-3">
              <div className="text-[color:var(--text-muted)] text-xs">Esperado</div>
              <div className="font-mono text-base">{formatCurrency(esperado)}</div>
            </div>
            <div className="rounded border border-[color:var(--border)] p-3">
              <div className="text-[color:var(--text-muted)] text-xs">Contado</div>
              <div className="font-mono text-base">{formatCurrency(totalReal)}</div>
            </div>
            <div
              className={`rounded border p-3 ${
                Math.abs(diferencia) < 0.01
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : diferencia > 0
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
              }`}
            >
              <div className="text-[color:var(--text-muted)] text-xs">Diferencia</div>
              <div
                className={`font-mono text-base font-semibold ${
                  Math.abs(diferencia) < 0.01
                    ? 'text-emerald-400'
                    : diferencia > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {diferencia > 0 ? '+' : ''}
                {formatCurrency(diferencia)}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md border border-[color:var(--border)] text-sm"
            type="button"
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
            type="button"
          >
            <Check className="w-4 h-4" />
            {enviando ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </footer>
      </div>
    </div>
  );
}
