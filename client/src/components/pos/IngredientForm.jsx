/**
 * IngredientForm (Fase 6).
 *
 * Modal de alta/edición de un ingrediente. Campos:
 *   - nombre (texto)
 *   - unidad (select: kg | g | lt | ml | unidad)
 *   - stock_actual (number, solo al crear)
 *   - stock_minimo (number, ambos casos)
 *
 * Al editar, stock_actual NO se edita desde aquí (cambia solo por
 * movimientos en el kardex). El backend ignora stock_actual en PUT.
 */
import { useEffect, useState } from 'react';
import { X, Save, Package, Loader2, AlertTriangle, Ruler, Hash, TrendingDown } from 'lucide-react';
import { posInventoryService } from '../../services/api';

const UNIDADES = [
  { value: 'kg',     label: 'Kilogramo (kg)' },
  { value: 'g',      label: 'Gramo (g)' },
  { value: 'lt',     label: 'Litro (lt)' },
  { value: 'ml',     label: 'Mililitro (ml)' },
  { value: 'unidad', label: 'Unidad' },
];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function IngredientForm({ ingrediente = null, onClose, onSaved }) {
  const isEdit = Boolean(ingrediente?.id);
  const [nombre, setNombre] = useState(ingrediente?.nombre || '');
  const [unidad, setUnidad] = useState(ingrediente?.unidad || 'unidad');
  const [stockActual, setStockActual] = useState(ingrediente?.stock_actual ?? 0);
  const [stockMinimo, setStockMinimo] = useState(ingrediente?.stock_minimo ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ESC para cerrar.
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let r;
      if (isEdit) {
        // En edición, solo mandamos nombre, unidad, stock_minimo.
        // stock_actual lo maneja el kardex.
        r = await posInventoryService.updateIngrediente(ingrediente.id, {
          nombre, unidad, stock_minimo: Number(stockMinimo),
        });
      } else {
        r = await posInventoryService.createIngrediente({
          nombre, unidad,
          stock_actual: Number(stockActual),
          stock_minimo: Number(stockMinimo),
        });
      }
      onSaved(r.data?.ingrediente);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ing-form-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              aria-hidden="true"
            >
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 id="ing-form-title" className="text-lg font-heading font-bold">
              {isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente'}
            </h2>
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

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Package className="w-3 h-3" aria-hidden="true" />
              Nombre <span className="text-rose-400">*</span>
            </span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
              autoFocus
              className={inputCls}
              placeholder="Carne, Pan, Queso…"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Ruler className="w-3 h-3" aria-hidden="true" />
              Unidad
            </span>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className={inputCls}
            >
              {UNIDADES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </label>

          {!isEdit && (
            <label className="block">
              <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
                <Hash className="w-3 h-3" aria-hidden="true" />
                Stock actual <span className="text-rose-400">*</span>
              </span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={stockActual}
                onChange={(e) => setStockActual(e.target.value)}
                required
                className={`${inputCls} font-mono`}
              />
              <p className="text-[10px] text-[color:var(--text-muted)] mt-1 leading-relaxed">
                Stock inicial: al guardar se registra como un movimiento de "compra" en el kardex.
              </p>
            </label>
          )}

          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <TrendingDown className="w-3 h-3" aria-hidden="true" />
              Stock mínimo (alerta) <span className="text-rose-400">*</span>
            </span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              required
              className={`${inputCls} font-mono`}
            />
            <p className="text-[10px] text-[color:var(--text-muted)] mt-1 leading-relaxed">
              Cuando el stock baje de este valor, se emite una alerta en vivo.
            </p>
          </label>
        </form>

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
            disabled={saving || !nombre}
            className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <><Save className="w-4 h-4" /> {isEdit ? 'Guardar cambios' : 'Crear ingrediente'}</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
