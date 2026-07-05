/**
 * Helper para reconciliar `knex_migrations` con la realidad de la BD.
 *
 * ¿Por qué existe?
 *   En este proyecto la BD de desarrollo se pre-pobló manualmente y
 *   `knex_migrations` quedó desincronizada: solo figura la migración
 *   `20260702000001_add_es_restaurante_to_restaurantes.js` como aplicada,
 *   aunque TODAS las anteriores ya están físicamente en la BD.
 *
 *   Knex aborta todo el lote si una migración falla (ej. la inicial
 *   `CREATE TABLE usuarios` falla con "Table already exists"). Para
 *   evitarlo, marcamos como aplicadas todas las migraciones que
 *   correspondan a la estructura actual, dejando que Knex solo corra
 *   las genuinamente nuevas.
 *
 * Uso:
 *   node scripts/reconcile-knex-migrations.js
 *   # o, antes de deploy:
 *   node scripts/reconcile-knex-migrations.js && npx knex migrate:latest
 *
 * Idempotente: usa INSERT ... WHERE NOT EXISTS para no duplicar.
 *
 * Importante: revisá la lista `MIGRATIONS` abajo. Si agregás migraciones
 * nuevas, NO las pongas acá — déjalas para que las corra Knex normalmente.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const MIGRATIONS = [
  '20260607000001_initial_schema.js',
  '20260609000001_subscriptions_and_plans.js',
  '20260609000002_payment_proofs.js',
  '20260617000001_create_direcciones.js',
  '20260617000002_create_missing_tables.js',
  '20260618000001_sectores_y_barrios.js',
  '20260619000001_auditoria_envios_sector.js',
  '20260628000001_add_google_maps_columns.js',
  '20260629000001_add_ofrece_domicilio_to_restaurantes.js',
  '20260629000002_add_es_mercado_abarrotes_to_restaurantes.js',
  '20260630000001_add_max_compra_to_cupones.js',
  '20260630000002_add_tipo_negocio_to_categorias.js',
  '20260630000003_unique_categoria_por_tipo_negocio.js',
  '20260701000001_add_comida_rapida_nicho.js',
  '20260701000002_asignar_categorias_comida_rapida.js',
  '20260701000003_create_favoritos.js',
  '20260701000004_fix_favoritos_target_id.js',
  '20260701000005_add_es_global_to_cupones.js',
  '20260702000002_add_es_retiro_local_to_pedidos.js',
  '20260702000003_add_ofrece_consumo_en_local_to_restaurantes.js',
  '20260702000004_add_es_consumo_en_local_to_pedidos.js',
  '20260703000001_add_panaderia_pasteleria_nicho.js',
  '20260703000002_seed_categorias_panaderia_pasteleria.js',
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'restaurante_pedidos_gigantya',
    multipleStatements: true,
  });

  console.log(`📌 Reconciliando ${MIGRATIONS.length} migraciones en BD "${process.env.DB_NAME}"...`);

  // 1. Asegurar que la tabla knex_migrations existe (la crea Knex en su
  //    primera corrida; si todavía no existe, la creamos manualmente).
  await conn.query(`
    CREATE TABLE IF NOT EXISTS knex_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NULL,
      batch INT UNSIGNED NULL,
      migration_time DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Listar las que ya están marcadas
  const [applied] = await conn.query('SELECT name FROM knex_migrations');
  const appliedSet = new Set(applied.map((r) => r.name));
  console.log(`   Ya marcadas en knex_migrations: ${applied.length}`);

  // 3. Verificar que los archivos existen físicamente (defensa contra typos)
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const existentes = new Set(
    fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.js')),
  );

  // 4. Marcar las que faltan
  let insertadas = 0;
  for (const name of MIGRATIONS) {
    if (appliedSet.has(name)) continue;
    if (!existentes.has(name)) {
      console.warn(`   ⚠️  Archivo no encontrado, saltando: ${name}`);
      continue;
    }
    await conn.query(
      'INSERT INTO knex_migrations (name, batch, migration_time) VALUES (?, ?, NOW())',
      [name, 1],
    );
    insertadas += 1;
    console.log(`   ✅ Marcada: ${name}`);
  }

  console.log(`\n📊 Resultado: ${insertadas} migración(es) marcada(s) como aplicadas.`);
  if (insertadas === 0) {
    console.log('   (Nada que hacer — el estado ya estaba sincronizado.)');
  }

  // 5. Estado final
  const [final] = await conn.query(
    'SELECT name, batch, migration_time FROM knex_migrations ORDER BY id',
  );
  console.log(`\n   Total en knex_migrations: ${final.length}`);
  console.table(final);

  await conn.end();
}

main().catch((err) => {
  console.error('❌ ERROR:', err.message);
  process.exit(1);
});
