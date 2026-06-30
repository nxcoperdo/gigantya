import { useState, useEffect } from 'react';
import { X, UserPlus, Save, Trash2, ShieldAlert } from 'lucide-react';
import { adminService } from '../services/api';

export default function UserManagementModal({ isOpen, onClose, onSucceeded, userToEdit }) {
  const [user, setUser] = useState({
    nombre: '',
    email: '',
    password: '',
    tipo_usuario: 'cliente',
    telefono: '',
    documento_identidad: '',
    // Modalidad de servicio (solo aplica cuando tipo_usuario === 'restaurante').
    // El backend lo normaliza a boolean y lo guarda en `restaurantes.ofrece_domicilio`.
    ofrece_domicilio: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setIsEditing(true);
        // Normalizar `ofrece_domicilio` que viene del backend (puede ser 1/0/true/false).
        setUser({
          ...userToEdit,
          ofrece_domicilio: userToEdit.ofrece_domicilio === undefined
            ? true
            : Boolean(Number(userToEdit.ofrece_domicilio)),
        });
      } else {
        setIsEditing(false);
        setUser({
          nombre: '',
          email: '',
          password: '',
          tipo_usuario: 'cliente',
          telefono: '',
          documento_identidad: '',
          ofrece_domicilio: true,
        });
      }
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsEditing(false);
    setUser({
      nombre: '',
      email: '',
      password: '',
      tipo_usuario: 'cliente',
      telefono: '',
      documento_identidad: '',
      ofrece_domicilio: true,
    });
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const { id, password, ...updateData } = user;
        await adminService.updateUser(id, updateData);
      } else {
        await adminService.createUser(user);
      }
      onSucceeded();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-scaleIn overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus size={20} />
            <h2 className="text-xl font-bold">{isEditing ? 'Editar Usuario' : 'Crear Cuenta de Usuario'}</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Nombre Completo</label>
              <input
                type="text"
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.nombre || ''}
                onChange={(e) => setUser({...user, nombre: e.target.value})}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Email</label>
              <input
                type="email"
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.email || ''}
                onChange={(e) => setUser({...user, email: e.target.value})}
                required
                disabled={isEditing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Contraseña</label>
              <input
                type="password"
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.password || ''}
                onChange={(e) => setUser({...user, password: e.target.value})}
                required={!isEditing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Rol / Tipo</label>
              <select
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.tipo_usuario || 'cliente'}
                onChange={(e) => setUser({...user, tipo_usuario: e.target.value})}
                required
              >
                <option value="cliente">Cliente</option>
                <option value="restaurante">Local</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Teléfono</label>
              <input
                type="text"
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.telefono || ''}
                onChange={(e) => setUser({...user, telefono: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Documento ID</label>
              <input
                type="text"
                className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={user.documento_identidad || ''}
                onChange={(e) => setUser({...user, documento_identidad: e.target.value})}
              />
            </div>
          </div>

          {/* Modalidad de servicio: solo aplica cuando el rol es restaurante. */}
          {user.tipo_usuario === 'restaurante' && (
            <div className="p-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)]/40">
              <label className="flex items-start gap-3 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(user.ofrece_domicilio)}
                  onClick={() => setUser(prev => ({ ...prev, ofrece_domicilio: !prev.ofrece_domicilio }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${
                    user.ofrece_domicilio ? 'bg-primary' : 'bg-[color:var(--border-default)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      user.ofrece_domicilio ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[color:var(--text-primary)]">
                    Ofrece servicio a domicilio
                  </span>
                  <span className="block text-xs text-[color:var(--text-muted)] mt-0.5">
                    {user.ofrece_domicilio
                      ? 'El local podrá recibir pedidos a domicilio.'
                      : 'El local solo podrá ofrecer retiro en local (menú visible, sin carrito).'}
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary px-6 py-2 text-sm font-bold inline-flex items-center gap-2"
            >
              {loading ? 'Procesando...' : <><Save size={16} /> {isEditing ? 'Guardar Cambios' : 'Crear Cuenta'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}