import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Mail, Phone, FileText, Lock, MapPin, ShoppingBag } from 'lucide-react';
import AddressesTab from '../components/AddressesTab';
import PurchaseHistoryTab from '../components/PurchaseHistoryTab';

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    telefono: user?.telefono || '',
  });

  const [passwordData, setPasswordData] = useState({
    contrasena_actual: '',
    contrasena_nueva: '',
    contrasena_confirmacion: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
       await api.put('/users/profile', formData);
      setSuccess('Perfil actualizado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (passwordData.contrasena_nueva !== passwordData.contrasena_confirmacion) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (passwordData.contrasena_nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
       await api.put('/auth/change-password', {
        contrasena_actual: passwordData.contrasena_actual,
        contrasena_nueva: passwordData.contrasena_nueva,
        contrasena_confirmacion: passwordData.contrasena_confirmacion,
      });
      setSuccess('Contraseña cambiada exitosamente');
      setPasswordData({
        contrasena_actual: '',
        contrasena_nueva: '',
        contrasena_confirmacion: '',
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="card-lg bg-gradient-warm mb-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center text-4xl">
              👤
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-[color:var(--text-primary)]">
                {user?.nombre}
              </h1>
              <p className="text-[color:var(--text-secondary)]">
                Cuenta de {user?.tipo_usuario === 'cliente' ? 'cliente' : 'restaurante'}
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className="alert alert-success mb-6 animate-slideDown">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-6 animate-slideDown">
            ✕ {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[color:var(--border-default)] overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 font-semibold border-b-2 transition-all duration-300 whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-primary text-primary'
                : 'border-transparent text-[color:var(--text-secondary)] hover:text-primary'
            }`}
          >
            <FileText className="inline mr-2" size={18} />
            Información Personal
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`px-4 py-3 font-semibold border-b-2 transition-all duration-300 whitespace-nowrap ${
              activeTab === 'addresses'
                ? 'border-primary text-primary'
                : 'border-transparent text-[color:var(--text-secondary)] hover:text-primary'
            }`}
          >
            <MapPin className="inline mr-2" size={18} />
            Direcciones
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-3 font-semibold border-b-2 transition-all duration-300 whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'border-primary text-primary'
                : 'border-transparent text-[color:var(--text-secondary)] hover:text-primary'
            }`}
          >
            <ShoppingBag className="inline mr-2" size={18} />
            Compras
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-3 font-semibold border-b-2 transition-all duration-300 whitespace-nowrap ${
              activeTab === 'password'
                ? 'border-primary text-primary'
                : 'border-transparent text-[color:var(--text-secondary)] hover:text-primary'
            }`}
          >
            <Lock className="inline mr-2" size={18} />
            Seguridad
          </button>
        </div>

        {/* Tab Content */}
        <div className="card-lg animate-slideUp">
          {activeTab === 'info' && (
            // ...existing code...
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-6">
                Editar Información Personal
              </h2>

              <div>
                <label className="block">Nombre Completo</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block">Email (no editable)</label>
                <input
                  type="email"
                  value={user?.email}
                  disabled
                  className="input opacity-75 bg-gray-50"
                />
                <p className="text-xs text-[color:var(--text-muted)] mt-2">
                  Para cambiar email, contacta con soporte
                </p>
              </div>

               <div>
                 <label className="block">Teléfono *</label>
                 <div className="flex items-center gap-3">
                   <Phone size={20} className="text-primary" />
                   <input
                     type="tel"
                     name="telefono"
                     value={formData.telefono}
                     onChange={handleChange}
                     placeholder="+57..."
                     className="input flex-1"
                     required
                   />
                 </div>
               </div>

              <div>
                <label className="block">Tipo de Cuenta</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={user?.tipo_usuario === 'cliente' ? 'Cliente' : 'Restaurante'}
                    disabled
                    className="input opacity-75 bg-gray-50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[color:var(--border-default)]">
                <p className="text-sm text-[color:var(--text-muted)] mb-4">
                  Cuenta creada: {new Date(user?.creado_en).toLocaleDateString('es-CO')}
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                >
                  {loading ? (
                    <>
                      <div className="spinner spinner-sm inline mr-2"></div>
                      Guardando cambios...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'addresses' && (
            <AddressesTab />
          )}

          {activeTab === 'purchases' && (
            <PurchaseHistoryTab />
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-6">
                Cambiar Contraseña
              </h2>

              <div
                className="alert alert-info mb-6"
                style={{ borderRadius: '0.5rem' }}
              >
                <p className="text-sm">
                  Por seguridad, ingresa tu contraseña actual y la nueva contraseña para confirmar el cambio.
                </p>
              </div>

              <div>
                <label className="block">Contraseña Actual *</label>
                <input
                  type="password"
                  name="contrasena_actual"
                  value={passwordData.contrasena_actual}
                  onChange={handlePasswordChange}
                  placeholder="Ingresa tu contraseña actual"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block">Nueva Contraseña *</label>
                <input
                  type="password"
                  name="contrasena_nueva"
                  value={passwordData.contrasena_nueva}
                  onChange={handlePasswordChange}
                  placeholder="Mínimo 6 caracteres"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block">Confirmar Nueva Contraseña *</label>
                <input
                  type="password"
                  name="contrasena_confirmacion"
                  value={passwordData.contrasena_confirmacion}
                  onChange={handlePasswordChange}
                  placeholder="Repite tu nueva contraseña"
                  className="input"
                  required
                />
              </div>

              <div className="pt-4 border-t border-[color:var(--border-default)]">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                >
                  {loading ? (
                    <>
                      <div className="spinner spinner-sm inline mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    'Cambiar Contraseña'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

