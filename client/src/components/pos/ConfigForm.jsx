/**
 * ConfigForm (Fase 8).
 *
 * Formulario de configuración POS. Dueño del restaurante edita:
 *   - propina_sugerida_porcentaje (0-100)
 *   - metodos_pago_habilitados (checkboxes)
 *   - formato_impresion (80mm / 58mm / A4)
 *   - split_bill_habilitado (switch)
 *   - transfer_mesa_habilitado (switch)
 *   - merge_mesa_habilitado (switch)
 *
 * Auth: solo dueño (validado en el backend con `requireRestaurantOwner`).
 * Si el usuario no es dueño, el form se muestra en modo lectura.
 */
import { useEffect, useState } from 'react';
import { Save, Settings, Loader2 } from 'lucide-react';
import { posConfigService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const METODOS_DISPONIBLES = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta',       label: 'Tarjeta' },
  { key: 'nequi',         label: 'Nequi' },
  { key: 'daviplata',     label: 'Daviplata' },
  { key: 'mixto',         label: 'Mixto (legacy)' },
];

const FORMATOS = [
  { key: '80mm', label: '80mm (impresora de tickets)' },
  { key: '58mm', label: '58mm (impresora compacta)' },
  { key: 'A4',   label: 'A4 (carta / PDF)' },
];

export default function ConfigForm() {
  const { user } = useAuth();
  const isOwner = user && ['restaurante', 'admin'].includes(user.tipo_usuario);

  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await posConfigService.get();
        setCfg(r.configuracion_pos);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patch(field, value) {
    setCfg((c) => ({ ...c, [field]: value }));
  }
  function toggleMetodo(key) {
    setCfg((c) => {
      const cur = new Set(c.metodos_pago_habilitados || []);
      if (cur.has(key)) cur.delete(key); else cur.add(key);
      return { ...c, metodos_pago_habilitados: [...cur] };
    });
  }

  async function handleGuardar() {
    setError(null);
    setOkMsg(null);
    setSaving(true);
    try {
      const r = await posConfigService.update(cfg);
      setCfg(r.configuracion_pos);
      setOkMsg('Configuración guardada');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-8 text-[color:var(--text-muted)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando configuración…
      </div>
    );
  }
  if (!cfg) {
    return <div className="card text-red-600">No se pudo cargar la configuración.</div>;
  }

  return (
    <div className="card max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Configuración del POS</h2>
        {!isOwner && (
          <span className="ml-auto text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Solo lectura (no sos dueño)
          </span>
        )}
      </div>

      {/* Propina sugerida */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Propina sugerida (%)
        </label>
        <input
          type="number" min={0} max={100} step={1}
          value={cfg.propina_sugerida_porcentaje ?? 10}
          onChange={(e) => patch('propina_sugerida_porcentaje', Number(e.target.value))}
          disabled={!isOwner}
          className="input w-32"
        />
        <p className="text-xs text-[color:var(--text-muted)] mt-1">
          Porcentaje sugerido al cerrar la cuenta. 0 desactiva la sugerencia.
        </p>
      </div>

      {/* Métodos de pago */}
      <div>
        <label className="block text-sm font-medium mb-2">Métodos de pago habilitados</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {METODOS_DISPONIBLES.map((m) => {
            const checked = (cfg.metodos_pago_habilitados || []).includes(m.key);
            return (
              <label
                key={m.key}
                className={`flex items-center gap-2 p-2 rounded border ${
                  checked ? 'border-primary bg-primary/5' : 'border-[color:var(--border)]'
                } ${!isOwner && 'opacity-60'}`}
              >
                <input
                  type="checkbox" checked={checked}
                  onChange={() => toggleMetodo(m.key)}
                  disabled={!isOwner}
                />
                <span className="text-sm">{m.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Formato de impresión */}
      <div>
        <label className="block text-sm font-medium mb-1">Formato de impresión</label>
        <select
          value={cfg.formato_impresion || '80mm'}
          onChange={(e) => patch('formato_impresion', e.target.value)}
          disabled={!isOwner}
          className="input"
        >
          {FORMATOS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Features switches */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Funcionalidades</p>
        <Switch
          label="Dividir cuenta" checked={!!cfg.split_bill_habilitado}
          onChange={(v) => patch('split_bill_habilitado', v)} disabled={!isOwner}
        />
        <Switch
          label="Transferir pedidos entre mesas" checked={!!cfg.transfer_mesa_habilitado}
          onChange={(v) => patch('transfer_mesa_habilitado', v)} disabled={!isOwner}
        />
        <Switch
          label="Fusionar mesas" checked={!!cfg.merge_mesa_habilitado}
          onChange={(v) => patch('merge_mesa_habilitado', v)} disabled={!isOwner}
        />
      </div>

      {error && (
        <div className="p-2 rounded bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="p-2 rounded bg-green-50 text-green-700 text-sm border border-green-200">
          {okMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={!isOwner || saving}
          className="btn btn-primary"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-60' : ''}`}>
      <button
        type="button" role="switch" aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}
