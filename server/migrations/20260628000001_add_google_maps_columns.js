/**
 * Migración: agregar columnas para integración con Google Maps (Places Autocomplete).
 *
 * Tablas afectadas (todas las columnas son NULLABLE para no romper datos existentes):
 *   - `direcciones.latitud`, `direcciones.longitud`               → pin exacto del cliente
 *   - `direcciones.direccion_formateada`                         → texto oficial que devuelve Google
 *   - `direcciones.place_id`                                     → ID único del lugar en Google
 *   - `pedidos.latitud`, `pedidos.longitud`                       → snapshot del pin al pedir
 *   - `pedidos.direccion_formateada`, `pedidos.place_id`         → snapshot del texto
 *   - `sectores.latitud_centro`, `sectores.longitud_centro`       → centroide para geocoding
 *
 * Notas de compatibilidad:
 *   - Todas las columnas son NULL. Direcciones y pedidos viejos siguen funcionando.
 *   - Si la dirección no tiene lat/lng, el envío se calcula como antes (por barrio/sector/costo_fijo).
 *   - Si la dirección tiene lat/lng, el backend usa Haversine para resolver el sector más cercano
 *     dentro de un radio configurable (default 5 km) usando `latitud_centro/longitud_centro`.
 *   - Si el admin aún no ha editado los sectores para ponerles coordenadas, la búsqueda geográfica
 *     no devolverá resultados y se usará el `costo_fijo` como fallback.
 *
 * Patrón idempotente: cada cambio se envuelve en `hasColumn` / `hasTable` para no fallar
 * si la migración se ejecuta dos veces (siguiendo `20260618000001_sectores_y_barrios.js`).
 */
export async function up(knex) {
  // ============ TABLA `direcciones` ============
  await ensureColumn(knex, 'direcciones', 'latitud', (table) => {
    table.decimal('latitud', 10, 7).nullable();
  });
  await ensureColumn(knex, 'direcciones', 'longitud', (table) => {
    table.decimal('longitud', 10, 7).nullable();
  });
  await ensureColumn(knex, 'direcciones', 'direccion_formateada', (table) => {
    table.string('direccion_formateada', 500).nullable();
  });
  await ensureColumn(knex, 'direcciones', 'place_id', (table) => {
    table.string('place_id', 255).nullable();
  });

  // Índice geográfico: acelera la consulta "direcciones cerca de X".
  const hasLatLngIdx = await knex.schema.hasTable('direcciones')
    ? await knex.raw(
        "SHOW INDEX FROM direcciones WHERE Key_name = 'idx_direcciones_latlng'"
      ).then(([rows]) => Array.isArray(rows) && rows.length > 0)
    : false;
  if (!hasLatLngIdx) {
    await knex.schema.alterTable('direcciones', (table) => {
      table.index(['latitud', 'longitud'], 'idx_direcciones_latlng');
    });
  }

  // ============ TABLA `pedidos` ============
  await ensureColumn(knex, 'pedidos', 'latitud', (table) => {
    table.decimal('latitud', 10, 7).nullable();
  });
  await ensureColumn(knex, 'pedidos', 'longitud', (table) => {
    table.decimal('longitud', 10, 7).nullable();
  });
  await ensureColumn(knex, 'pedidos', 'direccion_formateada', (table) => {
    table.string('direccion_formateada', 500).nullable();
  });
  await ensureColumn(knex, 'pedidos', 'place_id', (table) => {
    table.string('place_id', 255).nullable();
  });

  // ============ TABLA `sectores` (centroides para geocoding) ============
  // Si el admin edita un sector y le pone latitud/longitud_centro, el backend puede
  // hacer "el sector más cercano al pin del cliente" con Haversine en SQL/JS.
  await ensureColumn(knex, 'sectores', 'latitud_centro', (table) => {
    table.decimal('latitud_centro', 10, 7).nullable();
  });
  await ensureColumn(knex, 'sectores', 'longitud_centro', (table) => {
    table.decimal('longitud_centro', 10, 7).nullable();
  });
}

/**
 * Helper idempotente: si la tabla existe y la columna NO existe, agrega la columna
 * ejecutando el callback recibido (que declara la columna sobre `table`).
 *
 * @param {import('knex').Knex} knex
 * @param {string} tableName
 * @param {string} columnName
 * @param {(table: import('knex').CreateTableBuilder) => void} declare
 */
async function ensureColumn(knex, tableName, columnName, declare) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return; // la tabla aún no existe, no hacemos nada
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    declare(table);
  });
}

export async function down(knex) {
  // ============ Quitar columnas de `direcciones` ============
  if (await knex.schema.hasTable('direcciones')) {
    await dropColumnIfExists(knex, 'direcciones', 'place_id');
    await dropColumnIfExists(knex, 'direcciones', 'direccion_formateada');
    await dropColumnIfExists(knex, 'direcciones', 'longitud');
    await dropColumnIfExists(knex, 'direcciones', 'latitud');
  }

  // ============ Quitar columnas de `pedidos` ============
  if (await knex.schema.hasTable('pedidos')) {
    await dropColumnIfExists(knex, 'pedidos', 'place_id');
    await dropColumnIfExists(knex, 'pedidos', 'direccion_formateada');
    await dropColumnIfExists(knex, 'pedidos', 'longitud');
    await dropColumnIfExists(knex, 'pedidos', 'latitud');
  }

  // ============ Quitar columnas de `sectores` ============
  if (await knex.schema.hasTable('sectores')) {
    await dropColumnIfExists(knex, 'sectores', 'longitud_centro');
    await dropColumnIfExists(knex, 'sectores', 'latitud_centro');
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName);
  });
}
