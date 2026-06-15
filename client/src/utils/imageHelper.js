const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Removemos /api al final para obtener la base del servidor
const BASE_URL = BACKEND_URL.replace('/api', '');

/**
 * Convierte una ruta de imagen del backend en una URL completa
 * y devuelve atributos optimizados para <img>
 */
export function getImageUrl(url) {
  if (!url) return null;

  // Si la URL ya es completa (http...), la dejamos así
  if (url.startsWith('http')) {
    return url;
  }

  // Si es una ruta relativa que empieza con /uploads o uploads, le pegamos la BASE_URL
  if (url.startsWith('/uploads') || url.startsWith('uploads')) {
    const normalizedUrl = url.startsWith('/uploads') ? url : `/${url}`;
    return `${BASE_URL}${normalizedUrl}`;
  }

  return url;
}

/**
 * Atributos comunes para <img> optimizados
 * - loading="lazy": no carga hasta que esté en viewport
 * - decoding="async": no bloquea el render
 * - fetchpriority="low": baja prioridad para imágenes no críticas
 */
export const IMAGE_DEFAULT_ATTRS = {
  loading: 'lazy',
  decoding: 'async',
};

/**
 * Atributos para imágenes above-the-fold (hero, banner principal)
 * - loading="eager": carga inmediata
 * - fetchpriority="high": alta prioridad
 */
export const IMAGE_EAGER_ATTRS = {
  loading: 'eager',
  decoding: 'async',
  fetchpriority: 'high',
};
