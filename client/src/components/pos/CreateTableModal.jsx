/**
 * Modal para crear una mesa nueva (POS Fase 2).
 *
 * Solo el dueño del restaurante (o admin) puede crear. Reusa el patrón
 * hand-rolled de inputs controlado de otros modales (ver StaffPage).
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { posTablesService } from '../../services/api';

const FORMAS = [
  { value: 'rectangle', label: 'Rectángulo' },
  { value: 'circle',    label: 'Círculo' },
  { value: 'round',     label: 'Redondo' },
];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg shadow-xl w-full max-w-md border border-[color:var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Nueva mesa</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <Field label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={50}
              required
              className={INPUT_CLS}
              placeholder="Mesa 1, Barra 3…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacidad">
              <input type="number" min={1} max={20} value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Forma">
              <select value={forma} onChange={(e) => setForma(e.target.value)} className={INPUT_CLS}>
                {FORMAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posición X">
              <input type="number" min={0} value={posX}
                onChange={(e) => setPosX(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Posición Y">
              <input type="number" min={0} value={posY}
                onChange={(e) => setPosY(e.target.value)} className={INPUT_CLS} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ancho (px)">
              <input type="number" min={60} max={300} value={ancho}
                onChange={(e) => setAncho(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Alto (px)">
              <input type="number" min={60} max={300} value={alto}
                onChange={(e) => setAlto(e.target.value)} className={INPUT_CLS} />
            </Field>
          </div>
          {error && (
            <div className="text-sm px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md text-sm border border-[color:var(--border)] hover:bg-[color:var(--bg)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-3 py-2 rounded-md text-sm bg-[color:var(--primary,#3b82f6)] text-white disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear mesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT_CLS = 'w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[color:var(--text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}
