/**
 * Helpers para formatear fechas/horas del SERVIDOR (timestamps que vienen de la API)
 * forzando la zona horaria de Colombia.
 *
 * Por qué existe este helper:
 * - El VPS de producción está en UTC por defecto, lo que provoca que `new Date()`
 *   del lado del servidor y los `TIMESTAMP` de MySQL se interpreten con un offset
 *   distinto a la hora real en Colombia.
 * - Sin `timeZone` explícito, `toLocaleString('es-CO')` usa la zona del navegador
 *   del usuario, lo que rompe la consistencia si el usuario navega desde otro huso.
 *
 * Todos los formateos de fechas que vienen del backend (creado_en, actualizado_en,
 * fecha_vencimiento_plan, fecha_subida, etc.) DEBEN pasar por estas funciones.
 *
 * Las fechas generadas en el cliente con `new Date()` (ej. `lastRefreshedAt`) se
 * pueden formatear también con `formatDateTime(new Date())` para mantener la
 * consistencia visual con el resto de la UI.
 */

const TIMEZONE = 'America/Bogota';
const LOCALE = 'es-CO';

// Opciones memoizadas: crear Intl.DateTimeFormat es relativamente caro.
let dateFormatter = null;
let timeFormatter = null;
let dateTimeFormatter = null;
let monthYearFormatter = null;

const getDateFormatter = () => {
  if (!dateFormatter) {
    dateFormatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return dateFormatter;
};

const getTimeFormatter = () => {
  if (!timeFormatter) {
    timeFormatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return timeFormatter;
};

const getDateTimeFormatter = () => {
  if (!dateTimeFormatter) {
    dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return dateTimeFormatter;
};

const getMonthYearFormatter = () => {
  if (!monthYearFormatter) {
    monthYearFormatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return monthYearFormatter;
};

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Devuelve la fecha formateada en es-CO, ej. "02/07/2026".
 * Devuelve 'N/A' si el valor no es parseable.
 */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? getDateFormatter().format(d) : 'N/A';
};

/**
 * Devuelve solo la hora, ej. "08:03 p. m.".
 */
export const formatTime = (value) => {
  const d = toDate(value);
  return d ? getTimeFormatter().format(d) : 'N/A';
};

/**
 * Devuelve fecha + hora, ej. "02/07/2026, 08:03 p. m.".
 * Es el reemplazo directo de `new Date(x).toLocaleString('es-CO')`.
 */
export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? getDateTimeFormatter().format(d) : 'N/A';
};

/**
 * Devuelve la fecha con mes abreviado, ej. "02 jul 2026".
 * Útil para gráficos de ventas por día en el dashboard.
 */
export const formatShortDate = (value) => {
  const d = toDate(value);
  return d ? getMonthYearFormatter().format(d) : 'N/A';
};

export const TIMEZONE_CO = TIMEZONE;
