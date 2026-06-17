import { useState, useEffect } from 'react';
import { Palette, Type, Layout, Image as ImageIcon, Save, Eye, CheckCircle, Upload, Trash2 } from 'lucide-react';
import { restaurantService, productService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { Star, MapPin, Clock, Phone } from 'lucide-react';
import Loading from './Loading';

const FONT_OPTIONS = [
  { id: 'Inter', label: 'Inter (Modern)', value: 'Inter' },
  { id: 'PlusJakarta', label: 'Plus Jakarta Sans (Bold)', value: 'Plus Jakarta Sans' },
  { id: 'Playfair', label: 'Playfair Display (Elegant)', value: 'Playfair Display' },
];

const RADIUS_OPTIONS = [
  { id: 'small', label: 'Small (4px)', value: '4px' },
  { id: 'medium', label: 'Medium (12px)', value: '12px' },
  { id: 'large', label: 'Large (24px)', value: '24px' },
];

function RestaurantPreview({ restaurant, config }) {
  const radiusValue = config.borderRadius === 'small' ? '4px' : config.borderRadius === 'large' ? '24px' : '12px';

  const dynamicStyles = {
    '--color-primary': config.primaryColor || '#FF6B00',
    '--color-secondary': config.secondaryColor || '#FFAE73',
    '--font-family': config.fontFamily || 'Inter',
    '--border-radius': radiusValue,
  };

  return (
    <div
      className="bg-light min-h-full w-full overflow-y-auto scale-75 origin-top"
      style={dynamicStyles}
    >
      {/* Simulated Hero Section */}
      <div className="relative h-48 bg-gradient-warm overflow-hidden">
        {restaurant.imagen_url ? (
          <img src={getImageUrl(restaurant.imagen_url)} alt={restaurant.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary flex items-center justify-center text-white text-4xl">🍽️</div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-30" />
      </div>

      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl p-6 shadow-lg" style={{ borderRadius: 'var(--border-radius)' }}>
          {/* Custom Logo Integration */}
          {config.logoUrl && (
            <div className="flex justify-center mb-4">
              <img
                src={getImageUrl(config.logoUrl)}
                alt="Restaurant Logo"
                className="max-h-20 w-auto object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-family)', color: 'var(--color-primary)' }}>
            {restaurant.nombre}
          </h1>
          <p className="text-gray-600 text-sm mb-4">{restaurant.descripcion}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Star size={14} style={{ color: 'var(--color-primary)' }} />
              <span>{restaurant.calificacion || '5.0'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
              <span>{restaurant.ciudad}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 mt-6">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-family)', color: 'var(--color-primary)' }}>Menú de Ejemplo</h2>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100" style={{ borderRadius: 'var(--border-radius)' }}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-bold text-dark">Producto de Ejemplo {i}</p>
                  <p className="text-xs text-gray-500">Descripción corta del producto para previsualizar el estilo.</p>
                </div>
                <p className="font-bold text-primary" style={{ color: 'var(--color-primary)' }}>$15.00</p>
              </div>
              <button
                className="w-full mt-3 py-2 text-white font-bold text-sm transition-all"
                style={{ backgroundColor: 'var(--color-primary)', borderRadius: 'calc(var(--border-radius) / 2)' }}
              >
                Agregar al pedido
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PageBuilder({ restaurant, onSave, onUpdate }) {
  const [config, setConfig] = useState({
    primaryColor: '#FF6B00',
    secondaryColor: '#FFAE73',
    fontFamily: 'Inter',
    borderRadius: 'medium',
    logoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    if (restaurant?.custom_config) {
      setConfig(restaurant.custom_config);
      setLogoPreview(restaurant.custom_config.logoUrl || '');
    }
  }, [restaurant]);

  const handleChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    if (onUpdate) onUpdate(newConfig);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    handleChange('logoUrl', '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = config.logoUrl;

      // If a new logo file was selected, upload it first
      if (logoFile) {
        const payload = new FormData();
        payload.append('image', logoFile);
        const uploadRes = await productService.uploadImage(payload);
        finalLogoUrl = uploadRes.data?.url || uploadRes.data || '';
      }

      const finalConfig = { ...config, logoUrl: finalLogoUrl };

      await restaurantService.update(restaurant.id, { custom_config: finalConfig });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Controls Side */}
      <div className="lg:w-1/3 space-y-6">
        <div className="card-lg space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Palette size={20} />
            </div>
            <h2 className="text-2xl font-bold text-dark">Personalización de Marca</h2>
          </div>

          <div className="space-y-4">
            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Color Primario</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer bg-white border border-gray-200"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg uppercase font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Color Secundario</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer bg-white border border-gray-200"
                  />
                  <input
                    type="text"
                    value={config.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Type size={14} /> Tipografía
              </label>
              <select
                value={config.fontFamily}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              >
                {FONT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Border Radius */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Layout size={14} /> Redondez de Bordes
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RADIUS_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleChange('borderRadius', opt.id)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      config.borderRadius === opt.id
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <ImageIcon size={14} /> Logo Personalizado (PNG, JPG, SVG)
              </label>
              <div className="text-[10px] text-gray-400 mb-1 italic">
                Dimensión recomendada: 500x200px o proporción similar
              </div>
              <div className="relative group">
                <div className={`relative w-full h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden transition-all ${logoPreview ? 'border-primary' : ''}`}>
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Upload size={20} className="text-white" />
                        <input type="file" className="hidden" accept="image/*,image/svg+xml" onChange={handleLogoChange} />
                      </label>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-100 transition-colors">
                      <Upload size={24} className="text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500 font-medium">Subir logo</span>
                      <input type="file" className="hidden" accept="image/*,image/svg+xml" onChange={handleLogoChange} />
                    </label>
                  )}
                </div>
                {(logoPreview || config.logoUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-sm border border-gray-200 text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400 italic">
              Los cambios se aplican en tiempo real a la vista previa.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-small inline-flex items-center gap-2 px-6"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Side */}
      <div className="lg:flex-1 bg-gray-200 rounded-3xl overflow-hidden shadow-inner relative border-8 border-gray-300">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white px-4 py-1 rounded-full text-[10px] font-bold text-gray-400 uppercase shadow-sm border border-gray-100 flex items-center gap-2">
          <Eye size={12} /> Vista Previa del Cliente
        </div>
        <div className="h-[700px] overflow-y-auto">
          <RestaurantPreview restaurant={restaurant} config={config} />
        </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-slideUp flex items-center gap-3 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl font-bold">
          <CheckCircle size={20} />
          Configuración guardada con éxito
        </div>
      )}
    </div>
  );
}
