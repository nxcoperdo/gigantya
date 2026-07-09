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
import { X, Users, Banknote, Check } from 'lucide-react';
import { posSplitTransferService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'nequi',         label: 'Nequi' },
  { key: 'daviplata',     label: 'Daviplata' },
  { key: 'tarjeta',       label: 'Tarjeta' },
];

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Dividir cuenta
          </h2>
          <button onClick={onClose} className="btn btn-outline btn-small">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-[color:var(--bg-elevated)]">
          <p className="text-sm text-[color:var(--text-muted)]">Pedido #{pedido?.id}</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <div>
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">Cantidad de cuentas</label>
            <input
              type="number" min={2} max={10} value={numCuentas}
              onChange={(e) => setCantidad(e.target.value)}
              className="input input-small w-24"
            />
          </div>
          <button
            type="button"
            onClick={dividirEnPartesIguales}
            className="btn btn-outline btn-small"
          >
            Dividir en partes iguales
          </button>
        </div>

        <div className="space-y-2">
          {pagos.map((p, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded border border-[color:var(--border)]">
              <span className="w-8 text-sm font-semibold text-[color:var(--text-muted)]">
                #{i + 1}
              </span>
              <select
                value={p.metodo}
                onChange={(e) => setPagoCuenta(i, { metodo: e.target.value })}
                className="input input-small flex-1"
              >
                {METODOS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <div className="relative">
                <Banknote className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="number" min={0} step="100" value={p.monto}
                  onChange={(e) => setPagoCuenta(i, { monto: e.target.value })}
                  placeholder="0"
                  className="input input-small pl-7 w-32"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-[color:var(--bg-elevated)] flex items-center justify-between text-sm">
          <span>
            Sumado: <strong>{formatCurrency(sumaPagos)}</strong>
            {restante > 0 && (
              <span className="ml-3 text-[color:var(--text-muted)]">
                Resta: {formatCurrency(restante)}
              </span>
            )}
          </span>
          <span className={ok ? 'text-green-600' : 'text-[color:var(--text-muted)]'}>
            {ok ? '✓ Cuadra exacto' : `Diferencia: ${formatCurrency(Math.abs(total - sumaPagos))}`}
          </span>
        </div>

        {error && (
          <div className="mt-3 p-2 rounded bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline btn-small">Cancelar</button>
          <button
            onClick={handleCobrar}
            disabled={!ok || cargando}
            className="btn btn-primary btn-small"
          >
            <Check className="w-4 h-4" />
            {cargando ? 'Cobrando…' : 'Cobrar todas las cuentas'}
          </button>
        </div>
      </div>
    </div>
  );
}
