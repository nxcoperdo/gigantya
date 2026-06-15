import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, CheckCircle, Edit2 } from 'lucide-react';
import { addressService } from '../services/api';

export default function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    tipo: 'residencia',
    direccion: '',
    ciudad: 'GigantYA, Huila',
    telefono: '',
    notas: '',
    es_default: false,
  });

  // Cargar direcciones
  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const res = await addressService.getAll();
      setAddresses(res.data.addresses || []);
      setError('');
    } catch (err) {
      setError('Error cargando direcciones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.direccion.trim()) {
      setError('La dirección es requerida');
      return;
    }

    try {
      setLoading(true);
      
      if (editingId) {
        await addressService.update(editingId, formData);
        setSuccess('Dirección actualizada exitosamente');
      } else {
        await addressService.create(formData);
        setSuccess('Dirección agregada exitosamente');
      }

      setFormData({
        tipo: 'residencia',
        direccion: '',
        ciudad: 'GigantYA, Huila',
        telefono: '',
        notas: '',
        es_default: false,
      });
      setShowForm(false);
      setEditingId(null);
      setError('');
      
      await loadAddresses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando dirección');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address) => {
    setFormData({
      tipo: address.tipo,
      direccion: address.direccion,
      ciudad: address.ciudad,
      telefono: address.telefono || '',
      notas: address.notas || '',
      es_default: address.es_default === 1,
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta dirección?')) return;

    try {
      setLoading(true);
      await addressService.delete(id);
      setSuccess('Dirección eliminada exitosamente');
      setError('');
      await loadAddresses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error eliminando dirección');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      setLoading(true);
      await addressService.setDefault(id);
      setSuccess('Dirección establecida como predeterminada');
      setError('');
      await loadAddresses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al establecer dirección predeterminada');
    } finally {
      setLoading(false);
    }
  };

  if (loading && addresses.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-dark mb-6 flex items-center gap-2">
        <MapPin className="text-primary" size={24} />
        Mis Direcciones
      </h2>

      {error && (
        <div className="alert alert-error animate-slideDown">
          ✕ {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success animate-slideDown">
          ✓ {success}
        </div>
      )}

      {/* Botón agregar */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Agregar Nueva Dirección
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="card-lg bg-gradient-light border border-primary border-opacity-20">
          <h3 className="text-xl font-bold text-dark mb-4">
            {editingId ? 'Editar Dirección' : 'Nueva Dirección'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Tipo</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="residencia">Residencia</option>
                  <option value="trabajo">Trabajo</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Teléfono</label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+57..."
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Dirección *</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Calle 5 #12-45, Apto 301"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Ciudad</label>
              <input
                type="text"
                name="ciudad"
                value={formData.ciudad}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Notas (opcional)</label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                placeholder="Ej: Portón rojo, segundo piso"
                rows="3"
                className="input"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="es_default"
                checked={formData.es_default}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Establecer como dirección predeterminada</span>
            </label>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {editingId ? 'Actualizar' : 'Guardar'} Dirección
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    tipo: 'residencia',
                    direccion: '',
                    ciudad: 'GigantYA, Huila',
                    telefono: '',
                    notas: '',
                    es_default: false,
                  });
                }}
                className="btn btn-outline"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de direcciones */}
      <div className="space-y-3">
        {addresses.length === 0 ? (
          <div className="text-center py-12 bg-light rounded-lg">
            <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No tienes direcciones guardadas</p>
            <p className="text-sm text-gray-500 mt-2">Agrega una dirección para facilitar tus compras</p>
          </div>
        ) : (
          addresses.map(address => (
            <div
              key={address.id}
              className={`card-lg border-2 transition-all ${
                address.es_default === 1
                  ? 'border-primary bg-gradient-light'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-block px-3 py-1 bg-primary bg-opacity-10 text-primary rounded-full text-xs font-semibold capitalize">
                      {address.tipo}
                    </span>
                    {address.es_default === 1 && (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                        <CheckCircle size={14} />
                        Predeterminada
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-dark mb-1">{address.direccion}</p>
                  <p className="text-sm text-gray-600">{address.ciudad}</p>
                  {address.telefono && (
                    <p className="text-sm text-gray-600">📞 {address.telefono}</p>
                  )}
                  {address.notas && (
                    <p className="text-sm text-gray-500 italic mt-2">💬 {address.notas}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(address)}
                    className="btn btn-ghost p-2 hover:bg-primary hover:bg-opacity-10"
                    title="Editar"
                  >
                    <Edit2 size={18} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="btn btn-ghost p-2 hover:bg-red-100"
                    title="Eliminar"
                  >
                    <Trash2 size={18} className="text-red-500" />
                  </button>
                  {address.es_default !== 1 && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="btn btn-outline text-xs"
                    >
                      Establecer como predeterminada
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

