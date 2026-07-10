/**
 * Modal para crear una mesa nueva (POS Fase 2).
 *
 * Solo el dueño del restaurante (o admin) puede crear. Reusa el patrón
 * hand-rolled de inputs controlado de otros modales (ver StaffPage).
 */
import { useState } from 'react';
import { X, Plus, Loader2, Armchair, Circle, Square } from 'lucide-react';
import { posTablesService } from '../../services/api';

const FORMAS = [
  { value: 'rectangle', label: 'Rectángulo', Icon: Square },
  { value: 'circle',    label: 'Círculo',    Icon: Circle },
  { value: 'round',     label: 'Redondo',    Icon: Circle },
];

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function CreateTableModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState('');
  const [capacidad, setCapacidad] = useState(4);
  const [forma, setForma] = useState('rectangle');
  const [posX, setPosX] = useState(100);
  const [posY, setPosY] = useState(100);
  const [ancho, setAncho] = useState(120);
  const [alto, setAlto]   = useState(120);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const r = await posTablesService.create({
        nombre: nombre.trim(),
        capacidad: Number(capacidad),
        forma,
        pos_x: Number(posX),
        pos_y: Number(posY),
        ancho: Number(ancho),
        alto: Number(alto),
      });
      onCreated?.(r.data.mesa);
      onClose();
    } catch (e2) {
      setError(e2.response?.data?.error || 'Error creando mesa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-table-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-md border border-[color:var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
              aria-hidden="true"
            >
              <Armchair className="w-5 h-5 text-white" />
            </div>
            <h2 id="create-table-title" className="text-lg font-heading font-bold">Nueva mesa</h2>
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
        <form onSubmit={submit} className="p-4 space-y-3">
          <Field label="Nombre" required>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={50}
              required
              className={INPUT_CLS}
              placeholder="Mesa 1, Barra 3…"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacidad">
              <input
                type="number" min={1} max={20} value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Forma">
              <select value={forma} onChange={(e) => setForma(e.target.value)} className={INPUT_CLS}>
                {FORMAS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posición X">
              <input
                type="number" min={0} value={posX}
                onChange={(e) => setPosX(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Posición Y">
              <input
                type="number" min={0} value={posY}
                onChange={(e) => setPosY(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ancho (px)">
              <input
                type="number" min={60} max={300} value={ancho}
                onChange={(e) => setAncho(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Alto (px)">
              <input
                type="number" min={60} max={300} value={alto}
                onChange={(e) => setAlto(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
          </div>
          {error && (
            <div
              role="alert"
              className="text-sm px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[color:var(--border)] hover:bg-[color:var(--bg)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
              ) : (
                <><Plus className="w-4 h-4" /> Crear mesa</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
