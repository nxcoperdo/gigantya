/**
 * Helpers para evaluar la disponibilidad de un restaurante según su
 * horario de apertura/cierre (formato HH:MM o HH:MM:SS).
 *
 * Reglas:
 *  - Si no hay `horario_cierre`, se considera abierto todo el día.
 *  - Si el cierre es posterior a la apertura (mismo día), basta con
 *    `apertura <= ahora < cierre`.
 *  - Si el cierre es anterior a la apertura (turno nocturno que cruza
 *    medianoche, ej. 18:00 → 02:00), se considera abierto cuando
 *    `ahora >= apertura OR ahora < cierre`.
 */

/**
 * Normaliza un string horario a minutos desde 00:00.
 * Acepta 'HH:MM', 'HH:MM:SS' o null.
 */
function toMinutes(horario) {
  if (!horario || typeof horario !== 'string') return null;
  const parts = horario.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Devuelve `true` si el restaurante está abierto en el momento actual.
 * Si falta `horario_cierre`, se asume abierto.
 *
 * @param {string|null|undefined} horarioApertura  ej. '08:00' o '08:00:00'
 * @param {string|null|undefined} horarioCierre    ej. '22:00'
 * @param {Date}   [now]                          Fecha de referencia (para tests)
 */
export function isRestaurantOpen(horarioApertura, horarioCierre, now = new Date()) {
  const open = toMinutes(horarioApertura);
  const close = toMinutes(horarioCierre);

  // Sin horario de cierre definido → siempre abierto.
  if (close === null) return true;
  // Sin apertura pero con cierre → asumimos abierto (dato incompleto, no bloqueamos).
  if (open === null) return true;

  const current = now.getHours() * 60 + now.getMinutes();

  // Turno que cruza medianoche (ej. 18:00 → 02:00).
  if (close <= open) {
    return current >= open || current < close;
  }
  // Turno normal del mismo día.
  return current >= open && current < close;
}

/**
 * Texto corto listo para UI: "Abierto" / "Cerrado".
 */
export function getOpenStatusLabel(horarioApertura, horarioCierre, now = new Date()) {
  return isRestaurantOpen(horarioApertura, horarioCierre, now) ? 'Abierto' : 'Cerrado';
}