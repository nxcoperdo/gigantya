/**
 * StockAdjustModal (Fase 6).
 *
 * Modal para registrar un movimiento manual de stock (compra, merma
 * o ajuste). Muestra el stock actual, pide tipo + cantidad y notas.
 * Calcula el stock resultante antes de enviar.
 *
 * No se puede usar para registrar un consumo_pedido (es interno).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  X, Plus, Minus, AlertCircle, Sliders, Save, Loader2,
  AlertTriangle, Package, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { posInventoryService } from '../../services/api';

const TIPOS = [
  { value: 'compra',  label: 'Compra',  desc: 'Ingreso de stock (proveedor)',     Icon: Plus,        sign: '+' },
  { value: 'merma',   label: 'Merma',   desc: 'Pérdida o desperdicio',            Icon: Minus,       sign: '-' },
  { value: 'ajuste',  label: 'Ajuste',  desc: 'Corrección manual (+ o -)',        Icon: AlertCircle, sign: '±' },
];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function StockAdjustModal({ ingrediente, onClose, onSaved }) {
  const [tipo, setTipo] = useState('compra');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ESC para cerrar.
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const cantNum = Number(cantidad) || 0;
  // Para 'compra' siempre es positivo. Para 'merma' siempre negativo.
  // Para 'ajuste' puede ser + o -.
  const cantSigned = useMemo(() => {
    if (tipo === 'compra') return Math.abs(cantNum);
    if (tipo === 'merma')  return -Math.abs(cantNum);
    return cantNum;
  }, [tipo, cantNum]);

  const stockActual = Number(ingrediente?.stock_actual || 0);
  const stockResultante = stockActual + cantSigned;
  const stockMinimo = Number(ingrediente?.stock_minimo || 0);

  async function handleSubmit() {
    if (!cantidad || Number(cantidad) === 0) {
      setError('cantidad es requerida');
      return;
    }
    if (tipo !== 'ajuste' && Number(cantidad) < 0) {
      setError('cantidad debe ser positiva para este tipo');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await posInventoryService.crearMovimiento({
        ingrediente_id: ingrediente.id,
        tipo,
        cantidad: cantSigned,
        notas: notas || null,
      });
      onSaved(r.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ingrediente) return null;

  const tone =
    stockResultante < 0 ? 'danger'
    : stockResultante < stockMinimo ? 'warning'
    : 'success';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjust-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              aria-hidden="true"
            >
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="stock-adjust-title" className="text-lg font-bold">Ajustar stock</h2>
              <p className="text-xs text-[color:var(--text-muted)] truncate">{ingrediente.nombre}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Stock actual card */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg)] p-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
              aria-hidden="true"
            >
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
                Stock actual
              </p>
              <p className="text-base font-mono font-bold">
                {stockActual.toFixed(3)} <span className="text-sm font-normal text-[color:var(--text-muted)]">{ingrediente.unidad}</span>
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo de movimiento */}
          <div>
            <p className="block text-xs font-semibold text-[color:var(--text-muted)] mb-2">
              Tipo de movimiento
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const Icn = t.Icon;
                const selected = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    aria-pressed={selected}
                    className={[
                      'p-2.5 rounded-lg border-2 text-sm flex flex-col items-center gap-1 transition-all active:scale-95',
                      selected
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10 text-[color:var(--text)]'
                        : 'border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)]/40 text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
                    ].join(' ')}
                  >
                    <Icn className={`w-4 h-4 ${selected ? 'text-[color:var(--primary,#3b82f6)]' : ''}`} aria-hidden="true" />
                    <span className="font-bold text-sm">{t.label}</span>
                    <span className="text-[10px] opacity-70 leading-tight text-center">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
              Cantidad {tipo === 'ajuste' ? <span className="opacity-60 font-normal">(puede ser negativa)</span> : ''}
            </span>
            <input
              type="number"
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
              autoFocus
              className={`${inputCls} font-mono`}
              placeholder="0.000"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
              Notas <span className="opacity-60 font-normal">(opcional)</span>
            </span>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={255}
              className={inputCls}
              placeholder="Ej. Compra factura #1234"
            />
          </label>

          {/* Stock resultante */}
          <div
            className={[
              'rounded-xl border-2 p-3',
              tone === 'danger'  && 'border-rose-500/40 bg-rose-500/10',
              tone === 'warning' && 'border-amber-500/40 bg-amber-500/10',
              tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10',
            ].filter(Boolean).join(' ')}
            role="status"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
                Stock resultante
              </span>
              {cantSigned !== 0 && (
                <span
                  className={[
                    'inline-flex items-center gap-0.5 text-xs font-semibold',
                    cantSigned > 0 ? 'text-emerald-300' : 'text-rose-300',
                  ].join(' ')}
                >
                  {cantSigned > 0 ? (
                    <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
                  )}
                  {cantSigned > 0 ? '+' : ''}{cantSigned.toFixed(3)}
                </span>
              )}
            </div>
            <p
              className={[
                'font-mono text-base font-bold mt-0.5',
                tone === 'danger'  && 'text-rose-300',
                tone === 'warning' && 'text-amber-300',
                tone === 'success' && 'text-emerald-300',
              ].filter(Boolean).join(' ')}
            >
              {stockResultante.toFixed(3)} <span className="text-sm font-normal">{ingrediente.unidad}</span>
            </p>
            {stockResultante < 0 && (
              <p className="text-xs text-rose-300 mt-1 font-medium">El stock no puede quedar negativo.</p>
            )}
            {stockResultante >= 0 && stockResultante < stockMinimo && (
              <p className="text-xs text-amber-300 mt-1 font-medium">Quedaría por debajo del mínimo ({stockMinimo.toFixed(2)}).</p>
            )}
          </div>
        </div>

        <footer className="p-4 border-t border-[color:var(--border)] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !cantidad || stockResultante < 0}
            className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</>
            ) : (
              <><Save className="w-4 h-4" /> Registrar movimiento</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
