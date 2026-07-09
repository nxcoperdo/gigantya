/**
 * StockAdjustModal (Fase 6).
 *
 * Modal para registrar un movimiento manual de stock (compra, merma
 * o ajuste). Muestra el stock actual, pide tipo + cantidad y notas.
 * Calcula el stock resultante antes de enviar.
 *
 * No se puede usar para registrar un consumo_pedido (es interno).
 */
import { useEffect, useState } from 'react';
import { X, Plus, Minus, AlertCircle } from 'lucide-react';
import { posInventoryService } from '../../services/api';

const TIPOS = [
  { value: 'compra',  label: 'Compra',  desc: 'Ingreso de stock (proveedor)',     icon: Plus,        sign: '+' },
  { value: 'merma',   label: 'Merma',   desc: 'Pérdida o desperdicio',            icon: Minus,       sign: '-' },
  { value: 'ajuste',  label: 'Ajuste',  desc: 'Corrección manual (+ o -)',        icon: AlertCircle, sign: '±' },
];

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
  let cantSigned = 0;
  if (tipo === 'compra') cantSigned = Math.abs(cantNum);
  else if (tipo === 'merma') cantSigned = -Math.abs(cantNum);
  else cantSigned = cantNum;

  const stockActual = Number(ingrediente?.stock_actual || 0);
  const stockResultante = stockActual + cantSigned;

  async function handleSubmit(e) {
    e.preventDefault();
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
  const TipoIcon = TIPOS.find((t) => t.value === tipo)?.icon || Plus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-xl w-full max-w-md p-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TipoIcon className="w-5 h-5" />
            Ajustar stock: {ingrediente.nombre}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[color:var(--bg)]"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="mb-4 px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm">
          Stock actual: <span className="font-mono font-semibold">
            {stockActual.toFixed(3)} {ingrediente.unidad}
          </span>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de movimiento</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const Icn = t.icon;
                const selected = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`p-2 rounded border text-sm flex flex-col items-center gap-1 ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[color:var(--border)] hover:bg-[color:var(--bg)]'
                    }`}
                  >
                    <Icn className="w-4 h-4" />
                    <span className="font-medium">{t.label}</span>
                    <span className="text-[10px] text-[color:var(--text-muted)] text-center">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Cantidad {tipo === 'ajuste' ? '(puede ser negativa)' : ''}
            </label>
            <input
              type="number"
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm font-mono"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={255}
              className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              placeholder="Ej. Compra factura #1234"
            />
          </div>

          <div className="px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm">
            Stock resultante:{' '}
            <span className={`font-mono font-semibold ${
              stockResultante < 0
                ? 'text-rose-400'
                : stockResultante < Number(ingrediente.stock_minimo || 0)
                  ? 'text-amber-400'
                  : 'text-emerald-400'
            }`}>
              {stockResultante.toFixed(3)} {ingrediente.unidad}
            </span>
            {stockResultante < 0 && (
              <p className="text-xs text-rose-300 mt-1">El stock no puede quedar negativo.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[color:var(--border)] text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !cantidad || stockResultante < 0}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-primary text-white text-sm disabled:opacity-50"
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
