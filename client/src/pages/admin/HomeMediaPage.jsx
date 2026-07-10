import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import {
  Check, Image as ImageIcon, Video as VideoIcon,
  AlertCircle, ArrowLeft, Loader2, X, Eye, Info
} from 'lucide-react';
import Loading from '../../components/Loading';
import { formatDate } from '../../utils/dateHelper';

/**
 * CMS de banner de Home (Fase 12b).
 *
 * Página de administración para que el super-admin de GigantYA elija
 * cuál de los archivos estáticos commiteados en
 * `client/public/media/` se muestra en el hero de la home pública.
 *
 * Comportamiento:
 *  - Lista los archivos de client/public/media/ (leídos del servidor).
 *  - El activo tiene badge verde "ACTIVO" y los demás tienen un botón
 *    "Activar" para marcarlo como nuevo activo (desactiva el anterior).
 *  - NO hay upload: para agregar un banner nuevo, hay que commitear
 *    el archivo al repo, hacer `git pull` + `npm run build` +
 *    `pm2 restart gigantya-api` en el VPS. El banner informativo
 *    arriba lo explica.
 *  - NO hay delete: los archivos viven en el repo, se borran con git.
 */
export default function HomeMediaPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionId, setActionId] = useState(null);

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

  const handleActivate = async (id, nombre) => {
    try {
      setActionId(id);
      setError('');
      await adminService.activateHomeMedia(id);
      showSuccess(`"${nombre}" ahora es el banner activo`);
      await fetchList();
    } catch (e) {
      showError(e.response?.data?.error || 'Error activando banner');
    } finally {
      setActionId(null);
    }
  };

  if (loading && items.length === 0) return <Loading />;

  const activo = items.find((i) => Number(i.activo) === 1);

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)] transition-colors"
            aria-label="Volver al dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Banner de la Home</h1>
            <p className="text-sm text-[color:var(--text-muted)] mt-1">
              Elegí cuál de los archivos en <code>client/public/media/</code> se muestra en la página principal.
            </p>
          </div>
        </div>

        {/* Banner informativo: cómo agregar un archivo nuevo */}
        <div className="mb-4 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 flex items-start gap-2 text-sm">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Para agregar un banner nuevo:</strong> commiteá el archivo en{' '}
            <code>client/public/media/</code> y hacé deploy (
            <code>git pull</code> + <code>npm run build</code> + <code>pm2 restart gigantya-api</code>).
            Después refrescá esta página y va a aparecer en la lista.
          </div>
        </div>

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
                ({activo.tipo === 'imagen' ? 'imagen' : 'video'}, {formatDate(activo.creado_en || new Date())})
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
            <ImageIcon size={48} className="mx-auto text-[color:var(--text-muted)] mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay archivos en client/public/media/</h3>
            <p className="text-sm text-[color:var(--text-muted)]">
              Commiteá un .jpg, .png, .webp, .mp4 o .webm en esa carpeta y vas a verlo acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <BannerCard
                key={item.archivo}
                item={item}
                isActive={Number(item.activo) === 1}
                isLoading={actionId === item.id}
                onActivate={() => handleActivate(item.id, item.nombre)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Card de un banner individual. */
function BannerCard({ item, isActive, isLoading, onActivate }) {
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
        <h3 className="font-semibold text-sm truncate" title={item.nombre}>
          {item.nombre}
        </h3>
        <p className="text-xs text-[color:var(--text-muted)] mt-1 font-mono">
          {item.archivo}
        </p>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">
          {sizeMB} MB
        </p>

        {/* Acciones */}
        <div className="mt-3">
          {isActive ? (
            <div className="w-full px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-center">
              Visible en la home
            </div>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              disabled={isLoading}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-primary text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Activar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
