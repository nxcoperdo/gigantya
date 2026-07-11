/**
 * Página de gestión de personal del POS (Fase 1).
 *
 * Permite al dueño del restaurante:
 *   - Listar el staff actual (cajero/mesero/cocina) de su local.
 *   - Crear uno nuevo. La API devuelve una contraseña temporal que se
 *     muestra al dueño UNA sola vez (debe copiarla y compartirla con
 *     el staff por un canal seguro).
 *   - Activar / desactivar (no eliminar — preserva historial de pedidos).
 */
import { useEffect, useState } from 'react';
import {
  Plus, Power, Users as UsersIcon, X, Copy, Check,
  Mail, Phone, CreditCard, UserCog, Loader2, ShieldCheck,
} from 'lucide-react';
import { posStaffService } from '../../services/api';

const ROL_PILL = {
  cajero: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  mesero: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  cocina: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [ultimoCreado, setUltimoCreado] = useState(null); // { ..., contrasena_temporal }
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await posStaffService.list();
      setStaff(data.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando personal');
    } finally {
      setLoading(false);
    }
  }

  async function toggleEstado(member) {
    const nuevoEstado = member.estado === 'activo' ? 'inactivo' : 'activo';
    if (!window.confirm(`¿Cambiar el estado de ${member.nombre} a ${nuevoEstado}?`)) return;
    try {
      await posStaffService.setStatus(member.id, nuevoEstado);
      setStaff((prev) => prev.map((m) => m.id === member.id ? { ...m, estado: nuevoEstado } : m));
    } catch (err) {
      alert(err.response?.data?.error || 'Error cambiando estado');
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('clipboard error', err);
    }
  };

  const counts = {
    activos: staff.filter((s) => s.estado === 'activo').length,
    inactivos: staff.filter((s) => s.estado !== 'activo').length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
          aria-hidden="true"
        >
          <UserCog className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-heading font-extrabold leading-tight">Personal del POS</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {counts.activos} activos · {counts.inactivos} inactivos
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all shadow-sm"
          type="button"
          disabled={loading}
        >
          <Plus className="w-4 h-4" /> Nuevo personal
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs underline font-medium hover:no-underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Cargando personal…</span>
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-10 text-center">
          <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="text-base font-semibold text-[color:var(--text)]">No tienes personal del POS todavía</p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1 mb-4">
            Crea el primer miembro (cajero, mesero o cocina) para empezar.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold active:scale-95 transition-all shadow-sm"
            type="button"
          >
            <Plus className="w-4 h-4" /> Crear el primero
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="text-left px-3 py-2.5 font-semibold">Nombre</th>
                <th scope="col" className="text-left px-3 py-2.5 font-semibold">Email</th>
                <th scope="col" className="text-left px-3 py-2.5 font-semibold">Rol</th>
                <th scope="col" className="text-left px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="text-right px-3 py-2.5 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => {
                const pill = ROL_PILL[m.tipo_usuario] || 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30';
                return (
                  <tr
                    key={m.id}
                    className="border-t border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/40 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-semibold">{m.nombre}</td>
                    <td className="px-3 py-2.5 text-[color:var(--text-muted)]">{m.email}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${pill}`}>
                        {m.tipo_usuario}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {m.estado === 'activo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-300 border border-zinc-500/30">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => toggleEstado(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)] text-sm font-medium transition-colors active:scale-95"
                        title={m.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        type="button"
                      >
                        <Power className="w-3.5 h-3.5" aria-hidden="true" />
                        {m.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={(nuevo) => {
            setStaff((prev) => [...prev, {
              id: nuevo.id,
              nombre: nuevo.nombre,
              email: nuevo.email,
              tipo_usuario: nuevo.tipo_usuario,
              estado: nuevo.estado,
            }]);
            setShowCreate(false);
            setUltimoCreado(nuevo);
          }}
        />
      )}

      {ultimoCreado && (
        <TempPasswordModal
          staff={ultimoCreado}
          onClose={() => setUltimoCreado(null)}
          onCopy={copy}
          copiado={copiado}
        />
      )}
    </div>
  );
}

function CreateStaffModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    tipo_usuario: 'mesero',
    documento_identidad: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.email.trim()) {
      setError('Nombre y email son obligatorios');
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await posStaffService.create(form);
      onCreated(data.staff);
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando personal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-staff-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              aria-hidden="true"
            >
              <UsersIcon className="w-5 h-5 text-white" />
            </div>
            <h2 id="new-staff-title" className="text-lg font-heading font-bold">Nuevo personal</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={submit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <UserCog className="w-3 h-3" aria-hidden="true" />
              Nombre <span className="text-rose-400">*</span>
            </span>
            <input className={inputCls} value={form.nombre} onChange={set('nombre')} required autoFocus />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Mail className="w-3 h-3" aria-hidden="true" />
              Email <span className="text-rose-400">*</span>
            </span>
            <input type="email" className={inputCls} value={form.email} onChange={set('email')} required />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Phone className="w-3 h-3" aria-hidden="true" />
              Teléfono
            </span>
            <input className={inputCls} value={form.telefono} onChange={set('telefono')} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <UserCog className="w-3 h-3" aria-hidden="true" />
              Rol <span className="text-rose-400">*</span>
            </span>
            <select
              className={inputCls}
              value={form.tipo_usuario}
              onChange={set('tipo_usuario')}
              required
            >
              <option value="cajero">Cajero</option>
              <option value="mesero">Mesero</option>
              <option value="cocina">Cocina</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <CreditCard className="w-3 h-3" aria-hidden="true" />
              Documento de identidad <span className="opacity-60 font-normal">(opcional)</span>
            </span>
            <input className={inputCls} value={form.documento_identidad} onChange={set('documento_identidad')} />
          </label>

          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              {error}
            </div>
          )}
        </form>

        <footer className="p-4 border-t border-[color:var(--border)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg)] text-sm font-medium transition-colors"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
            ) : (
              <><Plus className="w-4 h-4" /> Crear personal</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TempPasswordModal({ staff, onClose, onCopy, copiado }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-pass-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl">
        <header className="flex items-center gap-3 p-4 border-b border-[color:var(--border)]">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            aria-hidden="true"
          >
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h2 id="temp-pass-title" className="text-lg font-heading font-bold">Personal creado</h2>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            Comparte esta contraseña temporal con <strong className="text-[color:var(--text)]">{staff.nombre}</strong>.
            <br />
            <span className="text-rose-300 font-semibold">No se mostrará de nuevo.</span>
          </p>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg)] p-3.5 space-y-3">
            <div>
              <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
                Email
              </p>
              <p className="font-mono text-sm mt-0.5 break-all">{staff.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
                Contraseña temporal
              </p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 rounded-md bg-[color:var(--bg-elevated)] border border-[color:var(--border)] font-mono text-sm font-bold break-all">
                  {staff.contrasena_temporal}
                </code>
                <button
                  onClick={() => onCopy(staff.contrasena_temporal)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors active:scale-95',
                    copiado
                      ? 'bg-emerald-500 text-white'
                      : 'border border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]',
                  ].join(' ')}
                  type="button"
                  title="Copiar contraseña"
                  aria-label="Copiar contraseña"
                >
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <footer className="p-4 border-t border-[color:var(--border)] flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            <Check className="w-4 h-4" /> Listo
          </button>
        </footer>
      </div>
    </div>
  );
}
