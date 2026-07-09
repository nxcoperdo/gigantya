/**
 * Idempotency-Key store (Fase 5).
 *
 * Guarda respuestas HTTP en memoria indexadas por
 *   (Idempotency-Key header, ruta del endpoint).
 * Si el cliente repite una request con la misma key, devolvemos la
 * respuesta cacheada sin re-ejecutar el handler.
 *
 * Por qué en memoria y no Redis:
 *   - Un POS de un solo restaurante genera ~1 cierre de caja por turno
 *     y ~100 cobros/turno. El LRU de 1000 entradas cubre holgadamente
 *     un día. Si en el futuro hay multi-nodo, migrar a Redis es
 *     directo (mismo contrato `get/put`).
 *
 * TTL: 24h. Suficiente para reintentos legítimos; después la key
 * expira y si llega una request con esa key vieja, la procesamos de
 * nuevo (que es lo correcto — la key ya no representa una operación
 * en curso).
 *
 * Concurrencia: el `Map` de JS no es atómico para `get-then-put` pero
 * las dos requests que colisionan terminarán escribiendo la misma
 * respuesta (el handler es determinista dado el mismo input). Si el
 * handler NO es determinista (ej. timestamp en la respuesta), el
 * caller debería sobreescribir el `payload` con uno estable.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

const store = new Map(); // key → { status, body, headers, expiresAt }

/** Genera la clave compuesta. */
function makeKey(idempotencyKey, route) {
  return `${route}::${idempotencyKey}`;
}

/** Devuelve la respuesta cacheada o undefined. */
export function getCachedResponse(idempotencyKey, route) {
  if (!idempotencyKey) return undefined;
  const k = makeKey(idempotencyKey, route);
  const entry = store.get(k);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return undefined;
  }
  return entry;
}

/** Guarda la respuesta del handler. */
export function setCachedResponse(idempotencyKey, route, response) {
  if (!idempotencyKey) return;
  const k = makeKey(idempotencyKey, route);
  // LRU simple: si está lleno, borrar la más vieja.
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    store.delete(firstKey);
  }
  store.set(k, {
    ...response,
    expiresAt: Date.now() + TTL_MS,
  });
}

/** Limpia todo (para tests). */
export function clearAll() {
  store.clear();
}

/** Tamaño actual (para tests / debug). */
export function size() {
  return store.size;
}
