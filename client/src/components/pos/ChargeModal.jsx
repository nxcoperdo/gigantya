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
import { X, Banknote, CreditCard, ArrowRightLeft, Smartphone, Trash2, Plus, Check, Loader2, Receipt } from 'lucide-react';
import { posCashService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

const METODOS = [
  { key: 'efectivo',     label: 'Efectivo',      icon: Banknote,      pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { key: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft,pill: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { key: 'tarjeta',      label: 'Tarjeta',       icon: CreditCard,    pill: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { key: 'nequi',        label: 'Nequi',         icon: Smartphone,    pill: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  { key: 'daviplata',    label: 'Daviplata',     icon: Smartphone,    pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charge-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-2xl border border-[color:var(--border)] shadow-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              aria-hidden="true"
            >
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="charge-title" className="text-lg font-heading font-bold">Cobrar pedido #{pedido.id}</h2>
              <p className="text-xs text-[color:var(--text-muted)]">Total: <span className="font-mono font-bold text-[color:var(--text)]">{formatCurrency(total)}</span></p>
            </div>
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

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          {/* Columna izquierda: selección de método + input */}
          <section>
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2">Agregar pago</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {METODOS.map((m) => {
                const Icon = m.icon;
                const active = m.key === metodoActivo;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMetodoActivo(m.key)}
                    className={[
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all active:scale-95',
                      active
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10 text-[color:var(--primary,#3b82f6)]'
                        : 'border-[color:var(--border)] hover:bg-[color:var(--bg)] text-[color:var(--text)]',
                    ].join(' ')}
                    type="button"
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <label className="block mb-2">
              <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">Monto</span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agregarPago()}
                className={inputCls}
                placeholder={`Restante: ${formatCurrency(restante)}`}
                inputMode="decimal"
              />
            </label>

            {metodoActivo === 'efectivo' && (
              <div className="mb-2">
                <label className="block">
                  <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
                    Recibido del cliente
                  </span>
                  <input
                    type="number"
                    value={recibidoEfectivo}
                    onChange={(e) => setRecibidoEfectivo(e.target.value)}
                    className={inputCls}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </label>
                {Number(recibidoEfectivo || 0) > 0 && (
                  <p className={`text-xs mt-1.5 font-semibold ${cambio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {cambio >= 0 ? 'Cambio: ' : 'Falta: '}
                    <span className="font-mono">{formatCurrency(Math.abs(cambio))}</span>
                  </p>
                )}
              </div>
            )}

            {metodoActivo !== 'efectivo' && (
              <div className="mb-2">
                <label className="block">
                  <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
                    Referencia <span className="opacity-60 font-normal">(opcional)</span>
                  </span>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className={inputCls}
                    placeholder="últimos 4 / ID transacción"
                  />
                </label>
              </div>
            )}

            <button
              onClick={agregarPago}
              disabled={!monto}
              className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              type="button"
            >
              <Plus className="w-4 h-4" /> Agregar pago
            </button>
          </section>

          {/* Columna derecha: lista de pagos acumulados + total */}
          <section>
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2">
              Pagos agregados {pagos.length > 0 && <span className="text-[color:var(--primary,#3b82f6)]">({pagos.length})</span>}
            </h3>
            {pagos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-lg">
                <Receipt className="w-6 h-6 mb-1.5 opacity-40" aria-hidden="true" />
                <p className="text-xs">Aún no agregaste pagos</p>
              </div>
            ) : (
              <ul className="space-y-1.5 mb-3 max-h-60 overflow-y-auto pr-1">
                {pagos.map((p, i) => {
                  const meta = METODOS.find((m) => m.key === p.metodo) || { label: p.metodo, pill: 'bg-zinc-500/15 text-zinc-300' };
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.pill}`}>
                          {meta.label}
                        </span>
                        {p.referencia_externa && (
                          <div className="text-[10px] text-[color:var(--text-muted)] mt-1 truncate">ref: {p.referencia_externa}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-mono font-bold text-sm">{formatCurrency(p.monto)}</span>
                        <button
                          onClick={() => quitarPago(i)}
                          className="p-1.5 rounded text-rose-400 hover:bg-rose-500/15 transition-colors"
                          type="button"
                          aria-label="Quitar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-[color:var(--border)] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[color:var(--text-muted)]">Total</span>
                <span className="font-mono font-bold">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-[color:var(--text-muted)]">
                <span>Acumulado</span>
                <span className="font-mono">{formatCurrency(sumaPagos)}</span>
              </div>
              <div className={[
                'flex justify-between font-bold text-base pt-1 border-t border-[color:var(--border)]',
                cuadra ? 'text-emerald-400' : 'text-amber-400',
              ].join(' ')}>
                <span>{cuadra ? 'Cuadra' : 'Restante'}</span>
                <span className="font-mono">{formatCurrency(restante)}</span>
              </div>
            </div>
          </section>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
          >
            {error}
          </div>
        )}

        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={cobrar}
            disabled={!cuadra || cobrando}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            {cobrando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Cobrando…</>
            ) : (
              <><Check className="w-4 h-4" /> Cobrar {formatCurrency(total)}</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
