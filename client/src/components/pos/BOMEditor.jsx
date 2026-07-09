/**
 * BOMEditor (Fase 6).
 *
 * Editor de la receta (BOM) de un producto. Lista los ingredientes
 * del restaurante con su cantidad por unidad del producto. Permite
 * agregar/quitar ingredientes y cambiar cantidades.
 *
 * Al guardar, hace PUT /pos/inventory/bom/producto/:id con la lista
 * completa (el backend hace DELETE + INSERT atómico).
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { posInventoryService } from '../../services/api';

export default function BOMEditor({ productoId, onClose, onSaved }) {
  const [ingredientes, setIngredientes] = useState([]);   // todos los del restaurante
  const [items, setItems] = useState([]);                  // líneas del BOM [{ ingrediente_id, cantidad, notas }]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [allRes, bomRes] = await Promise.all([
          posInventoryService.listIngredientes(),
          posInventoryService.getBOM(productoId),
        ]);
        if (cancelado) return;
        setIngredientes(allRes.data?.ingredientes || []);
        setItems(bomRes.data?.items || []);
      } catch (e) {
        if (!cancelado) setError(e.response?.data?.error || e.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [productoId]);

  // ESC para cerrar.
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function addLinea() {
    // Buscar el primer ingrediente que no esté en items.
    const usado = new Set(items.map((i) => Number(i.ingrediente_id)));
    const libre = ingredientes.find((ing) => !usado.has(Number(ing.id)));
    if (!libre) {
      setError('Todos los ingredientes del restaurante ya están en la receta');
      return;
    }
    setItems((prev) => [
      ...prev,
      { ingrediente_id: Number(libre.id), cantidad: 0, notas: '' },
    ]);
    setError(null);
  }

  function removeLinea(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLinea(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function handleSave() {
    // Validación: cada item con ingrediente_id + cantidad > 0.
    for (const it of items) {
      if (!it.ingrediente_id) {
        setError('Cada línea debe tener un ingrediente');
        return;
      }
      if (!(Number(it.cantidad) > 0)) {
        setError('Cada línea debe tener cantidad > 0');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const r = await posInventoryService.setBOM(
        productoId,
        items.map((it) => ({
          ingrediente_id: Number(it.ingrediente_id),
          cantidad: Number(it.cantidad),
          notas: it.notas || null,
        }))
      );
      onSaved(r.data?.items);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  const ingById = new Map(ingredientes.map((i) => [Number(i.id), i]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Receta del producto #{productoId}</h2>
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

        {loading ? (
          <p className="text-sm text-[color:var(--text-muted)]">Cargando…</p>
        ) : ingredientes.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            No tenés ingredientes cargados. Creá primero los ingredientes en{' '}
            <a href="/pos/inventario" className="text-primary underline">Inventario</a>.
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {items.length === 0 && (
                <p className="text-sm text-[color:var(--text-muted)] italic">
                  La receta está vacía. Este producto no descontará stock al venderse.
                </p>
              )}
              {items.map((it, idx) => {
                const ing = ingById.get(Number(it.ingrediente_id));
                return (
                  <div
                    key={`${it.ingrediente_id}-${idx}`}
                    className="flex items-center gap-2 p-2 rounded border border-[color:var(--border)] bg-[color:var(--bg)]"
                  >
                    <select
                      value={it.ingrediente_id}
                      onChange={(e) => updateLinea(idx, 'ingrediente_id', Number(e.target.value))}
                      className="flex-1 px-2 py-1 rounded border border-[color:var(--border)] text-sm bg-[color:var(--bg-elevated)]"
                    >
                      {ingredientes.map((ingOpt) => (
                        <option key={ingOpt.id} value={ingOpt.id}>
                          {ingOpt.nombre} ({ingOpt.unidad})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={it.cantidad}
                      onChange={(e) => updateLinea(idx, 'cantidad', e.target.value)}
                      placeholder="Cantidad"
                      className="w-24 px-2 py-1 rounded border border-[color:var(--border)] text-sm font-mono bg-[color:var(--bg-elevated)]"
                    />
                    <span className="text-xs text-[color:var(--text-muted)] w-12">
                      {ing?.unidad || ''}
                    </span>
                    <input
                      type="text"
                      value={it.notas || ''}
                      onChange={(e) => updateLinea(idx, 'notas', e.target.value)}
                      placeholder="Notas"
                      maxLength={255}
                      className="flex-1 px-2 py-1 rounded border border-[color:var(--border)] text-sm bg-[color:var(--bg-elevated)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeLinea(idx)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                      aria-label="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addLinea}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-dashed border-[color:var(--border)] text-sm hover:bg-[color:var(--bg)]"
            >
              <Plus className="w-4 h-4" /> Agregar ingrediente
            </button>
          </>
        )}

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-[color:var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-[color:var(--border)] text-sm"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-primary text-white text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar receta'}
          </button>
        </div>
      </div>
    </div>
  );
}
