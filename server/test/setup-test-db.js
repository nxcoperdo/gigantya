/**
 * setup-test-db.js
 *
 * Prepara la base de datos de test antes de correr la suite.
 *
 * Responsabilidad: correr las migraciones Knex contra la DB de test
 * para que el schema esté al día. NO se encarga de crear/dropear la
 * DB misma: eso lo hace el step anterior en CI (un `mysql -e
 * "DROP/CREATE DATABASE"` con credenciales de root).
 *
 * Razón de la división:
 *   - El usuario de la app (`DB_USER`) normalmente NO tiene permisos
 *     CREATE/DROP. Crear la DB requiere root.
 *   - El workflow de CI es el lugar correcto para tener las
 *     credenciales de root: ya las usa para otros pasos.
 *   - Así, este script puede ser ejecutado por el usuario de la app
 *     en cualquier momento (no solo por root) y se mantiene simple.
 *
 * Si en algún momento la DB de test no existe (caso raro: setup
 * local sin haber corrido el paso de CREATE), el script falla con
 * un error claro pidiendo que se cree.
 *
 * Uso:
 *   node test/setup-test-db.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '..');

const TEST_DB_NAME = 'restaurante_pedidos_test';

async function setupTestDb() {
  // Forzar NODE_ENV=test ANTES de requerir knex para que el config
  // apunte a la DB de test (no a la de dev). Ver src/config/database.js:22-24.
  process.env.NODE_ENV = 'test';

  // Knex + knexfile usan CommonJS. Importamos vía createRequire.
  // Como knexfile.js tiene `export default {...}`, en el require
  // aparece como `{ __esModule: true, default: {...} }` y hay que
  // tomar `.default` para tener la config plana.
  const require = createRequire(import.meta.url);
  const knexModule = require('knex');
  const knexConfigModule = require(path.join(SERVER_ROOT, 'knexfile.js'));
  const knexConfig = knexConfigModule.default || knexConfigModule;

  // Conexión sin seleccionar DB para validar existencia de la DB
  // de test. Hacemos esto ANTES de instanciar knex, porque knex
  // intenta conectarse a la DB apenas se crea y tira
  // ER_DBACCESS_DENIED_ERROR si la DB no existe.
  const rawModule = require('mysql2/promise');
  const checkConn = await rawModule.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    const [rows] = await checkConn.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
       WHERE SCHEMA_NAME = ? LIMIT 1`,
      [TEST_DB_NAME]
    );
    if (!rows || rows.length === 0) {
      throw new Error(
        `La base de datos "${TEST_DB_NAME}" no existe. ` +
        `Crearla con un usuario que tenga permisos CREATE/DROP. ` +
        `En CI lo hace el servicio mysql:8.0 del workflow; localmente:\n` +
        `  mysql -u root -p -e "CREATE DATABASE ${TEST_DB_NAME} ` +
        `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`
      );
    }
  } finally {
    await checkConn.end();
  }

  const knex = knexModule({
    ...knexConfig,
    connection: {
      ...knexConfig.connection,
      database: TEST_DB_NAME,
    },
  });

  try {
    console.log('🚀 Corriendo migraciones Knex contra', TEST_DB_NAME);
    const [batchNo, migrations] = await knex.migrate.latest();
    if (migrations.length === 0) {
      console.log('✅ Migraciones: schema ya estaba al día');
    } else {
      console.log(
        `✅ Migraciones: batch #${batchNo}, ` +
        `${migrations.length} aplicadas (${migrations.join(', ')})`
      );
    }
  } catch (error) {
    console.error('❌ Error corriendo migraciones:', error.message);
    throw error;
  } finally {
    await knex.destroy();
  }

  console.log(`\n🎉 Base de datos de test lista: ${TEST_DB_NAME}\n`);
}

// Si el script se ejecuta directamente (no importado), corre setup.
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === __filename;
  } catch {
    return false;
  }
})();

if (isMain) {
  setupTestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Setup falló:', err);
      process.exit(1);
    });
}

export default setupTestDb;
