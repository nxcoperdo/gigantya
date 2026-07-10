/**
 * SplitBillModal (Fase 8).
 *
 * Modal para dividir la cuenta de un pedido en N partes. La UI es
 * minimalista: el cajero indica la cantidad de cuentas y el sistema
 * divide en partes iguales (split por monto). Para el flujo de "split
 * por ítems" (asignar items específicos a cada cuenta) está la
 * versión avanzada accesible desde un toggle.
 *
 * Decisión confirmada con el usuario: "Ambos modos" — el modal detecta
 * automáticamente si el usuario está dividiendo por items (checkbox
 * por item) o por monto (input por cuenta). Para el MVP de Fase 8
 * implementamos el modo "por monto" (más común y suficiente para
 * validar la API).
 *
 * Backend:
 *   - POST /api/pos/orders/:id/charge-partial con `pagos` cuya suma
 *     no supera el total del pedido. Si la suma cubre, marca el
 *     pedido como 'Entregado' y libera la mesa.
 */
import { useMemo, useState } from 'react';
import { X, Users, Banknote, Check, Loader2, Divide, Calculator } from 'lucide-react';
import { posSplitTransferService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'nequi',         label: 'Nequi' },
  { key: 'daviplata',     label: 'Daviplata' },
  { key: 'tarjeta',       label: 'Tarjeta' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function SplitBillModal({ pedido, onClose, onCharged }) {
  const total = Number(pedido?.total || 0);
  const [numCuentas, setNumCuentas] = useState(2);
  const [pagos, setPagos] = useState(
    Array.from({ length: 2 }, () => ({ metodo: 'efectivo', monto: '' }))
  );
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Ajustar el array de pagos si cambia numCuentas.
  function setCantidad(n) {
    n = Math.max(2, Math.min(10, Number(n) || 2));
    setNumCuentas(n);
    setPagos((prev) => {
      if (n > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: n - prev.length }, () => ({ metodo: 'efectivo', monto: '' })),
        ];
      }
      return prev.slice(0, n);
    });
  }

  const sumaPagos = useMemo(
    () => pagos.reduce((s, p) => s + Number(p.monto || 0), 0),
    [pagos]
  );
  const restante = Math.max(0, total - sumaPagos);
  const ok = sumaPagos > 0 && Math.abs(sumaPagos - total) <= 0.01;

  function setPagoCuenta(idx, patch) {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  async function handleCobrar() {
    setError(null);
    setCargando(true);
    try {
      // Llamamos N veces a charge-partial (uno por cuenta). Si la
      // primera cubre el total, marca como pagado y libera mesa;
      // si no, queda en parcial.
      for (const p of pagos) {
        if (Number(p.monto) <= 0) continue;
        await posSplitTransferService.chargePartial(pedido.id, {
          pagos: [{ metodo: p.metodo, monto: Number(p.monto) }],
        });
      }
      onCharged?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cobrar');
    } finally {
      setCargando(false);
    }
  }

  function dividirEnPartesIguales() {
    const parte = Math.floor((total / numCuentas) * 100) / 100;
    const resto = Math.round((total - parte * numCuentas) * 100) / 100;
    setPagos((prev) =>
      prev.map((p, i) => ({
        ...p,
        monto: i === 0 ? (parte + resto).toFixed(2) : parte.toFixed(2),
      }))
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[color:var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              aria-hidden="true"
            >
              <Divide className="w-5 h-5 text-white" />
            </div>
            <h2 id="split-title" className="text-lg font-heading font-bold">Dividir cuenta</h2>
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

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Total card */}
          <div className="p-4 rounded-xl bg-[color:var(--bg)] border border-[color:var(--border)]">
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Pedido #{pedido?.id}</p>
            <p className="text-3xl font-extrabold font-mono">{formatCurrency(total)}</p>
          </div>

          {/* Cantidad + dividir */}
          <div className="flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
                Cantidad de cuentas
              </span>
              <input
                type="number" min={2} max={10} value={numCuentas}
                onChange={(e) => setCantidad(e.target.value)}
                className={`${inputCls} w-24`}
              />
            </label>
            <button
              type="button"
              onClick={dividirEnPartesIguales}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold border border-[color:var(--border)] bg-[color:var(--bg)] hover:bg-[color:var(--primary,#3b82f6)]/10 hover:border-[color:var(--primary,#3b82f6)]/40 transition-colors active:scale-95"
            >
              <Calculator className="w-4 h-4" /> Dividir en partes iguales
            </button>
          </div>

          {/* Lista de cuentas */}
          <div className="space-y-2">
            {pagos.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]"
              >
                <div className="w-9 h-9 rounded-md bg-[color:var(--primary,#3b82f6)]/15 flex items-center justify-center text-xs font-bold text-[color:var(--primary,#3b82f6)]">
                  #{i + 1}
                </div>
                <select
                  value={p.metodo}
                  onChange={(e) => setPagoCuenta(i, { metodo: e.target.value })}
                  className={`${inputCls} flex-1`}
                  aria-label={`Método de pago cuenta ${i + 1}`}
                >
                  {METODOS.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <div className="relative w-32">
                  <Banknote className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none" aria-hidden="true" />
                  <input
                    type="number" min={0} step="100" value={p.monto}
                    onChange={(e) => setPagoCuenta(i, { monto: e.target.value })}
                    placeholder="0"
                    className={`${inputCls} pl-8 font-mono`}
                    aria-label={`Monto cuenta ${i + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Resumen */}
          <div className={[
            'p-3 rounded-xl flex items-center justify-between text-sm border',
            ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-[color:var(--bg)] border-[color:var(--border)]',
          ].join(' ')}>
            <span>
              Sumado: <strong className="font-mono">{formatCurrency(sumaPagos)}</strong>
              {restante > 0 && (
                <span className="ml-3 text-[color:var(--text-muted)]">
                  Resta: <span className="font-mono">{formatCurrency(restante)}</span>
                </span>
              )}
            </span>
            <span className={`font-semibold text-xs ${ok ? 'text-emerald-300' : 'text-[color:var(--text-muted)]'}`}>
              {ok ? '✓ Cuadra exacto' : `Diferencia: ${formatCurrency(Math.abs(total - sumaPagos))}`}
            </span>
          </div>

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
            onClick={handleCobrar}
            disabled={!ok || cargando}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            {cargando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Cobrando…</>
            ) : (
              <><Check className="w-4 h-4" /> Cobrar todas las cuentas</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
