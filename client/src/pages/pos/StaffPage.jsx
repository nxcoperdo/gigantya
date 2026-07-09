import { useEffect, useState } from 'react';
import { Plus, Power, Users as UsersIcon, X, Copy, Check } from 'lucide-react';
import { posStaffService } from '../../services/api';

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
    if (!confirm(`¿Cambiar el estado de ${member.nombre} a ${nuevoEstado}?`)) return;
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Personal del POS</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary"
          disabled={loading}
        >
          <Plus className="w-4 h-4 mr-2 inline" /> Nuevo personal
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">{error}</div>
      )}

      {loading ? (
        <p className="text-center py-12 text-[color:var(--text-muted)]">Cargando…</p>
      ) : staff.length === 0 ? (
        <div className="card-lg p-8 text-center">
          <p className="text-[color:var(--text-muted)] mb-4">
            Aún no has creado personal del POS.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="card-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg-hover)]">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id} className="border-t border-[color:var(--border)]">
                  <td className="p-3">{m.nombre}</td>
                  <td className="p-3 text-[color:var(--text-muted)]">{m.email}</td>
                  <td className="p-3 capitalize">{m.tipo_usuario}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        m.estado === 'activo'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {m.estado}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => toggleEstado(m)}
                      className="btn btn-outline btn-small"
                      title={m.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nuevo personal</h2>
          <button onClick={onClose} className="text-[color:var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input className="input w-full" value={form.nombre} onChange={set('nombre')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" className="input w-full" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input className="input w-full" value={form.telefono} onChange={set('telefono')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rol</label>
            <select className="select w-full" value={form.tipo_usuario} onChange={set('tipo_usuario')} required>
              <option value="cajero">Cajero</option>
              <option value="mesero">Mesero</option>
              <option value="cocina">Cocina</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Documento de identidad (opcional)</label>
            <input className="input w-full" value={form.documento_identidad} onChange={set('documento_identidad')} />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TempPasswordModal({ staff, onClose, onCopy, copiado }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Personal creado</h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-4">
          Comparte esta contraseña temporal con <strong>{staff.nombre}</strong>.
          No se mostrará de nuevo.
        </p>

        <div className="bg-[color:var(--bg-hover)] p-3 rounded-lg mb-4">
          <p className="text-xs text-[color:var(--text-muted)]">Email</p>
          <p className="font-mono">{staff.email}</p>
          <p className="text-xs text-[color:var(--text-muted)] mt-2">Contraseña temporal</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-lg">{staff.contrasena_temporal}</p>
            <button
              onClick={() => onCopy(staff.contrasena_temporal)}
              className="btn btn-outline btn-small"
              title="Copiar"
            >
              {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-primary">Listo</button>
        </div>
      </div>
    </div>
  );
}
