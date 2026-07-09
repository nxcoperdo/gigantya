/**
 * Estados de pedido y sus etiquetas legibles — espejo del servidor.
 *
 * Si cambiás algo acá, replicá en server/src/utils/orderStates.js
 * (y viceversa). Por ahora no hay un solo source of truth: mantenemos
 * el contrato sincronizado manualmente.
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

export const KDS_COLUMNS = ['Pendiente', 'Preparando', 'Listo'];

const ALLOWED_TRANSITIONS = {
  Pendiente:  ['Preparando', 'Cancelado'],
  Preparando: ['Listo', 'Cancelado'],
  Listo:      ['Entregado'],
  Entregado:  [],
  Cancelado:  [],
};

export function canTransition(from, to) {
  if (!from || !to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function labelFor(estado) {
  return ORDER_STATE_LABELS[estado] || estado;
}
