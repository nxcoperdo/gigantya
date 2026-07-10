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
import { X, Check, Loader2, Banknote, Calculator, Plus, Minus } from 'lucide-react';
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

  const inc = (valor, delta) => {
    setConteos((prev) => ({ ...prev, [valor]: Math.max(0, Number(prev[valor] || 0) + delta) }));
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

  // Atajo de teclado: ESC cierra.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cuadra = Math.abs(diferencia) < 0.01;
  const falta = diferencia < 0;
  const sobra = diferencia > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arqueo-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-3xl border border-[color:var(--border)] shadow-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              aria-hidden="true"
            >
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <h2 id="arqueo-title" className="text-lg font-heading font-bold">Arqueo de caja</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {DENOMINACIONES.map((d) => {
              const cant = Number(conteos[d.valor] || 0);
              const subtotal = cant * d.valor;
              return (
                <div
                  key={d.valor}
                  className="rounded-lg border border-[color:var(--border)] p-2.5 bg-[color:var(--bg)] transition-colors hover:border-[color:var(--primary,#3b82f6)]/40"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-extrabold font-mono">${formatDenom(d.valor)}</span>
                    <span className="text-[9px] uppercase tracking-wider text-[color:var(--text-muted)] font-semibold">
                      {d.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => inc(d.valor, -1)}
                      disabled={cant === 0}
                      className="w-7 h-7 rounded-md bg-[color:var(--bg-elevated)] hover:bg-[color:var(--primary,#3b82f6)]/15 border border-[color:var(--border)] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      type="button"
                      aria-label={`Restar ${d.valor}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={cant || ''}
                      onChange={(e) => setCantidad(d.valor, e.target.value)}
                      placeholder="0"
                      className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40"
                      aria-label={`Cantidad de ${d.valor}`}
                    />
                    <button
                      onClick={() => inc(d.valor, +1)}
                      className="w-7 h-7 rounded-md bg-[color:var(--bg-elevated)] hover:bg-[color:var(--primary,#3b82f6)]/15 border border-[color:var(--border)] flex items-center justify-center transition-colors"
                      type="button"
                      aria-label={`Sumar ${d.valor}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className={`text-xs mt-1.5 text-right font-mono font-semibold ${subtotal > 0 ? 'text-[color:var(--text)]' : 'text-[color:var(--text-muted)]'}`}>
                    = {formatCurrency(subtotal)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
                Notas del cierre <span className="opacity-60 font-normal">(opcional)</span>
              </span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Observaciones, faltantes reportados, etc."
                className="w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition resize-none"
              />
            </label>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-3 gap-2.5 text-sm">
            <div className="rounded-lg border border-[color:var(--border)] p-3 bg-[color:var(--bg)]">
              <div className="text-[color:var(--text-muted)] text-[10px] uppercase tracking-wider font-semibold">Esperado</div>
              <div className="font-mono text-base font-bold mt-0.5">{formatCurrency(esperado)}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] p-3 bg-[color:var(--bg)]">
              <div className="text-[color:var(--text-muted)] text-[10px] uppercase tracking-wider font-semibold">Contado</div>
              <div className="font-mono text-base font-bold mt-0.5">{formatCurrency(totalReal)}</div>
            </div>
            <div
              className={[
                'rounded-lg border p-3',
                cuadra
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : falta
                    ? 'border-rose-500/40 bg-rose-500/10'
                    : 'border-amber-500/40 bg-amber-500/10',
              ].join(' ')}
            >
              <div className="text-[color:var(--text-muted)] text-[10px] uppercase tracking-wider font-semibold">
                {cuadra ? 'Cuadra' : falta ? 'Faltante' : 'Sobrante'}
              </div>
              <div
                className={[
                  'font-mono text-base font-bold mt-0.5',
                  cuadra ? 'text-emerald-400' : falta ? 'text-rose-400' : 'text-amber-400',
                ].join(' ')}
              >
                {diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}
                {formatCurrency(Math.abs(diferencia))}
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              {error}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors"
            type="button"
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            {enviando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Cerrando…</>
            ) : (
              <><Check className="w-4 h-4" /> Cerrar caja</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
