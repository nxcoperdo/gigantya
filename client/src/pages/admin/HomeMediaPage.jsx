import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import {
  Upload, Trash2, Check, Image as ImageIcon, Video as VideoIcon,
  AlertCircle, ArrowLeft, Loader2, X, Eye
} from 'lucide-react';
import Loading from '../../components/Loading';
import { formatDate } from '../../utils/dateHelper';

/**
 * CMS de banner de Home (Fase 12c).
 *
 * Página de administración para que el super-admin de GigantYA gestione
 * los banners que se muestran en el hero de la home pública.
 *
 * Comportamiento:
 *  - Lista los archivos subidos a server/uploads/home-media-uploaded/
 *    (los archivos NO se commitean al repo, son uploads).
 *  - El activo tiene badge verde "ACTIVO" y los demás tienen un botón
 *    "Activar" para marcarlo como nuevo activo (desactiva el anterior).
 *  - Botón "Subir nuevo" arriba: abre un file picker, acepta imagen o
 *    video, sube directo al server.
 *  - Botón "Eliminar" en cada card: funciona solo para archivos NO
 *    activos (el backend rechaza con 400 si se intenta borrar el activo).
 */
export default function HomeMediaPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Progreso de upload en % (0-100). Mientras `uploading` es true, esta
  // barra se renderiza en lugar del botón. `null` = sin upload en curso.
  // El backend responde recién cuando termina, así que después del 100%
  // viene el await de `fetchList` — durante ese intervalo mostramos
  // "Procesando…" para que el usuario no piense que se colgó.
  const [uploadProgress, setUploadProgress] = useState(null);
  // Bytes subidos vs total (formateados con formatBytes para mostrar
  // "3.2 MB / 12.4 MB"). Mantenemos estos valores para feedback preciso
  // (la barra sola no es suficiente para archivos grandes).
  const [uploadBytes, setUploadBytes] = useState({ loaded: 0, total: 0 });
  // Nombre del archivo actualmente subiendose — para mostrarlo en la
  // cabecera de la barra de progreso y que el admin sepa qué está
  // subiendo sin tener que abrir el file picker.
  const [uploadName, setUploadName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionArchivo, setActionArchivo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const r = await adminService.listHomeMedia();
      setItems(r.data?.items || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Error cargando banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Auto-dismiss de success después de 3s.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const showError = (msg) => { setError(msg); setSuccess(''); };
  const showSuccess = (msg) => { setSuccess(msg); setError(''); };

  /** Maneja el file picker. Sube directo. */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset para que se pueda subir el mismo archivo dos veces seguidas.
    e.target.value = '';
    if (!file) return;
    await handleUpload(file, file.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async (file, nombre) => {
    try {
      setUploading(true);
      setError('');
      setUploadProgress(0);
      setUploadBytes({ loaded: 0, total: file.size });
      setUploadName(nombre || file.name);
      const fd = new FormData();
      fd.append('file', file);
      if (nombre) fd.append('nombre', nombre);
      await adminService.uploadHomeMedia(fd, (percent, loaded, total) => {
        setUploadProgress(percent);
        if (typeof loaded === 'number') {
          setUploadBytes({ loaded, total: total || file.size });
        }
      });
      showSuccess(`Banner "${nombre || file.name}" subido correctamente`);
      await fetchList();
    } catch (e) {
      showError(e.response?.data?.error || 'Error subiendo banner');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadBytes({ loaded: 0, total: 0 });
      setUploadName('');
    }
  };

  const handleActivate = async (archivo, nombre) => {
    try {
      setActionArchivo(archivo);
      setError('');
      await adminService.activateHomeMedia(archivo);
      showSuccess(`"${nombre}" ahora es el banner activo`);
      await fetchList();
    } catch (e) {
      showError(e.response?.data?.error || 'Error activando banner');
    } finally {
      setActionArchivo(null);
    }
  };

  const handleDelete = async (archivo) => {
    try {
      setActionArchivo(archivo);
      setError('');
      await adminService.deleteHomeMedia(archivo);
      showSuccess('Banner borrado');
      setConfirmDelete(null);
      await fetchList();
    } catch (e) {
      showError(e.response?.data?.error || 'Error borrando banner');
    } finally {
      setActionArchivo(null);
    }
  };

  if (loading && items.length === 0) return <Loading />;

  const activo = items.find((i) => Number(i.activo) === 1);

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)] transition-colors"
              aria-label="Volver al dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[color:var(--text-primary)] tracking-tight">Banner de la Home</h1>
              <p className="text-sm text-[color:var(--text-muted)] mt-1">
                Sube varios archivos y elige cuál se muestra en la página principal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] justify-center"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading
              ? (uploadProgress !== null && uploadProgress < 100
                  ? `Subiendo… ${uploadProgress}%`
                  : 'Procesando…')
              : 'Subir nuevo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Subir archivo de banner"
          />
        </div>

        {/* Barra de progreso de upload.
            Solo se muestra mientras `uploading` es true. Aparece debajo
            del header y se "ancla" arriba del banner activo. Es full-width
            con `max-w-3xl` para alinearse con el buscador del home.
            Mientras `uploadProgress` es null (indeterminado), la barra
            usa `animate-pulse` en lugar de un porcentaje. */}
        {uploading && (
          <div
            className="mb-6 p-3 sm:p-4 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] shadow-sm"
            role="status"
            aria-live="polite"
            aria-label={`Subiendo ${uploadName}. ${uploadProgress !== null && uploadProgress >= 0 ? `${uploadProgress}% completado.` : 'Progreso indeterminado.'}`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {uploadBytes.total > 0 && uploadBytes.total < 5 * 1024 * 1024
                  ? <ImageIcon size={16} className="text-[color:var(--text-muted)] flex-shrink-0" aria-hidden="true" />
                  : <VideoIcon size={16} className="text-[color:var(--text-muted)] flex-shrink-0" aria-hidden="true" />}
                <span className="text-sm font-medium text-[color:var(--text-primary)] truncate" title={uploadName}>
                  {uploadName}
                </span>
              </div>
              <span className="text-sm font-bold text-primary tabular-nums flex-shrink-0">
                {uploadProgress !== null && uploadProgress >= 0
                  ? `${uploadProgress}%`
                  : '…'}
              </span>
            </div>
            {/* Track de la barra: gris claro, altura 8px, rounded-full.
                `role="progressbar"` + `aria-valuenow/min/max` para
                lectores de pantalla (WAI-ARIA). */}
            <div
              className="h-2 w-full rounded-full bg-[color:var(--bg-muted)] overflow-hidden"
              role="progressbar"
              aria-valuenow={uploadProgress !== null && uploadProgress >= 0 ? uploadProgress : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {uploadProgress !== null && uploadProgress >= 0 ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light motion-safe:transition-[width] motion-safe:duration-200 motion-reduce:transition-none"
                  style={{ width: `${uploadProgress}%` }}
                />
              ) : (
                // Modo indeterminado: la barra "viaja" de izquierda a
                // derecha indefinidamente con CSS animation (no JS).
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-primary-light motion-safe:animate-pulse" />
              )}
            </div>
            {/* Bytes: "3.2 MB / 12.4 MB" debajo de la barra, en tamaño
                xs, color muted. Se ocultan si no tenemos bytes
                confiables (modo indeterminado). */}
            {uploadBytes.total > 0 && (
              <p className="text-[11px] text-[color:var(--text-muted)] mt-1.5 tabular-nums">
                {formatBytes(uploadBytes.loaded)} / {formatBytes(uploadBytes.total)}
              </p>
            )}
          </div>
        )}

        {/* Banner activo actualmente */}
        <div className={`mb-6 p-4 rounded-xl border ${
          activo
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {activo ? (
            <p className="text-sm">
              <strong>Banner activo actualmente:</strong> {activo.nombre}{' '}
              <span className="text-[color:var(--text-muted)]">
                ({activo.tipo === 'imagen' ? 'imagen' : 'video'}, {formatDate(new Date())})
              </span>
            </p>
          ) : (
            <p className="text-sm">
              <strong>No hay banner activo.</strong> La home está mostrando el video de respaldo.
            </p>
          )}
        </div>

        {/* Toasts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded">
              <X size={14} />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 text-sm">
            <Check size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{success}</div>
          </div>
        )}

        {/* Lista de banners */}
        {items.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]">
            <Upload size={48} className="mx-auto text-[color:var(--text-muted)] mb-4" />
            <h3 className="text-lg font-heading font-semibold mb-2">No hay banners subidos</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">
              Sube tu primera imagen o video para empezar.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Upload size={16} />
              Subir banner
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <BannerCard
                key={item.archivo}
                item={item}
                isActive={Number(item.activo) === 1}
                isLoading={actionArchivo === item.archivo}
                onActivate={() => handleActivate(item.archivo, item.nombre)}
                onDelete={() => setConfirmDelete(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmación de borrado */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="bg-[color:var(--bg-elevated)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-heading font-bold mb-2">¿Borrar "{confirmDelete.nombre}"?</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">
              Esta acción no se puede deshacer. El archivo también se borra del disco.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[color:var(--border-default)] hover:bg-[color:var(--bg-muted)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete.archivo)}
                className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 active:scale-[0.98] transition-all"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Card de un banner individual. */
function BannerCard({ item, isActive, isLoading, onActivate, onDelete }) {
  const isVideo = item.tipo === 'video';
  const previewUrl = `/media/${item.archivo}`;
  const sizeMB = (item.size_bytes / 1024 / 1024).toFixed(2);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      isActive
        ? 'border-emerald-400 bg-emerald-50/30 shadow-lg shadow-emerald-100'
        : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] hover:border-[color:var(--border-default)]'
    }`}>
      {/* Preview */}
      <div className="relative aspect-video bg-black">
        {isVideo ? (
          <video
            src={previewUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={previewUrl}
            alt={item.nombre}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Badge tipo */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 text-white text-xs flex items-center gap-1">
          {isVideo ? <VideoIcon size={12} /> : <ImageIcon size={12} />}
          {isVideo ? 'Video' : 'Imagen'}
        </div>
        {/* Badge activo */}
        {isActive && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
            <Check size={12} />
            ACTIVO
          </div>
        )}
        {/* Link a ver grande */}
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/70 text-white hover:bg-black/90 transition-colors"
          aria-label="Ver en tamaño completo"
        >
          <Eye size={14} />
        </a>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-heading font-semibold text-sm truncate" title={item.nombre}>
          {item.nombre}
        </h3>
        <p className="text-xs text-[color:var(--text-muted)] mt-1 font-mono truncate" title={item.archivo}>
          {item.archivo}
        </p>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">
          {sizeMB} MB
        </p>

        {/* Acciones */}
        <div className="flex gap-2 mt-3">
          {isActive ? (
            <div className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-center">
              Visible en la home
            </div>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              disabled={isLoading}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Activar
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading || isActive}
            title={isActive ? 'No se puede borrar el banner activo' : 'Borrar'}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border-default)] text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Formatea bytes en una unidad legible. Usado para mostrar el progreso
 * de upload ("3.2 MB / 12.4 MB") en la barra de progreso.
 *   formatBytes(0)        → "0 B"
 *   formatBytes(1024)     → "1.0 KB"
 *   formatBytes(1234567)  → "1.2 MB"
 *   formatBytes(5e9)      → "4.7 GB"
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
