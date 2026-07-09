/**
 * Migración: Fase 7 — Índices para reportes POS.
 *
 * Crea dos índices sobre `pedidos` que faltan para que las queries de
 * reportes (Fase 7) sean eficientes. Ambos están pensados para
 * resolver el patrón canónico de los reportes:
 *
 *   WHERE restaurante_id = ?
 *     AND canal = 'pos'                      <- filtra solo pedidos POS
 *     AND estado IN ('Entregado','Listo')    <- solo pedidos "cerrados"
 *     AND creado_en BETWEEN ? AND ?          <- ventana temporal
 *
 * Los índices ya existentes (`idx_pedidos_canal` simple y el
 * `restaurante_id + creado_en` global) NO cubren bien este patrón:
 *   - `idx_pedidos_canal` solo tiene `canal` — sirve para filtrar POS
 *     pero no incluye `restaurante_id` ni `creado_en`, así que MySQL
 *     todavía tiene que recorrer todas las filas POS.
 *   - `restaurante_id + creado_en` ya está en el índice global de
 *     pedidos; sirve pero tiene que descartar manualmente las filas
 *     con `canal='web'`.
 *
 * Los dos nuevos índices son:
 *   - `idx_pedidos_canal_fecha (canal, creado_en)`: para queries que
 *     solo filtran por canal + tiempo (raras en este proyecto pero
 *     útiles para reports globales).
 *   - `idx_pedidos_rest_canal (restaurante_id, canal, creado_en)`:
 *     EL CLAVE. Cubre exactamente el patrón "reportes por restaurante
 *     POS en una ventana temporal".
 *
 * Idempotente: cada índice se chequea con `information_schema.statistics`
 * (mismo helper que la migración de Fase 3 / 4). Si el índice ya existe
 * (restore, segunda corrida), se sale silenciosamente.
 *
 * Companion SQL manual: `database/migrations_manuales/pos_fase7_reportes_indexes.sql`
 * (constraint operacional del VPS: no corre migraciones Knex automáticas).
 */
export async function up(knex) {
  // 1) idx_pedidos_canal_fecha (canal, creado_en) — útil para reportes
  //    globales (no por restaurante) y para queries de admin que filtran
  //    por canal.
  const [rows1] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'pedidos'
        AND index_name = 'idx_pedidos_canal_fecha'
      LIMIT 1`
  );
  if (!rows1 || rows1.length === 0) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.index(['canal', 'creado_en'], 'idx_pedidos_canal_fecha');
    });
  }

  // 2) idx_pedidos_rest_canal (restaurante_id, canal, creado_en) — el
  //    índice estrella de los reportes POS por restaurante.
  const [rows2] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'pedidos'
        AND index_name = 'idx_pedidos_rest_canal'
      LIMIT 1`
  );
  if (!rows2 || rows2.length === 0) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.index(['restaurante_id', 'canal', 'creado_en'], 'idx_pedidos_rest_canal');
    });
  }
}

export async function down(knex) {
  // 1) DROP INDEX idx_pedidos_canal_fecha (con guard).
  const [rows1] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'pedidos'
        AND index_name = 'idx_pedidos_canal_fecha'
      LIMIT 1`
  );
  if (rows1 && rows1.length > 0) {
    await knex.raw(`ALTER TABLE \`pedidos\` DROP INDEX \`idx_pedidos_canal_fecha\``);
  }
  // 2) DROP INDEX idx_pedidos_rest_canal.
  const [rows2] = await knex.raw(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'pedidos'
        AND index_name = 'idx_pedidos_rest_canal'
      LIMIT 1`
  );
  if (rows2 && rows2.length > 0) {
    await knex.raw(`ALTER TABLE \`pedidos\` DROP INDEX \`idx_pedidos_rest_canal\``);
  }
}
