import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, CheckCircle, Edit2, ExternalLink } from 'lucide-react';
import { addressService, zonaService } from '../services/api';
// Sin AddressAutocomplete: el usuario escribe la dirección como texto libre.
// El restaurante la geocodifica en el iframe de embed de Google Maps
// (AddressMapPreview.jsx hace fallback por texto cuando no hay coords).

export default function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [barriosBySector, setBarriosBySector] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingSectores, setLoadingSectores] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    tipo: 'residencia',
    direccion: '',
    ciudad: 'Gigante, Huila',
    telefono: '',
    notas: '',
    es_default: false,
    sector_id: '',
    barrio_id: '',
  });

  // Cargar direcciones y sectores al montar
  useEffect(() => {
    loadAddresses();
    loadSectores();
  }, []);

  // FIX: cuando el usuario cambia el sector en el form, hay que cargar
  // los barrios de ese sector. Antes esto solo se hacía en `handleEdit`
  // (precarga para editar), pero al crear o cambiar de sector después
  // de tener uno seleccionado, el <select> de barrio quedaba vacío.
  //
  // Se dispara también en mount (con sector_id = ''), pero `loadBarrios`
  // ya tiene un guard `if (!sectorId) return []` así que es no-op.
  useEffect(() => {
    if (formData.sector_id) {
      loadBarrios(formData.sector_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.sector_id]);

  const loadSectores = async () => {
    try {
      setLoadingSectores(true);
      const res = await zonaService.getSectores();
      setSectores(res.data.sectores || []);
    } catch (err) {
      console.error('Error cargando sectores:', err);
    } finally {
      setLoadingSectores(false);
    }
  };

  const loadBarrios = async (sectorId) => {
    if (!sectorId) return [];
    // Normalizar a string para mantener una sola clave consistente con `formData.sector_id`
    const key = String(sectorId);
    if (barriosBySector[key]) return barriosBySector[key];
    try {
      const res = await zonaService.getBarrios(key);
      const barrios = res.data.barrios || [];
      setBarriosBySector(prev => ({ ...prev, [key]: barrios }));
      return barrios;
    } catch (err) {
      console.error('Error cargando barrios:', err);
      return [];
    }
  };

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
    setFormData(prev => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      // Si cambia el sector, limpiamos el barrio para evitar IDs huérfanos
      if (name === 'sector_id') {
        next.barrio_id = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.direccion.trim()) {
      setError('La dirección es requerida');
      return;
    }

    try {
      setLoading(true);

      // El backend solo persiste barrio_id; sector_id NO se guarda en
      // la dirección (se resuelve por JOIN con barrios.sector_id al
      // leer). Lo omitimos del payload para no confundir.
      const payload = {
        ...formData,
        barrio_id: formData.barrio_id ? Number(formData.barrio_id) : null,
        sector_id: undefined, // explícitamente removido
      };
      delete payload.sector_id;

      if (editingId) {
        await addressService.update(editingId, payload);
        setSuccess('Dirección actualizada exitosamente');
      } else {
        await addressService.create(payload);
        setSuccess('Dirección agregada exitosamente');
      }

      setFormData({
        tipo: 'residencia',
        direccion: '',
        ciudad: 'Gigante, Huila',
        telefono: '',
        notas: '',
        es_default: false,
        sector_id: '',
        barrio_id: '',
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

  const handleEdit = async (address) => {
    setFormData({
      tipo: address.tipo,
      direccion: address.direccion,
      ciudad: address.ciudad,
      telefono: address.telefono || '',
      notas: address.notas || '',
      es_default: address.es_default === 1,
      sector_id: address.sector_id ? String(address.sector_id) : '',
      barrio_id: address.barrio_id ? String(address.barrio_id) : '',
    });
    setEditingId(address.id);
    setShowForm(true);
    // Si el sector viene con barrio, precargar la lista (usar string como clave)
    if (address.sector_id) {
      await loadBarrios(String(address.sector_id));
    }
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

  const barriosDelSectorSeleccionado = formData.sector_id
    ? (barriosBySector[formData.sector_id] || [])
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-6 flex items-center gap-2">
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
          <h3 className="text-xl font-bold text-[color:var(--text-primary)] mb-4">
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
              <label className="block text-sm font-semibold mb-2">Dirección (calle/carrera/número) *</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Calle 5 #12-45"
                className="input"
                autoComplete="street-address"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Sector *</label>
                <select
                  name="sector_id"
                  value={formData.sector_id}
                  onChange={handleChange}
                  className="input"
                  required
                  disabled={loadingSectores}
                >
                  <option value="">
                    {loadingSectores ? 'Cargando sectores…' : 'Selecciona un sector'}
                  </option>
                  {sectores.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Barrio *</label>
                <select
                  name="barrio_id"
                  value={formData.barrio_id}
                  onChange={handleChange}
                  className="input"
                  required
                  disabled={!formData.sector_id}
                >
                  <option value="">
                    {formData.sector_id ? 'Selecciona un barrio' : 'Primero selecciona un sector'}
                  </option>
                  {barriosDelSectorSeleccionado.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
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
                className="w-4 h-4 rounded border-[color:var(--border-default)]"
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
                    ciudad: 'Gigante, Huila',
                    telefono: '',
                    notas: '',
                    es_default: false,
                    sector_id: '',
                    barrio_id: '',
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
          <div className="text-center py-12 bg-[color:var(--bg-subtle)] rounded-lg">
            <MapPin className="w-16 h-16 mx-auto text-[color:var(--text-subtle)] mb-4" />
            <p className="text-[color:var(--text-secondary)]">No tienes direcciones guardadas</p>
            <p className="text-sm text-[color:var(--text-muted)] mt-2">Agrega una dirección para facilitar tus compras</p>
          </div>
        ) : (
          addresses.map(address => (
            <div
              key={address.id}
              className={`card-lg border-2 transition-all ${
                address.es_default === 1
                  ? 'border-primary bg-gradient-light'
                  : 'border-[color:var(--border-default)]'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-block px-3 py-1 bg-primary bg-opacity-10 text-primary rounded-full text-xs font-semibold capitalize">
                      {address.tipo}
                    </span>
                    {address.es_default === 1 && (
                      <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                      style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}
                    >
                      <CheckCircle size={14} />
                      Predeterminada
                    </span>
                    )}
                    {address.sector_nombre && (
                      <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                    >
                      📍 {address.sector_nombre}
                      {address.barrio_nombre ? ` · ${address.barrio_nombre}` : ''}
                    </span>
                    )}
                  </div>

                  <p className="font-semibold text-[color:var(--text-primary)] mb-1">{address.direccion}</p>
                  {address.direccion_formateada && address.direccion_formateada !== address.direccion && (
                    <p className="text-xs text-[color:var(--text-muted)] mb-1 italic">
                      {address.direccion_formateada}
                    </p>
                  )}
                  <p className="text-sm text-[color:var(--text-secondary)]">{address.ciudad}</p>
                  {address.telefono && (
                    <p className="text-sm text-[color:var(--text-secondary)]">📞 {address.telefono}</p>
                  )}
                  {address.notas && (
                    <p className="text-sm text-[color:var(--text-muted)] italic mt-2">💬 {address.notas}</p>
                  )}
                  {address.latitud !== null && address.latitud !== undefined && address.longitud !== null && address.longitud !== undefined && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${address.latitud},${address.longitud}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                      <ExternalLink size={12} />
                      Ver en Google Maps
                    </a>
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
                    className="btn btn-ghost p-2"
                    style={{ color: 'var(--danger-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
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