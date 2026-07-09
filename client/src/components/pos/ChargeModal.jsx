/**
 * ChargeModal (Fase 5).
 *
 * Modal de cobro de un pedido. Acepta pagos mixtos: efectivo,
 * transferencia, tarjeta, Nequi, Daviplata, o varios a la vez.
 *
 * Reglas:
 *   - El total del pedido está FIJO. El cajero debe juntar pagos
 *     cuya suma === total. No permitimos "vuelto" sobre el total.
 *   - Para efectivo: input "Recibido" + cálculo automático de cambio.
 *   - Para tarjeta/Nequi/Daviplata: input "referencia" (últimos 4,
 *     ID transacción). Es opcional pero recomendado para auditoría.
 *   - Botón "Cobrar" deshabilitado hasta que la suma cuadre.
 *
 * Al cobrar exitosamente, el backend:
 *   - Inserta los pagos.
 *   - Pasa el pedido a 'Entregado'.
 *   - Libera la mesa.
 *   - Devuelve `receipt_url` para que el frontend imprima.
 */
import { useMemo, useState, useEffect } from 'react';
import { X, Banknote, CreditCard, ArrowRightLeft, Smartphone, Trash2, Plus, Check } from 'lucide-react';
import { posCashService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

const METODOS = [
  { key: 'efectivo',     label: 'Efectivo',     icon: Banknote },
  { key: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft },
  { key: 'tarjeta',      label: 'Tarjeta',      icon: CreditCard },
  { key: 'nequi',        label: 'Nequi',        icon: Smartphone },
  { key: 'daviplata',    label: 'Daviplata',    icon: Smartphone },
];

export default function ChargeModal({ pedido, onClose, onCharged }) {
  const [metodoActivo, setMetodoActivo] = useState('efectivo');
  const [pagos, setPagos] = useState([]); // { metodo, monto, referencia_externa? }
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [recibidoEfectivo, setRecibidoEfectivo] = useState('');

  const total = Number(pedido?.total || 0);
  const sumaPagos = useMemo(
    () => pagos.reduce((s, p) => s + Number(p.monto || 0), 0),
    [pagos]
  );
  const restante = Math.max(0, total - sumaPagos);
  const cambio = useMemo(() => {
    if (metodoActivo !== 'efectivo') return 0;
    const r = Number(recibidoEfectivo || 0);
    return r - restante;
  }, [metodoActivo, recibidoEfectivo, restante]);

  // Si el modal se monta con un pedido, pre-seteamos el monto del método
  // activo al restante (así el cajero solo tiene que tocar "Cobrar" si
  // va todo en un solo pago).
  useEffect(() => {
    setMonto(restante > 0 ? String(restante) : '');
    setRecibidoEfectivo('');
    setReferencia('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodoActivo, pedido?.id]);

  const agregarPago = () => {
    const m = Number(monto);
    if (!(m > 0)) {
      setError('Monto debe ser mayor a 0');
      return;
    }
    if (m > restante + 0.01) {
      setError(`El monto no puede exceder el restante (${formatCurrency(restante)})`);
      return;
    }
    setError(null);
    setPagos((prev) => [
      ...prev,
      {
        metodo: metodoActivo,
        monto: Number(m.toFixed(2)),
        referencia_externa: referencia.trim() || null,
      },
    ]);
    setMonto('');
    setReferencia('');
  };

  const quitarPago = (i) => {
    setPagos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const cobrar = async () => {
    if (Math.abs(sumaPagos - total) > 0.01) {
      setError(`La suma (${formatCurrency(sumaPagos)}) no iguala el total (${formatCurrency(total)})`);
      return;
    }
    setCobrando(true);
    setError(null);
    try {
      const r = await posCashService.chargeOrder(pedido.id, { pagos });
      onCharged && onCharged(r.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setCobrando(false);
    }
  };

  const cuadra = Math.abs(sumaPagos - total) < 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg w-full max-w-2xl border border-[color:var(--border)] shadow-xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Cobrar pedido #{pedido.id}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          {/* Columna izquierda: selección de método + input */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Agregar pago</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {METODOS.map((m) => {
                const Icon = m.icon;
                const active = m.key === metodoActivo;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMetodoActivo(m.key)}
                    className={`flex flex-col items-center gap-1 p-2 rounded border text-xs ${
                      active
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                        : 'border-[color:var(--border)] hover:bg-[color:var(--bg)]'
                    }`}
                    type="button"
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <label className="block text-xs text-[color:var(--text-muted)] mb-1">Monto</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              placeholder={`Restante: ${formatCurrency(restante)}`}
            />

            {metodoActivo === 'efectivo' && (
              <div className="mt-3">
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">
                  Recibido del cliente
                </label>
                <input
                  type="number"
                  value={recibidoEfectivo}
                  onChange={(e) => setRecibidoEfectivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
                  placeholder="0"
                />
                {Number(recibidoEfectivo || 0) > 0 && (
                  <p className={`text-xs mt-1 ${cambio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Cambio: {formatCurrency(cambio)}
                  </p>
                )}
              </div>
            )}

            {metodoActivo !== 'efectivo' && (
              <div className="mt-3">
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
                  placeholder="últimos 4 / ID transacción"
                />
              </div>
            )}

            <button
              onClick={agregarPago}
              disabled={!monto}
              className="w-full mt-3 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm disabled:opacity-50"
              type="button"
            >
              <Plus className="w-4 h-4" /> Agregar pago
            </button>
          </section>

          {/* Columna derecha: lista de pagos acumulados + total */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Pagos agregados</h3>
            {pagos.length === 0 ? (
              <p className="text-xs text-[color:var(--text-muted)] py-4 text-center">
                Aún no agregaste pagos
              </p>
            ) : (
              <ul className="space-y-1 mb-3">
                {pagos.map((p, i) => (
                  <li key={i} className="flex items-center justify-between p-2 rounded border border-[color:var(--border)] text-sm">
                    <div>
                      <div className="font-medium capitalize">{p.metodo}</div>
                      {p.referencia_externa && (
                        <div className="text-xs text-[color:var(--text-muted)]">ref: {p.referencia_externa}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{formatCurrency(p.monto)}</span>
                      <button
                        onClick={() => quitarPago(i)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                        type="button"
                        aria-label="Quitar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-[color:var(--border)] pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-[color:var(--text-muted)]">
                <span>Acumulado</span>
                <span className="font-mono">{formatCurrency(sumaPagos)}</span>
              </div>
              <div className={`flex justify-between font-semibold ${cuadra ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span>Restante</span>
                <span className="font-mono">{formatCurrency(restante)}</span>
              </div>
            </div>
          </section>
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md border border-[color:var(--border)] text-sm"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={cobrar}
            disabled={!cuadra || cobrando}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
            type="button"
          >
            <Check className="w-4 h-4" />
            {cobrando ? 'Cobrando…' : 'Cobrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
