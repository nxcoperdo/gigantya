import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Sparkles } from 'lucide-react';
import { productService, categoryService, authService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { getCategoryIcon } from '../utils/categoryIcons';

const PLAN_LIMITS = { basico: 1, profesional: 5, premium: 5 };

export default function ProductModal({ isOpen, onClose, onSave, product = null, restaurantId, restaurante }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
    imagen_url: '',
    disponible: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  // Galería de fotos (plan Profesional/Premium)
  const [gallery, setGallery] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [plan, setPlan] = useState('basico');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoryService.getAll();
        const all = res.data.categorias || [];
        // Filtrar categorías por el/los namespace(s) del local. El admin
        // puede combinar flags ("restaurante + comida rápida"), así que el
        // conjunto de namespaces visibles no es único.
        //   - Local mercado: solo categorías de tipo 'mercado' (mercado
        //     sigue siendo nicho excluyente).
        //   - Local combo (es_restaurante=1, es_comida_rapida=1): ambos
        //     namespaces, para que el admin pueda elegir dónde catalogar
        //     cada producto.
        //   - Local solo comida rápida: solo categorías 'comida_rapida'.
        //   - Local solo restaurante: solo categorías 'restaurante'.
        // Si el modal se usa sin restaurante (ej. admin sin contexto), no
        // filtramos.
        let tiposVisibles;
        if (!restaurante) {
          tiposVisibles = null; // null = sin filtro
        } else if (restaurante.es_mercado_abarrotes) {
          tiposVisibles = ['mercado'];
        } else if (restaurante.es_restaurante && restaurante.es_comida_rapida) {
          // Combo restaurante + comida rápida: mostrar ambos catálogos.
          tiposVisibles = ['restaurante', 'comida_rapida'];
        } else if (restaurante.es_comida_rapida) {
          tiposVisibles = ['comida_rapida'];
        } else {
          tiposVisibles = ['restaurante'];
        }
        const filtradas = tiposVisibles
          ? all.filter(c => tiposVisibles.includes(c.tipo_negocio || 'restaurante'))
          : all;
        // Orden alfabético A→Z para que el <select> sea fácil de navegar.
        filtradas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
        setCategories(filtradas);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    const fetchRestaurantPlan = async () => {
      try {
        const res = await authService.getProfile();
        const p = res.data?.usuario?.restaurante?.plan || 'basico';
        setPlan(p);
      } catch (e) {
        // Sin auth de restaurante (ej. admin creando producto) → basico
        setPlan('basico');
      }
    };
    fetchCategories();
    fetchRestaurantPlan();
  }, [restaurante]);

  useEffect(() => {
    if (product) {
      setFormData({
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        precio: product.precio || '',
        categoria_id: product.categoria_id || '',
        imagen_url: product.imagen_url || '',
        disponible: product.disponible === 1 || product.disponible === true,
      });
      setImagePreview(product.imagen_url ? getImageUrl(product.imagen_url) : '');
      loadGallery(product.id);
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        precio: '',
        categoria_id: '',
        imagen_url: '',
        disponible: true,
      });
      setImagePreview('');
      setGallery([]);
    }
    setGalleryFiles([]);
    setError('');
  }, [product]);

  const loadGallery = async (productId) => {
    if (!productId) return;
    try {
      const res = await productService.getGallery(productId);
      setGallery(res.data?.imagenes || []);
    } catch (e) {
      setGallery([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles(files);
  };

  const uploadImage = async () => {
    if (!imageFile) return '';

    const formDataPayload = new FormData();
    formDataPayload.append('image', imageFile);

    try {
      const response = await productService.uploadImage(formDataPayload);
      return response.data.url;
    } catch (err) {
      throw new Error('Error al subir la imagen');
    }
  };

  const uploadGallery = async (productoId) => {
    if (!galleryFiles.length) return;
    const fd = new FormData();
    fd.append('producto_id', productoId);
    galleryFiles.forEach((f) => fd.append('images', f));
    setGalleryUploading(true);
    try {
      await productService.uploadGallery(productoId, fd);
      setGalleryFiles([]);
      await loadGallery(productoId);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir la galería');
    } finally {
      setGalleryUploading(false);
    }
  };

  const deleteGalleryImage = async (imagenId) => {
    if (!product?.id) return;
    if (!window.confirm('¿Eliminar esta imagen de la galería?')) return;
    try {
      await productService.deleteGalleryImage(product.id, imagenId);
      await loadGallery(product.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la imagen');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let finalImageUrl = formData.imagen_url;
      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadImage();
        setUploading(false);
      }

      const dataToSave = {
        ...formData,
        // El <select> devuelve '' cuando el usuario no eligió categoría.
        // La columna categoria_id en DB es INT, no acepta string vacío.
        // Mapeamos a null para que el server guarde "sin categoría" en vez de crashear.
        categoria_id: formData.categoria_id === '' ? null : formData.categoria_id,
        precio: parseFloat(formData.precio),
        imagen_url: finalImageUrl,
        disponible: formData.disponible,
      };

      let productoId = product?.id;
      if (productoId) {
        await productService.update(productoId, dataToSave);
      } else {
        const res = await productService.create(dataToSave);
        productoId = res.data?.producto_id;
      }

      // Si hay archivos pendientes en la galería, subirlos tras guardar
      if (galleryFiles.length > 0 && productoId) {
        await uploadGallery(productoId);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const galleryLimit = PLAN_LIMITS[plan] || 1;
  const gallerySlotsRemaining = Math.max(0, galleryLimit - gallery.length - galleryFiles.length);
  const allowGallery = plan === 'profesional' || plan === 'premium';

  if (!isOpen) return null;

  // Cerrar al hacer click en el backdrop (no en el modal en sí)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)] flex-shrink-0">
          <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
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
            {/* Imagen Upload */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] flex items-center justify-center overflow-hidden group"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Upload size={20} className="text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[color:var(--bg-muted)] transition-colors">
                    <ImageIcon size={32} className="text-[color:var(--text-subtle)] mb-2" />
                    <span className="text-xs text-[color:var(--text-muted)]">Sube una foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                )}
              </div>
              {imageFile && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(formData.imagen_url ? getImageUrl(formData.imagen_url) : ''); }}
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: 'var(--danger-text)' }}
                >
                  <Trash2 size={12} /> Eliminar imagen
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Nombre del producto</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="Ej. Hamburguesa Especial"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Precio ($)</label>
                  <input
                    type="number"
                    name="precio"
                    value={formData.precio}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                    step="0.01"
                    required
                />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Categoría</label>
                  <select
                    name="categoria_id"
                    value={formData.categoria_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="">Seleccione una categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                  {formData.categoria_id && (() => {
                    const cat = categories.find(c => String(c.id) === String(formData.categoria_id));
                    if (!cat) return null;
                    const Icon = getCategoryIcon(cat.nombre);
                    return (
                      <div className="flex items-center gap-2 mt-1.5 px-2 py-1 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                        <Icon size={14} className="text-primary flex-shrink-0" />
                        <span className="text-xs text-[color:var(--text-secondary)]">{cat.nombre}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="Describe los ingredientes o detalles..."
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                <input
                  type="checkbox"
                  name="disponible"
                  checked={formData.disponible}
                  onChange={(e) => setFormData(prev => ({ ...prev, disponible: e.target.checked }))}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-medium text-[color:var(--text-secondary)]">Producto disponible para la venta</span>
              </div>
            </div>

            {/* Galería (plan Profesional/Premium) */}
            <div className="border-t border-[color:var(--border-subtle)] pt-4">
              {allowGallery ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      Galería de fotos
                    </p>
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {gallery.length} / {galleryLimit}
                    </span>
                  </div>

                  {gallery.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {gallery.map((img) => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square">
                          <img src={getImageUrl(img.imagen_url)} alt="galería" className="w-full h-full object-cover" />
                          {product?.id && (
                            <button
                              type="button"
                              onClick={() => deleteGalleryImage(img.id)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {gallerySlotsRemaining > 0 && (
                    <div>
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[color:var(--border-default)] rounded-lg cursor-pointer hover:bg-[color:var(--bg-subtle)] transition-colors">
                        <Upload size={20} className="text-[color:var(--text-subtle)] mb-1" />
                        <span className="text-xs text-[color:var(--text-muted)]">
                          Subir hasta {gallerySlotsRemaining} imagen(es) más
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryChange}
                        />
                      </label>
                      {galleryFiles.length > 0 && (
                        <p className="text-xs text-primary mt-1">
                          {galleryFiles.length} archivo(s) listo(s) — se subirán al guardar el producto
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-xs text-[color:var(--text-muted)] flex items-start gap-2">
                  <Sparkles size={14} className="text-[color:var(--text-subtle)] flex-shrink-0 mt-0.5" />
                  <span>La galería de fotos está disponible en los planes Profesional y Premium.</span>
                </div>
              )}
            </div>
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
              disabled={saving || uploading || galleryUploading}
              className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primaryDark transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving || uploading || galleryUploading ? 'Guardando...' : product ? 'Actualizar' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
