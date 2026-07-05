import { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Star } from 'lucide-react';
import { restaurantService, productService } from '../services/api';

export default function RestaurantModal({ isOpen, onClose, onSave, restaurant }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    horario_apertura: '',
    horario_cierre: '',
    imagen_url: '',
    // Modalidad de servicio: true → ofrece domicilios, false → solo retiro en local.
    // Default true para mantener compatibilidad con restaurantes existentes.
    ofrece_domicilio: true,
    // Tiempo estimado de preparación en minutos (opcional). Vacío = null en la BD
    // = no se muestra el badge en RestaurantDetailsPage.
    tiempo_preparacion_minutos: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (restaurant) {
      setFormData({
        nombre: restaurant.nombre || '',
        descripcion: restaurant.descripcion || '',
        direccion: restaurant.direccion || '',
        telefono: restaurant.telefono || '',
        horario_apertura: restaurant.horario_apertura || '',
        horario_cierre: restaurant.horario_cierre || '',
        imagen_url: restaurant.imagen_url || '',
        banner_url: restaurant.banner_url || '',
        // Normalizamos 1/0/true/false a boolean (la API puede devolver 0/1).
        ofrece_domicilio: restaurant.ofrece_domicilio === undefined
          ? true
          : Boolean(Number(restaurant.ofrece_domicilio)),
        // Entero positivo o null. El input de tipo number necesita string,
        // por eso lo dejamos como string vacío si la API devuelve null/undefined.
        tiempo_preparacion_minutos: restaurant.tiempo_preparacion_minutos ?? '',
      });
      setImagePreview(restaurant.imagen_url || '');
      setBannerPreview(restaurant.banner_url || '');
      setImageFile(null);
      setBannerFile(null);
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        direccion: '',
        telefono: '',
        horario_apertura: '',
        horario_cierre: '',
        imagen_url: '',
        banner_url: '',
        ofrece_domicilio: true,
        tiempo_preparacion_minutos: '',
      });
      setImagePreview('');
      setBannerPreview('');
      setImageFile(null);
      setBannerFile(null);
    }
    setError('');
  }, [restaurant]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = () => {
    setBannerFile(null);
    setBannerPreview('');
    setFormData(prev => ({ ...prev, banner_url: '' }));
  };

  const uploadImage = async () => {
    if (!imageFile) return formData.imagen_url;

    const payload = new FormData();
    payload.append('image', imageFile);
    const response = await productService.uploadImage(payload);
    return response.data?.url || '';
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormData(prev => ({ ...prev, imagen_url: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = new FormData();

      // Agregar todos los campos del formulario al FormData
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '') {
          payload.append(key, formData[key]);
        }
      });

      // Si hay un archivo de imagen nuevo, agregarlo al FormData
      if (imageFile) {
        payload.append('imagen_url', imageFile);
      }

      // Si hay un archivo de banner nuevo, agregarlo al FormData
      if (bannerFile) {
        payload.append('banner_url', bannerFile);
      }

      await restaurantService.update(restaurant.id, payload);

      // Actualizar el estado local para reflejar los cambios
      const finalData = {
        ...formData,
        imagen_url: imageFile ? imagePreview : formData.imagen_url
      };

      onSave(finalData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar los datos del local');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)] flex-shrink-0">
          <h2 className="text-xl font-bold text-[color:var(--text-primary)]">Editar Datos del Local</h2>
          <button onClick={onClose} className="p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors">
            <X size={20} className="text-[color:var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-36 h-36 rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] flex items-center justify-center overflow-hidden group">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Imagen del local" className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Upload size={20} className="text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[color:var(--bg-muted)] transition-colors">
                    <ImageIcon size={32} className="text-[color:var(--text-subtle)] mb-2" />
                    <span className="text-xs text-[color:var(--text-muted)]">Subir imagen</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                )}
              </div>
              {(imagePreview || formData.imagen_url) && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: 'var(--danger-text)' }}
                >
                  <Trash2 size={12} /> Quitar imagen
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Nombre del Local</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Descripción</label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Dirección</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Teléfono</label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Apertura</label>
                <input
                  type="time"
                  name="horario_apertura"
                  value={formData.horario_apertura}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Cierre</label>
                <input
                  type="time"
                  name="horario_cierre"
                  value={formData.horario_cierre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Tiempo estimado de preparación (opcional). Se muestra en el header
                de RestaurantDetailsPage. Vacío = no se muestra nada al cliente. */}
            <div>
              <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">
                Tiempo estimado de preparación (minutos)
              </label>
              <input
                type="number"
                name="tiempo_preparacion_minutos"
                value={formData.tiempo_preparacion_minutos}
                onChange={handleInputChange}
                min="1"
                step="1"
                placeholder="Opcional — ej. 30"
                className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <p className="text-xs text-[color:var(--text-muted)] mt-1">
                Déjalo vacío si no querés mostrar un tiempo estimado. Se mostrará a los clientes en la página del local.
              </p>
            </div>

            {/* Modalidad de servicio: switch accesible para ofrecer o no domicilios. */}
            <div className="p-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)]/40">
              <label className="flex items-start gap-3 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.ofrece_domicilio}
                  onClick={() => setFormData(prev => ({ ...prev, ofrece_domicilio: !prev.ofrece_domicilio }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${
                    formData.ofrece_domicilio ? 'bg-primary' : 'bg-[color:var(--border-default)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.ofrece_domicilio ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[color:var(--text-primary)]">
                    Ofrece servicio a domicilio
                  </span>
                  <span className="block text-xs text-[color:var(--text-muted)] mt-0.5">
                    {formData.ofrece_domicilio
                      ? 'Los clientes pueden pedir y recibir su pedido en su domicilio.'
                      : 'Los clientes solo pueden pasar a retirar su pedido directamente en tu local.'}
                  </span>
                </div>
              </label>
            </div>

            {restaurant?.plan === 'premium' && (
              <div
              className="p-4 rounded-xl space-y-3"
              style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
            >
              <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--warning-text)' }}>
                <Star size={16} />
                Banner Promocional (exclusivo Premium)
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--warning-text)' }}>Imagen del Banner</label>
                <div
                  className="relative w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden group"
                  style={{ borderColor: 'var(--warning-border)', backgroundColor: 'var(--bg-elevated)' }}
                >
                    {bannerPreview || formData.banner_url ? (
                      <>
                        <img src={bannerPreview || formData.banner_url} alt="Banner promocional" className="w-full h-full object-cover" />
                        <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Upload size={20} className="text-white" />
                          <input type="file" className="hidden" accept="image/*" onChange={handleBannerChange} />
                        </label>
                      </>
                    ) : (
                      <label
                        className="flex flex-col items-center justify-center w-full h-full cursor-pointer transition-colors"
                        style={{ color: 'var(--warning-text)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--warning-bg)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <ImageIcon size={32} style={{ color: 'var(--warning-text)', opacity: 0.7 }} className="mb-2" />
                        <span className="text-xs font-medium" style={{ color: 'var(--warning-text)' }}>Subir banner</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleBannerChange} />
                      </label>
                    )}
                  </div>
                  {(bannerPreview || formData.banner_url) && (
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="mt-2 text-xs hover:underline flex items-center gap-1"
                      style={{ color: 'var(--danger-text)' }}
                    >
                      <Trash2 size={12} /> Quitar banner
                    </button>
                  )}
                  <p
                    className="text-[10px] mt-2 flex items-center gap-1"
                    style={{ color: 'var(--warning-text)', opacity: 0.8 }}
                  >
                    <ImageIcon size={10} />
                    Tamaño recomendado: <span className="font-semibold">1920x600 px</span> (proporción 16:5)
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--warning-text)', opacity: 0.8 }}>Aparecerá en la página de inicio (carousel principal).</p>
                </div>
              </div>
            )}

            {restaurant?.plan === 'profesional' && (
              <div className="p-4 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm text-[color:var(--text-secondary)]">
                <p className="font-semibold text-[color:var(--text-secondary)]">💡 Sube a Premium</p>
                <p>El banner promocional en la página de inicio es exclusivo del plan Premium.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primaryDark transition-all disabled:opacity-50"
            >
              {saving || uploading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
