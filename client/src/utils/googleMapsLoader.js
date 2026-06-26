/**
 * Loader único del SDK de Google Maps (Places + Maps).
 *
 * - Cachea la promesa a nivel de módulo para evitar inyecciones duplicadas.
 * - Soporta fallback cuando no hay API key configurada (modo `null`).
 * - Timeout configurable para no bloquear la UI si la red está caída.
 *
 * Uso:
 *   const google = await loadGoogleMaps();
 *   if (!google) {  // no key configurada, fallback a input de texto
 *     ...
 *   }
 *
 * Variables de entorno:
 *   VITE_GOOGLE_MAPS_API_KEY → clave pública de Google Cloud
 */

const SCRIPT_ID = 'gmaps-sdk-loader';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Devuelve la API key configurada (string) o '' si no hay.
 * @returns {string}
 */
export function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

/**
 * ¿Hay API key configurada y no es el placeholder?
 * @returns {boolean}
 */
export function hasGoogleMapsApiKey() {
  const k = getGoogleMapsApiKey();
  return Boolean(k) && k !== 'tu_api_key_aqui' && k !== 'YOUR_API_KEY_HERE';
}

/**
 * Espera N ms.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inyecta el script de Google Maps en <head> y devuelve una Promise que
 * resuelve cuando `window.google.maps.places` está disponible.
 *
 * @param {string} apiKey
 * @param {number} timeoutMs
 */
function injectScript(apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    // Si ya existe un <script> con el id, no inyectamos de nuevo; esperamos a que cargue.
    let script = document.getElementById(SCRIPT_ID);

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      // `loading=async` y `libraries=places` son los flags oficiales para Places Autocomplete.
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&libraries=places&v=weekly&loading=async`;
      script.onerror = () =>
        reject(new Error('No se pudo cargar el SDK de Google Maps (revisa la API key y la red).'));
      document.head.appendChild(script);
    }

    let elapsed = 0;
    const tick = 50;
    const check = () => {
      if (window.google?.maps?.places) {
        resolve(window.google);
        return;
      }
      elapsed += tick;
      if (elapsed >= timeoutMs) {
        reject(new Error(`Google Maps SDK no respondió en ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, tick);
    };
    check();
  });
}

// Cache a nivel de módulo para evitar múltiples inyecciones.
let cachedPromise = null;

/**
 * Carga el SDK de Google Maps (con cache). Devuelve `null` si no hay API key,
 * o una Promise que resuelve a `window.google` cuando está listo.
 *
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<typeof window.google | null>}
 */
export async function loadGoogleMaps(opts = {}) {
  if (!hasGoogleMapsApiKey()) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[GoogleMaps] VITE_GOOGLE_MAPS_API_KEY no configurada — usando fallback de texto plano.'
      );
    }
    return null;
  }

  if (cachedPromise) return cachedPromise;

  const apiKey = getGoogleMapsApiKey();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  cachedPromise = injectScript(apiKey, timeoutMs).catch((err) => {
    // Si falla la primera vez, limpiamos el cache para permitir reintentos
    cachedPromise = null;
    throw err;
  });

  return cachedPromise;
}

/**
 * Resetea el cache (útil en tests).
 */
export function _resetGoogleMapsLoaderForTests() {
  cachedPromise = null;
  const script = document.getElementById(SCRIPT_ID);
  if (script) script.remove();
}

// Evita warning de "no usado" en builds que tree-shakean sleep.
void sleep;