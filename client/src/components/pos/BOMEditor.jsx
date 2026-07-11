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
import {
  Plus, Trash2, Save, X, ChefHat, Loader2, FileText,
  AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { posInventoryService } from '../../services/api';

const inputCls = 'px-2.5 py-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bom-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-2xl border border-[color:var(--border)] max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              aria-hidden="true"
            >
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="bom-title" className="text-lg font-heading font-bold">Receta del producto</h2>
              <p className="text-xs text-[color:var(--text-muted)]">Producto #{productoId}</p>
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

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div
              role="alert"
              className="mb-3 px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Cargando receta…</span>
            </div>
          ) : ingredientes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[color:var(--border)] bg-[color:var(--bg)] p-8 text-center">
              <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
              <p className="text-sm text-[color:var(--text)] font-medium">
                No tienes ingredientes cargados
              </p>
              <p className="text-xs text-[color:var(--text-muted)] mt-1 mb-3">
                Primero creá los ingredientes en Inventario.
              </p>
              <Link
                to="/pos/inventario"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--primary,#3b82f6)] hover:underline"
              >
                Ir a Inventario <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-3">
                {items.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-[color:var(--border)] bg-[color:var(--bg)] p-6 text-center">
                    <FileText className="w-7 h-7 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    <p className="text-sm text-[color:var(--text-muted)] italic">
                      La receta está vacía. Este producto no descontará stock al venderse.
                    </p>
                  </div>
                )}
                {items.map((it, idx) => {
                  const ing = ingById.get(Number(it.ingrediente_id));
                  return (
                    <div
                      key={`${it.ingrediente_id}-${idx}`}
                      className="flex flex-wrap md:flex-nowrap items-center gap-2 p-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]"
                    >
                      <select
                        value={it.ingrediente_id}
                        onChange={(e) => updateLinea(idx, 'ingrediente_id', Number(e.target.value))}
                        aria-label="Ingrediente"
                        className={`${inputCls} flex-1 min-w-0`}
                      >
                        {ingredientes.map((ingOpt) => (
                          <option key={ingOpt.id} value={ingOpt.id}>
                            {ingOpt.nombre} ({ingOpt.unidad})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={it.cantidad}
                          onChange={(e) => updateLinea(idx, 'cantidad', e.target.value)}
                          placeholder="0.000"
                          aria-label="Cantidad"
                          className={`${inputCls} w-24 font-mono`}
                        />
                        <span className="text-xs text-[color:var(--text-muted)] w-10 truncate">
                          {ing?.unidad || ''}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={it.notas || ''}
                        onChange={(e) => updateLinea(idx, 'notas', e.target.value)}
                        placeholder="Notas"
                        maxLength={255}
                        aria-label="Notas"
                        className={`${inputCls} flex-1 min-w-0`}
                      />
                      <button
                        type="button"
                        onClick={() => removeLinea(idx)}
                        className="p-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors"
                        aria-label="Quitar ingrediente"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[color:var(--border)] text-sm font-medium hover:bg-[color:var(--bg)] hover:border-[color:var(--primary,#3b82f6)]/40 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar ingrediente
              </button>
            </>
          )}
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
            onClick={handleSave}
            disabled={saving || loading}
            className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar receta</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
