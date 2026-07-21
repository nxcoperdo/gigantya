/**
 * Modal admin: detalle y edición de un local.
 *
 * Replica el `RestaurantModal` del dueño pero con dos diferencias:
 *   1. Llama a `adminService.updateRestaurantAdmin` (endpoint admin)
 *      en lugar de `restaurantService.update` (endpoint del dueño).
 *   2. Muestra en modo lectura los datos que el admin NO puede
 *      editar (plan, fecha_vencimiento_plan, estado, aprobado,
 *      calificacion) — para que el admin entienda qué está pasando
 *      con ese local sin tener que ir a otra pantalla.
 *
 * La subida de archivos soporta imagen_url y banner_url. El admin
 * puede subir a cualquier local, sin importar el plan. Si el plan
 * no habilita `banner_home`, el banner queda "latente" en BD hasta
 * que el local upgradee (el gate de la home lo filtra).
 *
 * UX: un solo botón "Guardar cambios" manda el submit con todos los
 * campos modificados + los archivos nuevos. Barra de progreso
 * mientras se sube (mismo patrón que el upload del CMS Home).
 */
import { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { adminService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';

const PLAN_LABELS = {
  free: 'Free',
  basico: 'Básico',
  profesional: 'Profesional',
  premium: 'Premium',
  golden_plus: 'Golden Plus',
};

const ESTADO_LABELS = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  rechazado: 'Rechazado',
  pendiente: 'Pendiente',
};

export default function AdminRestaurantDetailModal({ restaurantId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Datos crudos del local (los que el admin puede editar)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    horario_apertura: '',
    horario_cierre: '',
    tiempo_preparacion_minutos: '',
    ofrece_domicilio: true,
    ofrece_consumo_en_local: false,
  });

  // Datos en modo lectura (los que el admin NO puede tocar)
  const [infoActual, setInfoActual] = useState({
    id: null,
    plan: '',
    estado: '',
    aprobado: false,
    calificacion: null,
    fecha_vencimiento_plan: null,
    created_at: null,
  });

  // Archivos nuevos a subir
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Progreso del upload
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    // Usamos el mismo endpoint que el modal de detalle de usuario usa
    // para un local. Si no existe, caemos a getRestaurants y filtramos.
    adminService.getRestaurants()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.restaurantes || res.data || [];
        const found = list.find(r => Number(r.id) === Number(restaurantId));
        if (!found) {
          setError('No se encontró el local.');
          return;
        }
        populateFromRestaurant(found);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Error cargando el local.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function populateFromRestaurant(r) {
    setInfoActual({
      id: r.id,
      plan: r.plan || '',
      estado: r.estado || '',
      aprobado: Boolean(Number(r.aprobado)),
      calificacion: r.calificacion ?? null,
      fecha_vencimiento_plan: r.fecha_vencimiento_plan || null,
      created_at: r.creado_en || r.created_at || null,
    });
    setFormData({
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      direccion: r.direccion || '',
      telefono: r.telefono || '',
      horario_apertura: r.horario_apertura || '',
      horario_cierre: r.horario_cierre || '',
      tiempo_preparacion_minutos: r.tiempo_preparacion_minutos ?? '',
      ofrece_domicilio: r.ofrece_domicilio === undefined ? true : Boolean(Number(r.ofrece_domicilio)),
      ofrece_consumo_en_local: Boolean(Number(r.ofrece_consumo_en_local)),
    });
    setImagenUrl(r.imagen_url || '');
    setBannerUrl(r.banner_url || '');
    setImagenPreview(r.imagen_url || '');
    setBannerPreview(r.banner_url || '');
    setImagenFile(null);
    setBannerFile(null);
    setUploadProgress(null);
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name) => {
    setFormData(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImagen = () => {
    setImagenFile(null);
    setImagenPreview('');
    // NO borramos imagenUrl de BD — eso requiere otro endpoint. Solo
    // permitimos reemplazar, no eliminar.
  };

  const handleRemoveBanner = () => {
    setBannerFile(null);
    setBannerPreview('');
    // Mismo principio: solo reemplazar, no eliminar.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setUploadProgress(null);

    try {
      const payload = new FormData();

      // Solo mandar campos que tienen valor (string no vacío, o boolean)
      Object.keys(formData).forEach((key) => {
        const v = formData[key];
        if (v === '' || v === null || v === undefined) return;
        // Para booleanos mandamos 'true'/'false' para que el backend
        // los parsee correctamente. Multer recibe todo como string.
        if (typeof v === 'boolean') {
          payload.append(key, v ? 'true' : 'false');
        } else {
          payload.append(key, v);
        }
      });

      if (imagenFile) {
        payload.append('imagen_url', imagenFile);
      }
      if (bannerFile) {
        payload.append('banner_url', bannerFile);
      }

      await adminService.updateRestaurantAdmin(
        restaurantId,
        payload,
        (percent, loaded, total) => {
          setUploadProgress({ percent, loaded, total });
        }
      );

      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (!restaurantId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)] flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
              Detalle y edición del local
            </h2>
            {infoActual.id && (
              <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                ID #{infoActual.id} · {infoActual.nombre || '(sin nombre)'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} className="text-[color:var(--text-muted)]" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="alert alert-error flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Sección: información en modo lectura */}
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
              <InfoItem label="Plan" value={PLAN_LABELS[infoActual.plan] || infoActual.plan || '—'} />
              <InfoItem label="Estado" value={ESTADO_LABELS[infoActual.estado] || infoActual.estado || '—'} />
              <InfoItem label="Aprobado" value={infoActual.aprobado ? 'Sí' : 'No'} />
              <InfoItem label="Calificación" value={infoActual.calificacion != null ? Number(infoActual.calificacion).toFixed(2) : '—'} />
              <InfoItem label="Vence plan" value={infoActual.fecha_vencimiento_plan ? new Date(infoActual.fecha_vencimiento_plan).toLocaleDateString('es-CO') : 'Sin vencimiento'} />
              <InfoItem label="Creado" value={infoActual.created_at ? new Date(infoActual.created_at).toLocaleDateString('es-CO') : '—'} />
            </section>

            {/* Imagen del local (subir/reemplazar) */}
            <ImageDropZone
              label="Imagen del local"
              preview={imagenPreview}
              currentUrl={imagenUrl}
              onChange={(e) => handleFileChange(e, setImagenFile, setImagenPreview)}
              onRemove={handleRemoveImagen}
            />

            {/* Banner Premium (subir/reemplazar) — admin puede a cualquier plan */}
            <div
              className="p-4 rounded-xl space-y-3"
              style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
            >
              <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--warning-text)' }}>
                <Star size={16} />
                Banner Promocional
                <span
                  className="text-[10px] font-normal px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--warning-border)', color: 'var(--warning-text)' }}
                >
                  (Carrusel "Destacados" del home)
                </span>
              </div>
              <div
                className="relative w-full h-36 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden group"
                style={{ borderColor: 'var(--warning-border)', backgroundColor: 'var(--bg-elevated)' }}
              >
                {bannerPreview || bannerUrl ? (
                  <>
                    <img
                      src={bannerPreview || getImageUrl(bannerUrl)}
                      alt="Banner del local"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Upload size={20} className="text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setBannerFile, setBannerPreview)} />
                    </label>
                  </>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
                    style={{ color: 'var(--warning-text)' }}
                  >
                    <ImageIcon size={32} style={{ color: 'var(--warning-text)', opacity: 0.7 }} className="mb-2" />
                    <span className="text-xs font-medium" style={{ color: 'var(--warning-text)' }}>Subir banner</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setBannerFile, setBannerPreview)} />
                  </label>
                )}
              </div>
              {(bannerPreview || bannerUrl) && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: 'var(--danger-text)' }}
                >
                  <Trash2 size={12} /> Quitar selección
                </button>
              )}
              <p className="text-[10px]" style={{ color: 'var(--warning-text)', opacity: 0.8 }}>
                Tamaño recomendado: 1920x600 px (proporción 16:5). Si el local no tiene plan Premium+, queda guardado pero no se muestra.
              </p>
            </div>

            {/* Campos de texto */}
            <Field label="Nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required />
            <Field label="Descripción" name="descripcion" value={formData.descripcion} onChange={handleInputChange} textarea />
            <Field label="Dirección" name="direccion" value={formData.direccion} onChange={handleInputChange} required />
            <Field label="Teléfono" name="telefono" value={formData.telefono} onChange={handleInputChange} required />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Apertura" name="horario_apertura" type="time" value={formData.horario_apertura} onChange={handleInputChange} />
              <Field label="Cierre" name="horario_cierre" type="time" value={formData.horario_cierre} onChange={handleInputChange} />
            </div>

            <Field
              label="Tiempo estimado de preparación (minutos)"
              name="tiempo_preparacion_minutos"
              type="number"
              value={formData.tiempo_preparacion_minutos}
              onChange={handleInputChange}
              placeholder="Opcional"
            />

            {/* Toggles de modalidad */}
            <Switch
              checked={formData.ofrece_domicilio}
              onChange={() => handleToggle('ofrece_domicilio')}
              title="Ofrece servicio a domicilio"
              description={formData.ofrece_domicilio
                ? 'Los clientes pueden pedir y recibir su pedido en su domicilio.'
                : 'Los clientes solo pueden pasar a retirar su pedido directamente en el local.'}
            />
            <Switch
              checked={formData.ofrece_consumo_en_local}
              onChange={() => handleToggle('ofrece_consumo_en_local')}
              title="Permite consumo en el local"
              description={formData.ofrece_consumo_en_local
                ? 'Los clientes pueden elegir "Consumo en el local" en el checkout.'
                : 'El botón "Consumo en el local" aparece deshabilitado en el checkout.'}
            />

            {/* Barra de progreso del upload */}
            {uploadProgress && (imagenFile || bannerFile) && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[color:var(--text-muted)]">
                  <span>Subiendo archivos…</span>
                  <span>
                    {uploadProgress.percent >= 0
                      ? `${uploadProgress.percent}%`
                      : 'indeterminado'}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden bg-[color:var(--bg-muted)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress.percent >= 0 ? uploadProgress.percent : undefined}
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: uploadProgress.percent >= 0 ? `${uploadProgress.percent}%` : '100%',
                    }}
                  />
                </div>
              </div>
            )}
          </form>
        )}

        {/* Footer con acciones */}
        {!loading && (
          <div className="flex justify-end gap-3 p-4 border-t border-[color:var(--border-subtle)] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primaryDark transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-componentes pequeños (mismo archivo para mantener simple) ─── */

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">
        {value}
      </p>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', textarea = false, required = false, placeholder }) {
  const commonClass = "w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all";
  return (
    <div>
      <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows="3"
          className={commonClass}
          required={required}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className={commonClass}
          required={required}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function Switch({ checked, onChange, title, description }) {
  return (
    <div className="p-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)]/40">
      <label className="flex items-start gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={onChange}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${
            checked ? 'bg-primary' : 'bg-[color:var(--border-default)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-[color:var(--text-primary)]">
            {title}
          </span>
          <span className="block text-xs text-[color:var(--text-muted)] mt-0.5">
            {description}
          </span>
        </div>
      </label>
    </div>
  );
}

function ImageDropZone({ label, preview, currentUrl, onChange, onRemove }) {
  const showPreview = preview || currentUrl;
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="block text-sm font-medium text-[color:var(--text-secondary)] self-start">
        {label}
      </p>
      <div className="relative w-36 h-36 rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] flex items-center justify-center overflow-hidden group">
        {showPreview ? (
          <>
            <img
              src={preview || getImageUrl(currentUrl)}
              alt={label}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Upload size={20} className="text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={onChange} />
            </label>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[color:var(--bg-muted)] transition-colors">
            <ImageIcon size={32} className="text-[color:var(--text-subtle)] mb-2" />
            <span className="text-xs text-[color:var(--text-muted)]">Subir imagen</span>
            <input type="file" className="hidden" accept="image/*" onChange={onChange} />
          </label>
        )}
      </div>
      {showPreview && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs hover:underline flex items-center gap-1"
          style={{ color: 'var(--danger-text)' }}
        >
          <Trash2 size={12} /> Quitar selección
        </button>
      )}
    </div>
  );
}
