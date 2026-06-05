const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Removemos /api al final para obtener la base del servidor
const BASE_URL = BACKEND_URL.replace('/api', '');

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
