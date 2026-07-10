/**
 * HomeHeroPage (Fase 12d).
 *
 * CMS admin para configurar la sección hero de la home pública.
 * Tiene 2 tabs:
 *
 *  1) "Textos del Hero" — 4 cards (título, subtítulo, buscador, badge)
 *     con toggle ON/OFF cada uno y campos de texto editables. Los
 *     inputs se deshabilitan cuando su toggle está apagado. Preview
 *     en vivo de cómo queda cada bloque.
 *
 *  2) "Botones" — CRUD libre de botones custom. Reordenables con
 *     drag & drop (@dnd-kit, misma lib que usa el POS Fase 10 para
 *     los modificadores). Cada botón tiene: label, url, variant
 *     (primary/secondary/outline), icono (whitelist lucide), switch
 *     activo y switch nueva_pestana.
 *
 * Patrón UI: idéntico al de `HomeMediaPage.jsx` (auto-dismiss toasts,
 * modal de confirmación, empty state, drag & drop con dnd-kit).
 *
 * Endpoints consumidos (todos vía `adminService`):
 *   - GET   /admin/home-hero/settings
 *   - PUT   /admin/home-hero/settings
 *   - GET   /admin/home-hero/buttons
 *   - POST  /admin/home-hero/buttons
 *   - PUT   /admin/home-hero/buttons/:id
 *   - DELETE /admin/home-hero/buttons/:id
 *   - POST  /admin/home-hero/buttons/reorder
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminService } from '../../services/api';
import {
  ArrowLeft, AlertCircle, Check, X, Loader2, Type, MousePointerClick,
  Plus, Edit2, Trash2, GripVertical, ExternalLink, MessageCircle, MapPin,
  Store, Phone, ShoppingBag, Coffee, ChevronRight, Send,
} from 'lucide-react';
import Loading from '../../components/Loading';

const ICON_MAP = {
  MessageCircle, MapPin, Store, Phone, ExternalLink,
  ShoppingBag, Coffee, ChevronRight, Send,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);
const VARIANT_OPTIONS = [
  { value: 'primary',   label: 'Primario',  desc: 'Sólido blanco, el más visible' },
  { value: 'secondary', label: 'Secundario', desc: 'Semi-transparente, contraste sutil' },
  { value: 'outline',   label: 'Outline',  desc: 'Solo borde, el más discreto' },
];

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] ' +
  'bg-[color:var(--bg-base)] text-sm focus:outline-none focus:ring-2 ' +
  'focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] ' +
  'transition disabled:opacity-50 disabled:cursor-not-allowed';

const labelCls =
  'block text-xs font-semibold text-[color:var(--text-muted)] mb-1';

const TABS = [
  { key: 'textos',   label: 'Textos del Hero', Icon: Type },
  { key: 'botones',  label: 'Botones',         Icon: MousePointerClick },
];

export default function HomeHeroPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('textos');

  // Settings state.
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Buttons state.
  const [buttons, setButtons] = useState([]);
  const [buttonsLoading, setButtonsLoading] = useState(true);
  const [buttonModal, setButtonModal] = useState(null); // { mode: 'create' | 'edit', data }
  const [confirmDelete, setConfirmDelete] = useState(null); // button object
  const [actionId, setActionId] = useState(null); // button id being mutated

  // Toasts.
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);
  const showError = (msg) => { setError(msg); setSuccess(''); };
  const showSuccess = (msg) => { setSuccess(msg); setError(''); };

  // ============ Cargas iniciales ============
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const r = await adminService.getHomeHeroSettings();
      setSettings(r.data?.settings || null);
      setSettingsDirty(false);
    } catch (e) {
      showError(e.response?.data?.error || 'Error cargando configuración');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchButtons = useCallback(async () => {
    try {
      setButtonsLoading(true);
      const r = await adminService.listHomeHeroButtons();
      setButtons(Array.isArray(r.data?.buttons) ? r.data.buttons : []);
    } catch (e) {
      showError(e.response?.data?.error || 'Error listando botones');
    } finally {
      setButtonsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchButtons(); }, [fetchButtons]);

  // ============ Settings handlers ============
  const updateField = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };
  const updateToggle = (key, bool) => {
    setSettings((prev) => ({ ...prev, [key]: bool ? 1 : 0 }));
    setSettingsDirty(true);
  };
  const handleSaveSettings = async () => {
    if (settingsSaving || !settings) return;
    try {
      setSettingsSaving(true);
      setError('');
      // Mandamos solo los campos que difieren del default para no
      // chocar actualizaciones innecesarias. Por simplicidad mandamos
      // todo el objeto — el modelo hace whitelist y solo aplica los
      // campos permitidos.
      const r = await adminService.updateHomeHeroSettings(settings);
      setSettings(r.data?.settings || settings);
      setSettingsDirty(false);
      showSuccess('Configuración del hero guardada');
    } catch (e) {
      showError(e.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ============ Buttons handlers ============
  const handleCreateButton = () => {
    setButtonModal({
      mode: 'create',
      data: {
        label: '',
        url: '',
        variant: 'primary',
        icono: null,
        nueva_pestana: true,
        activo: true,
      },
    });
  };
  const handleEditButton = (b) => {
    setButtonModal({
      mode: 'edit',
      data: {
        id: b.id,
        label: b.label,
        url: b.url,
        variant: b.variant || 'primary',
        icono: b.icono || null,
        nueva_pestana: Boolean(Number(b.nueva_pestana ?? 1)),
        activo: Boolean(Number(b.activo ?? 1)),
      },
    });
  };
  const handleSaveButton = async (data) => {
    try {
      setError('');
      if (buttonModal?.mode === 'create') {
        const r = await adminService.createHomeHeroButton(data);
        showSuccess(`Botón "${data.label}" creado`);
        await fetchButtons();
        setButtonModal(null);
        return r;
      } else {
        const r = await adminService.updateHomeHeroButton(buttonModal.data.id, data);
        showSuccess(`Botón "${data.label}" actualizado`);
        await fetchButtons();
        setButtonModal(null);
        return r;
      }
    } catch (e) {
      showError(e.response?.data?.error || 'Error guardando botón');
      throw e;
    }
  };
  const handleDeleteButton = async (b) => {
    try {
      setActionId(b.id);
      setError('');
      await adminService.deleteHomeHeroButton(b.id);
      showSuccess(`Botón "${b.label}" eliminado`);
      setConfirmDelete(null);
      await fetchButtons();
    } catch (e) {
      showError(e.response?.data?.error || 'Error eliminando botón');
    } finally {
      setActionId(null);
    }
  };
  const handleToggleButtonActivo = async (b) => {
    try {
      setActionId(b.id);
      setError('');
      await adminService.updateHomeHeroButton(b.id, { activo: !Number(b.activo) });
      showSuccess(Number(b.activo) ? 'Botón ocultado de la home' : 'Botón visible en la home');
      await fetchButtons();
    } catch (e) {
      showError(e.response?.data?.error || 'Error cambiando visibilidad');
    } finally {
      setActionId(null);
    }
  };

  // ============ Drag & drop reorder ============
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = buttons.findIndex((b) => b.id === active.id);
    const newIndex = buttons.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(buttons, oldIndex, newIndex);
    setButtons(reordered); // optimistic
    try {
      await adminService.reorderHomeHeroButtons(reordered.map((b) => b.id));
      showSuccess('Orden de botones actualizado');
    } catch (e) {
      showError(e.response?.data?.error || 'Error reordenando botones');
      // Rollback
      await fetchButtons();
    }
  };

  if (settingsLoading && buttonsLoading) return <Loading />;

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)] transition-colors"
              aria-label="Volver al dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
                Personalizar Hero de la Home
              </h1>
              <p className="text-sm text-[color:var(--text-muted)] mt-1">
                Editá los textos que ven los visitantes y agregá botones custom.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6" role="tablist">
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98]',
                  active
                    ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10 text-[color:var(--primary,#3b82f6)]'
                    : 'border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:border-[color:var(--border-default)]',
                ].join(' ')}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Toasts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded">
              <X size={14} />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 text-sm">
            <Check size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{success}</div>
          </div>
        )}

        {/* Tab content */}
        {tab === 'textos' ? (
          <SettingsTab
            settings={settings}
            dirty={settingsDirty}
            saving={settingsSaving}
            onUpdateField={updateField}
            onUpdateToggle={updateToggle}
            onSave={handleSaveSettings}
          />
        ) : (
          <ButtonsTab
            buttons={buttons}
            loading={buttonsLoading}
            onCreate={handleCreateButton}
            onEdit={handleEditButton}
            onDelete={(b) => setConfirmDelete(b)}
            onToggleActivo={handleToggleButtonActivo}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            actionId={actionId}
          />
        )}
      </div>

      {/* Modal crear/editar botón */}
      {buttonModal && (
        <ButtonFormModal
          mode={buttonModal.mode}
          initial={buttonModal.data}
          onClose={() => setButtonModal(null)}
          onSave={handleSaveButton}
        />
      )}

      {/* Modal confirmación de borrado */}
      {confirmDelete && (
        <ConfirmDeleteModal
          button={confirmDelete}
          busy={actionId === confirmDelete.id}
          onConfirm={() => handleDeleteButton(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ============ Tab: Settings ============

function SettingsTab({ settings, dirty, saving, onUpdateField, onUpdateToggle, onSave }) {
  if (!settings) return <Loading />;

  const toggles = [
    { key: 'mostrar_titulo',     title: 'Título principal',     sub: 'El h1 grande ("Pide lo que Amas")' },
    { key: 'mostrar_subtitulo',  title: 'Subtítulo',            sub: 'La frase debajo del título' },
    { key: 'mostrar_buscador',   title: 'Buscador',             sub: 'La barra de búsqueda' },
    { key: 'mostrar_badge_locales', title: 'Badge de locales',  sub: '"Más de N locales disponibles"' },
  ];

  return (
    <div className="space-y-4">
      {toggles.map((t) => (
        <ToggleCard
          key={t.key}
          title={t.title}
          sub={t.sub}
          enabled={Boolean(Number(settings[t.key] ?? 1))}
          onToggle={(v) => onUpdateToggle(t.key, v)}
        >
          {t.key === 'mostrar_titulo' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Texto inicial (gris)</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={100}
                  value={settings.titulo_pre || ''}
                  onChange={(e) => onUpdateField('titulo_pre', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_titulo))}
                />
              </div>
              <div>
                <label className={labelCls}>Texto destacado (blanco)</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={100}
                  value={settings.titulo_post || ''}
                  onChange={(e) => onUpdateField('titulo_post', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_titulo))}
                />
              </div>
              <PreviewBox>
                <span>{settings.titulo_pre || ''} </span>
                <span className="text-white font-extrabold">{settings.titulo_post || ''}</span>
              </PreviewBox>
            </div>
          )}

          {t.key === 'mostrar_subtitulo' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Texto inicial</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={200}
                  value={settings.subtitulo_pre || ''}
                  onChange={(e) => onUpdateField('subtitulo_pre', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_subtitulo))}
                />
              </div>
              <div>
                <label className={labelCls}>Palabra destacada (bold)</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={50}
                  value={settings.subtitulo_bold || ''}
                  onChange={(e) => onUpdateField('subtitulo_bold', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_subtitulo))}
                />
              </div>
              <div>
                <label className={labelCls}>Texto final</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={200}
                  value={settings.subtitulo_post || ''}
                  onChange={(e) => onUpdateField('subtitulo_post', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_subtitulo))}
                />
              </div>
              <PreviewBox className="sm:col-span-3">
                <span>{settings.subtitulo_pre || ''} </span>
                <span className="font-semibold text-white">{settings.subtitulo_bold || ''}</span>
                <span> {settings.subtitulo_post || ''}</span>
              </PreviewBox>
            </div>
          )}

          {t.key === 'mostrar_buscador' && (
            <div>
              <label className={labelCls}>Placeholder del input</label>
              <input
                className={inputCls}
                type="text"
                maxLength={200}
                value={settings.buscador_placeholder || ''}
                onChange={(e) => onUpdateField('buscador_placeholder', e.target.value)}
                disabled={!Boolean(Number(settings.mostrar_buscador))}
              />
              <p className="text-xs text-[color:var(--text-muted)] mt-1">
                Es lo que el visitante ve antes de empezar a escribir.
              </p>
            </div>
          )}

          {t.key === 'mostrar_badge_locales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Texto inicial</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={100}
                  value={settings.badge_locales_pre || ''}
                  onChange={(e) => onUpdateField('badge_locales_pre', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_badge_locales))}
                />
              </div>
              <div>
                <label className={labelCls}>Texto final</label>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={50}
                  value={settings.badge_locales_sufijo || ''}
                  onChange={(e) => onUpdateField('badge_locales_sufijo', e.target.value)}
                  disabled={!Boolean(Number(settings.mostrar_badge_locales))}
                />
              </div>
              <PreviewBox className="sm:col-span-2">
                {settings.badge_locales_pre || 'Más de'} 10 {settings.badge_locales_sufijo || 'locales disponibles'}
              </PreviewBox>
            </div>
          )}
        </ToggleCard>
      ))}

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-6 mt-4 p-4 bg-[color:var(--bg-elevated)] border-t border-[color:var(--border-default)] flex items-center justify-end gap-2">
        {dirty && (
          <span className="text-xs text-amber-600 font-semibold mr-auto">
            Cambios sin guardar
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--primary,#3b82f6)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

function ToggleCard({ title, sub, enabled, onToggle, children }) {
  return (
    <div className={[
      'rounded-2xl border-2 bg-[color:var(--bg-elevated)] p-4 sm:p-5 transition-all',
      enabled ? 'border-[color:var(--border-subtle)]' : 'border-dashed border-[color:var(--border-default)] opacity-90',
    ].join(' ')}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-heading font-semibold text-base">{title}</h3>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{sub}</p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label={`Toggle ${title}`} />
      </div>
      <div className={enabled ? '' : 'pointer-events-none'}>
        {children}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
        checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

function PreviewBox({ children, className = '' }) {
  return (
    <div className={[
      'mt-3 px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white/90 text-sm',
      className,
    ].join(' ')}>
      <span className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">Preview</span>
      <div>{children}</div>
    </div>
  );
}

// ============ Tab: Buttons ============

function ButtonsTab({ buttons, loading, onCreate, onEdit, onDelete, onToggleActivo, onDragEnd, sensors, actionId }) {
  if (loading) return <Loading />;

  if (buttons.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]">
        <MousePointerClick size={48} className="mx-auto text-[color:var(--text-muted)] mb-4" />
        <h3 className="text-lg font-heading font-semibold mb-2">No hay botones todavía</h3>
        <p className="text-sm text-[color:var(--text-muted)] mb-4 max-w-md mx-auto">
          Agregá botones custom (ej: "WhatsApp", "Registrar mi local", "Ver mapa") que aparecerán sobre el banner.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[color:var(--primary,#3b82f6)] text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Plus size={16} />
          Crear primer botón
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-[color:var(--text-muted)]">
          {buttons.length} {buttons.length === 1 ? 'botón' : 'botones'} ·
          arrastrá para reordenar
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[color:var(--primary,#3b82f6)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Plus size={14} />
          Agregar botón
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={buttons.map((b) => b.id)} strategy={rectSortingStrategy}>
          <div className="space-y-2">
            {buttons.map((b) => (
              <SortableButtonCard
                key={b.id}
                button={b}
                isBusy={actionId === b.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActivo={onToggleActivo}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableButtonCard({ button, isBusy, onEdit, onDelete, onToggleActivo }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: button.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const Icon = ICON_MAP[button.icono];
  const isActive = Boolean(Number(button.activo));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 p-3 rounded-xl border-2 bg-[color:var(--bg-elevated)] transition-all',
        isActive ? 'border-[color:var(--border-subtle)]' : 'border-dashed border-[color:var(--border-default)] opacity-70',
        isDragging ? 'shadow-xl' : '',
      ].join(' ')}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1.5 rounded hover:bg-[color:var(--bg-muted)] cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={16} className="text-[color:var(--text-muted)]" />
      </button>

      {/* Icono + Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="flex-shrink-0 text-[color:var(--text-muted)]" />}
          <span className="font-heading font-semibold text-sm truncate">{button.label}</span>
        </div>
        <p className="text-xs text-[color:var(--text-muted)] truncate font-mono mt-0.5" title={button.url}>
          {button.url}
        </p>
      </div>

      {/* Variant badge */}
      <span className={[
        'hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
        button.variant === 'primary' && 'bg-white text-gray-900',
        button.variant === 'secondary' && 'bg-white/15 text-white',
        button.variant === 'outline' && 'border border-white/40 text-white',
      ].filter(Boolean).join(' ')}>
        {button.variant}
      </span>

      {/* Activo toggle */}
      <Switch
        checked={isActive}
        onChange={() => onToggleActivo(button)}
        label={`Toggle ${button.label}`}
      />

      {/* Edit */}
      <button
        type="button"
        onClick={() => onEdit(button)}
        disabled={isBusy}
        className="p-1.5 rounded hover:bg-[color:var(--bg-muted)] text-[color:var(--text-muted)] disabled:opacity-50"
        aria-label={`Editar ${button.label}`}
      >
        <Edit2 size={14} />
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(button)}
        disabled={isBusy}
        className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-50"
        aria-label={`Eliminar ${button.label}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ============ Modal: ButtonForm ============

function ButtonFormModal({ mode, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, []);

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e) => {
    e?.preventDefault();
    if (saving) return;
    if (!form.label?.trim()) {
      setErr('El label es requerido');
      return;
    }
    if (!form.url?.trim()) {
      setErr('La URL es requerida');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSave({
        ...form,
        label: form.label.trim(),
        url: form.url.trim(),
        icono: form.icono || null,
      });
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="bg-[color:var(--bg-elevated)] rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-heading font-bold mb-1">
          {mode === 'create' ? 'Nuevo botón del hero' : 'Editar botón del hero'}
        </h2>
        <p className="text-xs text-[color:var(--text-muted)] mb-4">
          Aparecerá sobre el banner, en la página principal.
        </p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Texto del botón <span className="text-rose-500">*</span></label>
            <input
              ref={firstInputRef}
              className={inputCls}
              type="text"
              maxLength={80}
              value={form.label || ''}
              onChange={(e) => update('label', e.target.value)}
              placeholder="Ej: WhatsApp, Registrá tu local, Ver mapa"
            />
          </div>

          <div>
            <label className={labelCls}>URL <span className="text-rose-500">*</span></label>
            <input
              className={inputCls}
              type="text"
              maxLength={500}
              value={form.url || ''}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://wa.me/573001234567  o  /admin  o  //cdn.example.com/img.png"
            />
            <p className="text-[11px] text-[color:var(--text-muted)] mt-1">
              Aceptamos <code>https://</code>, <code>http://</code>, ruta interna <code>/...</code> o protocol-relative <code>//...</code>.
            </p>
          </div>

          <div>
            <label className={labelCls}>Estilo (variant)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VARIANT_OPTIONS.map((v) => {
                const active = form.variant === v.value;
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => update('variant', v.value)}
                    className={[
                      'p-2.5 rounded-lg text-left border-2 transition-all',
                      active
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                        : 'border-[color:var(--border-subtle)] hover:border-[color:var(--border-default)]',
                    ].join(' ')}
                  >
                    <div className="text-xs font-bold">{v.label}</div>
                    <div className="text-[10px] text-[color:var(--text-muted)] mt-0.5">{v.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Icono</label>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
              <button
                type="button"
                onClick={() => update('icono', null)}
                className={[
                  'aspect-square rounded-lg flex items-center justify-center border-2 transition-all',
                  !form.icono
                    ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                    : 'border-[color:var(--border-subtle)] hover:border-[color:var(--border-default)]',
                ].join(' ')}
                aria-label="Sin icono"
                title="Sin icono"
              >
                <X size={14} />
              </button>
              {ICON_OPTIONS.map((name) => {
                const Icon = ICON_MAP[name];
                const active = form.icono === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => update('icono', name)}
                    className={[
                      'aspect-square rounded-lg flex items-center justify-center border-2 transition-all',
                      active
                        ? 'border-[color:var(--primary,#3b82f6)] bg-[color:var(--primary,#3b82f6)]/10'
                        : 'border-[color:var(--border-subtle)] hover:border-[color:var(--border-default)]',
                    ].join(' ')}
                    title={name}
                    aria-label={name}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.nueva_pestana)}
                onChange={(e) => update('nueva_pestana', e.target.checked)}
                className="rounded"
              />
              <span>Abrir en nueva pestaña</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.activo)}
                onChange={(e) => update('activo', e.target.checked)}
                className="rounded"
              />
              <span>Visible en la home</span>
            </label>
          </div>
        </div>

        {err && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-lg border border-[color:var(--border-default)] hover:bg-[color:var(--bg-muted)] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg bg-[color:var(--primary,#3b82f6)] text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Guardando…' : (mode === 'create' ? 'Crear' : 'Guardar')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============ Modal: ConfirmDelete ============

function ConfirmDeleteModal({ button, busy, onConfirm, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-heading font-bold mb-2">¿Eliminar "{button.label}"?</h3>
        <p className="text-sm text-[color:var(--text-muted)] mb-4">
          Esta acción no se puede deshacer. El botón dejará de aparecer en la home.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg border border-[color:var(--border-default)] hover:bg-[color:var(--bg-muted)] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
