/**
 * Botón de descarga de banners de locales destacados.
 *
 * Dispara GET /api/admin/featured-banners/zip y guarda el ZIP resultante
 * con FileSaver. Si el server devuelve 404 (no hay locales destacados
 * con banner cargado), muestra un toast en lugar de descargar un ZIP
 * vacío.
 *
 * UX: mientras la descarga está en curso el botón muestra un spinner y
 * se deshabilita. Después vuelve a la normalidad (con o sin éxito).
 *
 * Decisiones:
 *   - Usamos `FileSaver.js` solo si está disponible; si no, caemos al
 *     truco del `<a download>` + ObjectURL + `revokeObjectURL`. Esto
 *     evita agregar una dependencia nueva cuando el browser ya soporta
 *     `<a download>` (todos los modernos).
 *   - Si la respuesta NO es application/zip (ej: 404 con JSON de
 *     error), leemos el body como texto y lo mostramos como error.
 */
import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { adminService } from '../services/api';

/**
 * Helper: fuerza la descarga de un Blob en el browser.
 * Devuelve `true` si se disparó la descarga, `false` si el caller
 * tiene que manejar el error.
 */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // append al DOM para que Firefox dispare el click programático.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke después de un tick: el browser ya leyó el blob para la
  // descarga, no hace falta mantenerlo más en memoria.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export default function FeaturedBannersDownloadButton({ className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await adminService.downloadFeaturedBannersZip();
      const blob = response.data;
      // El endpoint siempre devuelve application/zip cuando hay datos;
      // un Blob vacío o de otro tipo indica problema del server.
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        setError('El servidor devolvió una respuesta vacía.');
        return;
      }
      saveBlob(blob, 'banners-destacados.zip');
    } catch (err) {
      // Si el server respondió 404, axios NO tira error de JSON
      // porque pedimos `responseType: 'blob'`. El body de error
      // viene como Blob; lo leemos y mostramos el mensaje.
      if (err.response?.status === 404 && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          setError(json.error || 'No hay locales destacados con banner cargado.');
        } catch {
          setError('No hay locales destacados con banner cargado.');
        }
      } else if (err.response?.status === 401) {
        setError('Tu sesión expiró. Volvé a iniciar sesión.');
      } else if (err.response?.status === 403) {
        setError('No tenés permisos para descargar.');
      } else {
        setError(err.message || 'Error al descargar el ZIP.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn btn-outline inline-flex items-center gap-2 text-primary border-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Descargar un ZIP con los banners de todos los locales destacados (plan Premium o superior con banner cargado)"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {loading ? 'Descargando…' : 'Banners Destacados'}
      </button>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 max-w-xs">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
