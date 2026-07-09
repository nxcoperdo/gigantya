/**
 * IngredientForm (Fase 6).
 *
 * Modal de alta/edición de un ingrediente. Campos:
 *   - nombre (texto)
 *   - unidad (select: kg | g | lt | ml | unidad)
 *   - stock_actual (number, solo al crear)
 *   - stock_minimo (number, ambos casos)
 *
 * Al editar, stock_actual NO se edita desde acá (cambia solo por
 * movimientos en el kardex). El backend ignora stock_actual en PUT.
 */
import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { posInventoryService } from '../../services/api';

const UNIDADES = [
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'g',  label: 'Gramo (g)' },
  { value: 'lt', label: 'Litro (lt)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'unidad', label: 'Unidad' },
];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-xl w-full max-w-md p-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente'}
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

        {error && (
          <div className="mb-3 px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
              autoFocus
              className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              placeholder="Carne, Pan, Queso…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Unidad</label>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
            >
              {UNIDADES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">Stock actual</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={stockActual}
                onChange={(e) => setStockActual(e.target.value)}
                required
                className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm font-mono"
              />
              <p className="text-xs text-[color:var(--text-muted)] mt-1">
                Stock inicial: al guardar se registra como un movimiento de "compra" en el kardex.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Stock mínimo (alerta)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-sm font-mono"
            />
            <p className="text-xs text-[color:var(--text-muted)] mt-1">
              Cuando el stock baje de este valor, se emite una alerta en vivo.
            </p>
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
              disabled={saving || !nombre}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-primary text-white text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear ingrediente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
