/**
 * Estados de pedido y sus etiquetas legibles.
 *
 * El ENUM real en `pedidos.estado` (en la BD) NO incluye "En preparación" —
 * se mapea a "Preparando" en la BD pero a "En preparación" en UI (más natural
 * para el cocinero/mesero).
 *
 * Esta utilidad se duplica en el cliente (client/src/utils/orderStates.js)
 * para mantener el mapeo sincronizado sin tener que compartir runtime.
 * Si cambias algo acá, replica en el cliente.
 *
 * Convenciones:
 *   - Valores crudos coinciden con los de `OrderModel.ORDER_STATES`.
 *   - `KDS_COLUMNS` es el orden visual del tablero de cocina:
 *     Pendiente → Preparando → Listo.
 *   - `canTransition(from, to)` valida las transiciones permitidas
 *     (no se puede pasar de "Listo" a "Pendiente", etc.).
 */
export const ORDER_STATES = [
  'Pendiente',
  'Preparando',
  'Listo',
  'Entregado',
  'Cancelado',
];

export const ORDER_STATE_LABELS = {
  Pendiente: 'Pendiente',
  Preparando: 'En preparación',
  Listo: 'Listo',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
};

/** Estados que el KDS muestra en su tablero (excluye Entregado y Cancelado
 *  que ya están fuera de cocina). */
export const KDS_COLUMNS = ['Pendiente', 'Preparando', 'Listo'];

/** Transiciones válidas entre estados. Mapa explícito en vez de "lo que
 *  sea → lo que sea" para evitar regresiones (ej. no resucitar Cancelado). */
const ALLOWED_TRANSITIONS = {
  Pendiente:  ['Preparando', 'Cancelado'],
  Preparando: ['Listo', 'Cancelado'],
  Listo:      ['Entregado'],
  Entregado:  [],
  Cancelado:  [],
};

/** Devuelve true si el pedido puede pasar de `from` a `to`. */
export function canTransition(from, to) {
  if (!from || !to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/** Etiqueta legible (con fallback al valor crudo si no hay mapping). */
export function labelFor(estado) {
  return ORDER_STATE_LABELS[estado] || estado;
}
