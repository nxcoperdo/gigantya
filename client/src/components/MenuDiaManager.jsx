import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Clock, X, Check, Sun, UtensilsCrossed, Loader2, Pencil, ImagePlus, CalendarDays, SlidersHorizontal,
} from 'lucide-react';
import { menuDiaService, productService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import ProductModal from './ProductModal';

const DIAS = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
  { n: 6, label: 'Sábado' },
  { n: 7, label: 'Domingo' },
];

const TIPOS = [
  { key: 'desayuno', label: 'Desayuno', Icon: Sun },
  { key: 'almuerzo', label: 'Almuerzo', Icon: UtensilsCrossed },
];

const emptyHorarios = { desayuno: { desde: '', hasta: '' }, almuerzo: { desde: '', hasta: '' } };

/**
 * Pestaña "Menú del día" (corrientazo) del dashboard del dueño.
 * Grilla semanal (7 días × Desayuno/Almuerzo). Cada celda apunta a un combo
 * (producto con es_menu_dia). El dueño lo arma una vez y rota solo.
 */
export default function MenuDiaManager({ restaurante }) {
  const [weekly, setWeekly] = useState([]);
  const [combos, setCombos] = useState([]);
  const [horarios, setHorarios] = useState(emptyHorarios);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'error', text }

  const [editing, setEditing] = useState(null); // { tipo, dia }
  // Combo cuyas opciones (modificadores) se están editando en el ProductModal.
  const [editingCombo, setEditingCombo] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await menuDiaService.getWeekly();
      setWeekly(data.weekly || []);
      setCombos(data.combos || []);
      setHorarios({
        desayuno: {
          desde: data.horarios?.desayuno?.desde || '',
          hasta: data.horarios?.desayuno?.hasta || '',
        },
        almuerzo: {
          desde: data.horarios?.almuerzo?.desde || '',
          hasta: data.horarios?.almuerzo?.hasta || '',
        },
      });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'No se pudo cargar el menú del día' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Índice rápido: `${tipo}-${dia}` → celda
  const cellMap = useMemo(() => {
    const m = {};
    for (const c of weekly) m[`${c.tipo_comida}-${c.dia_semana}`] = c;
    return m;
  }, [weekly]);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const assignCombo = async (tipo, dia, producto_id) => {
    try {
      await menuDiaService.setCell({ tipo_comida: tipo, dia_semana: dia, producto_id });
      setEditing(null);
      await load();
      flash('ok', 'Menú del día actualizado');
    } catch (err) {
      flash('error', err.response?.data?.error || 'No se pudo asignar el combo');
    }
  };

  const clearCell = async (tipo, dia) => {
    try {
      await menuDiaService.deleteCell(tipo, dia);
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'No se pudo quitar el combo');
    }
  };

  const saveHorarios = async () => {
    try {
      await menuDiaService.setHorarios(horarios);
      flash('ok', 'Franjas horarias guardadas');
    } catch (err) {
      flash('error', err.response?.data?.error || 'No se pudieron guardar las franjas');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[color:var(--text-muted)]">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
          <CalendarDays size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-[color:var(--text-primary)]">Menú del día (corrientazo)</h3>
          <p className="text-sm text-[color:var(--text-secondary)]">
            Arma el desayuno y el almuerzo de cada día. La app le muestra al cliente solo el de hoy, y rota sola cada semana. Con el botón <SlidersHorizontal size={13} className="inline align-text-bottom text-primary" /> de cada combo agregas opciones para que el cliente elija (ej: tipo de huevo: rancheros, fritos o revueltos).
          </p>
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-2.5 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'alert alert-error'}`}>
          {msg.text}
        </div>
      )}

      {/* Franjas horarias */}
      <div className="card p-4">
        <h4 className="font-semibold flex items-center gap-2 mb-1">
          <Clock size={16} className="text-primary" /> Franjas horarias <span className="text-[color:var(--text-muted)] font-normal text-sm">(opcional)</span>
        </h4>
        <p className="text-xs text-[color:var(--text-secondary)] mb-3">
          Define a qué hora se sirve cada comida. Si las dejas vacías, se muestran todo el día.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TIPOS.map(({ key, label, Icon }) => (
            <div key={key} className="flex items-center gap-2">
              <Icon size={16} className="text-primary flex-shrink-0" />
              <span className="text-sm font-medium w-20">{label}</span>
              <input
                type="time"
                value={horarios[key].desde}
                onChange={(e) => setHorarios((h) => ({ ...h, [key]: { ...h[key], desde: e.target.value } }))}
                className="input py-1.5 text-sm flex-1 min-w-0"
              />
              <span className="text-[color:var(--text-muted)] text-sm">a</span>
              <input
                type="time"
                value={horarios[key].hasta}
                onChange={(e) => setHorarios((h) => ({ ...h, [key]: { ...h[key], hasta: e.target.value } }))}
                className="input py-1.5 text-sm flex-1 min-w-0"
              />
            </div>
          ))}
        </div>
        <button onClick={saveHorarios} className="btn btn-secondary btn-sm mt-3">Guardar franjas</button>
      </div>

      {/* Grilla semanal */}
      <div className="space-y-3">
        {DIAS.map(({ n, label }) => (
          <div key={n} className="card p-3">
            <div className="text-sm font-bold text-[color:var(--text-primary)] mb-2">{label}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TIPOS.map(({ key, label: tipoLabel, Icon }) => {
                const cell = cellMap[`${key}-${n}`];
                return (
                  <div key={key} className="rounded-xl border border-[color:var(--border-subtle)] p-3 bg-[color:var(--bg-subtle)]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
                      <Icon size={13} /> {tipoLabel}
                    </div>
                    {cell ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[color:var(--bg-muted)] flex-shrink-0">
                          {cell.imagen_url
                            ? <img src={getImageUrl(cell.imagen_url)} alt={cell.nombre} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{cell.nombre}</p>
                          <p className="text-primary font-bold text-sm tabular-nums">{formatCurrency(cell.precio)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setEditingCombo({
                              id: cell.producto_id,
                              nombre: cell.nombre,
                              descripcion: cell.descripcion,
                              precio: cell.precio,
                              imagen_url: cell.imagen_url,
                              disponible: cell.disponible,
                            })}
                            className="p-1.5 rounded-lg hover:bg-[color:var(--bg-muted)] text-primary"
                            title="Opciones (ej: tipo de huevo, tamaño…)"
                          >
                            <SlidersHorizontal size={15} />
                          </button>
                          <button onClick={() => setEditing({ tipo: key, dia: n })} className="p-1.5 rounded-lg hover:bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]" title="Cambiar combo">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => clearCell(key, n)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Quitar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditing({ tipo: key, dia: n })}
                        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[color:var(--border-default)] text-sm text-[color:var(--text-secondary)] hover:border-primary hover:text-primary transition-colors"
                      >
                        <Plus size={16} /> Asignar combo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CellEditorModal
          editing={editing}
          combos={combos}
          dias={DIAS}
          tipos={TIPOS}
          onClose={() => setEditing(null)}
          onAssign={assignCombo}
          onCreated={async (producto_id) => { await assignCombo(editing.tipo, editing.dia, producto_id); }}
          onCombosChanged={load}
        />
      )}

      {/* Editor de opciones/modificadores del combo (reusa el ProductModal).
          Sirve para que el cliente elija variantes: tipo de huevo (rancheros/
          fritos/revueltos), tamaño, proteína, etc. */}
      <ProductModal
        isOpen={!!editingCombo}
        onClose={() => setEditingCombo(null)}
        onSave={() => { setEditingCombo(null); load(); }}
        product={editingCombo}
        restaurantId={restaurante?.id}
        restaurante={restaurante}
      />
    </div>
  );
}

/**
 * Modal para asignar una celda: elegir un combo existente o crear uno nuevo.
 */
function CellEditorModal({ editing, combos, dias, tipos, onClose, onAssign, onCreated }) {
  const [tab, setTab] = useState(combos.length > 0 ? 'pick' : 'create');
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const diaLabel = dias.find((d) => d.n === editing.dia)?.label;
  const tipoLabel = tipos.find((t) => t.key === editing.tipo)?.label;

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const createCombo = async () => {
    setError('');
    if (!form.nombre.trim()) return setError('Escribe un nombre para el combo');
    const precioNum = Number(form.precio);
    if (!precioNum || precioNum <= 0) return setError('Escribe un precio válido');

    setSaving(true);
    try {
      let imagen_url = null;
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        const { data } = await productService.uploadImage(fd);
        imagen_url = data.url;
      }
      const { data } = await productService.create({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: precioNum,
        imagen_url,
        es_menu_dia: true,
      });
      await onCreated(data.producto_id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el combo');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[color:var(--bg-elevated)] w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-y-auto animate-scaleIn">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border-subtle)] sticky top-0 bg-[color:var(--bg-elevated)]">
          <div>
            <h3 className="font-bold text-[color:var(--text-primary)]">{tipoLabel} · {diaLabel}</h3>
            <p className="text-xs text-[color:var(--text-secondary)]">Elige un combo o crea uno nuevo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[color:var(--bg-muted)]"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[color:var(--border-subtle)]">
          <button
            onClick={() => setTab('pick')}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === 'pick' ? 'text-primary border-b-2 border-primary' : 'text-[color:var(--text-secondary)]'}`}
          >
            Combos existentes ({combos.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === 'create' ? 'text-primary border-b-2 border-primary' : 'text-[color:var(--text-secondary)]'}`}
          >
            Crear nuevo
          </button>
        </div>

        <div className="p-5">
          {tab === 'pick' ? (
            combos.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--text-muted)] py-8">
                Todavía no tienes combos. Crea el primero en la pestaña «Crear nuevo».
              </p>
            ) : (
              <div className="space-y-2">
                {combos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onAssign(editing.tipo, editing.dia, c.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[color:var(--border-subtle)] hover:border-primary hover:bg-primaryLight/20 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[color:var(--bg-muted)] flex-shrink-0">
                      {c.imagen_url ? <img src={getImageUrl(c.imagen_url)} alt={c.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.nombre}</p>
                      {c.descripcion && <p className="text-xs text-[color:var(--text-secondary)] truncate">{c.descripcion}</p>}
                    </div>
                    <span className="text-primary font-bold text-sm tabular-nums">{formatCurrency(c.precio)}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {error && <div className="alert alert-error text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-semibold mb-1.5">Nombre del combo</label>
                <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="input" placeholder="Almuerzo del día" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Componentes <span className="text-[color:var(--text-muted)] font-normal">(sopa, principio, proteína, jugo…)</span>
                </label>
                <textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} className="input" rows={3} placeholder="Sopa: sancocho · Principio: frijoles · Proteína: carne asada · Jugo: mora" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Precio</label>
                <input type="number" min="0" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} className="input" placeholder="15000" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Foto <span className="text-[color:var(--text-muted)] font-normal">(opcional)</span></label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[color:var(--bg-muted)] flex-shrink-0">
                    {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[color:var(--text-muted)]"><ImagePlus size={20} /></div>}
                  </div>
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    Elegir foto
                    <input type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                  </label>
                </div>
              </div>
              <button onClick={createCombo} disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Creando…</> : <><Check size={16} /> Crear y asignar</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
