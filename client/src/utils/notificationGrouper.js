/**
 * notificationGrouper.js
 *
 * Helper puro para agrupar notificaciones por día (en zona horaria America/Bogota)
 * para mostrarlas en el NotificationCenter.
 *
 * Por qué existe:
 * - El listado plano de notificaciones (ordenado por creado_en DESC) se vuelve
 *   inmanejable cuando un usuario acumula 20-50+ notificaciones.
 * - El usuario necesita ver de un vistazo: cuántas no leídas tiene, agrupadas
 *   por día, y poder marcar como leídas todas las de un día en particular.
 *
 * Por qué America/Bogota explícito:
 * - El VPS está en UTC (ver [[timezone-fix-pedidos]]), por lo que los timestamps
 *   de MySQL pueden no coincidir con el día local del usuario. Se sigue el mismo
 *   patrón que en `dateHelper.js`: Intl.DateTimeFormat con timeZone fijo.
 *
 * Reglas de agrupación:
 * - "Hoy"        → mismo día en America/Bogota
 * - "Ayer"       → día anterior en America/Bogota
 * - "Esta semana"→ últimos 7 días, excluyendo hoy y ayer
 * - "Anteriores" → más de 7 días
 *
 * Dentro de cada grupo los items se ordenan: no leídas primero, después leídas
 * (ambas sub-secuencias en creado_en DESC).
 *
 * Es una función pura: no toca estado, no hace fetch, no importa React. Trivialmente testeable.
 */

const TIMEZONE = 'America/Bogota';

// Formatters memoizados (Intl.DateTimeFormat es relativamente caro de instanciar).
let dayKeyFormatter = null;
const getDayKeyFormatter = () => {
  if (!dayKeyFormatter) {
    dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  return dayKeyFormatter;
};

/**
 * Devuelve la "clave de día" (YYYY-MM-DD) de un timestamp en America/Bogota.
 * Usamos 'en-CA' porque su formato es YYYY-MM-DD estable, sin surprises de locale.
 */
const toDayKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return getDayKeyFormatter().format(d);
};

/**
 * Devuelve la clave de día de "hoy" en America/Bogota.
 */
const todayKey = () => toDayKey(new Date());

/**
 * Resta `days` días a una clave YYYY-MM-DD (YYYY-MM-DD) sin pasar por Date() nativo
 * para no volver a caer en el problema de timezone. Implementación con string slicing.
 */
const shiftDayKey = (dayKey, days) => {
  // dayKey viene como 'YYYY-MM-DD'
  const [y, m, d] = dayKey.split('-').map(Number);
  // Usamos UTC para el cálculo aritmético (no es la fecha final, es solo matemática).
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/**
 * Recibe la lista de notificaciones del backend y devuelve los grupos ordenados
 * por recencia, listos para renderizar.
 *
 * @param {Array<{id:number, leido:0|1, creado_en:string, titulo:string, mensaje:string, tipo:string}>} notifications
 * @returns {Array<{key:string, label:string, unreadCount:number, items:Array}>}
 */
export function groupNotificationsByDay(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const today = todayKey();
  const yesterday = shiftDayKey(today, -1);
  const weekAgo = shiftDayKey(today, -7); // exclusivo: >7 días = "Anteriores"

  // Buckets
  const buckets = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };

  for (const n of notifications) {
    const k = toDayKey(n.creado_en);
    if (!k) continue;

    if (k === today) buckets.today.push(n);
    else if (k === yesterday) buckets.yesterday.push(n);
    else if (k > weekAgo) buckets.this_week.push(n); // weekAgo < k < today y k != yesterday
    else buckets.older.push(n);
  }

  // Orden interno de cada bucket: no leídas primero (DESC), después leídas (DESC).
  const sortBucket = (arr) => {
    const unread = arr
      .filter((n) => n.leido === 0)
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    const read = arr
      .filter((n) => n.leido !== 0)
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    return [...unread, ...read];
  };

  const ordered = [
    { key: 'today', label: 'Hoy', items: sortBucket(buckets.today) },
    { key: 'yesterday', label: 'Ayer', items: sortBucket(buckets.yesterday) },
    { key: 'this_week', label: 'Esta semana', items: sortBucket(buckets.this_week) },
    { key: 'older', label: 'Anteriores', items: sortBucket(buckets.older) },
  ];

  // Filtrar grupos vacíos, calcular unreadCount y devolver.
  return ordered
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      key: g.key,
      label: g.label,
      unreadCount: g.items.filter((n) => n.leido === 0).length,
      items: g.items,
    }));
}

/**
 * Devuelve el rango de fechas [from, to) en formato 'YYYY-MM-DD HH:mm:ss' (hora local Bogota)
 * correspondiente al bucket, listo para enviar al backend en el body del PATCH.
 *
 * @param {'today'|'yesterday'|'this_week'|'older'} key
 * @returns {{from:string, to:string, label:string}|null}
 *
 * Nota: el backend confia en estos rangos (los usa tal cual en el BETWEEN), por eso
 * los generamos en America/Bogota. Se manda junto con la key para logging.
 */
export function getDateRangeForGroup(key) {
  const today = todayKey();
  if (key === 'today') {
    return {
      from: `${today} 00:00:00`,
      to: `${shiftDayKey(today, 1)} 00:00:00`,
      label: 'Hoy',
    };
  }
  if (key === 'yesterday') {
    const y = shiftDayKey(today, -1);
    return {
      from: `${y} 00:00:00`,
      to: `${today} 00:00:00`,
      label: 'Ayer',
    };
  }
  if (key === 'this_week') {
    // Últimos 7 días, excluyendo hoy y ayer.
    // from = hace 7 días 00:00, to = ayer 00:00
    const weekAgo = shiftDayKey(today, -7);
    const y = shiftDayKey(today, -1);
    return {
      from: `${weekAgo} 00:00:00`,
      to: `${y} 00:00:00`,
      label: 'Esta semana',
    };
  }
  if (key === 'older') {
    // Sin "to" superior: desde hace 7 días hacia atrás.
    const weekAgo = shiftDayKey(today, -7);
    return {
      from: `1970-01-01 00:00:00`,
      to: `${weekAgo} 00:00:00`,
      label: 'Anteriores',
    };
  }
  return null;
}

export default {
  groupNotificationsByDay,
  getDateRangeForGroup,
};
