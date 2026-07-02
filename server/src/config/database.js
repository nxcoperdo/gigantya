import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Crear pool de conexiones a MySQL optimizado para producción
 *
 * Optimizaciones:
 * - connectionLimit aumentado para mejor throughput
 * - namedPlaceholders para queries más legibles
 * - dateStrings para evitar conversiones de zona horaria
 * - supportBigNumbers según necesidad
 */
const isProduction = process.env.NODE_ENV === 'production';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.NODE_ENV === 'test'
    ? 'restaurante_pedidos_test'
    : (process.env.DB_NAME || 'restaurante_pedidos_gigantya'),
  waitForConnections: true,
  // En producción usar más conexiones (basado en CPU cores)
  connectionLimit: isProduction ? 20 : 10,
  queueLimit: 0,
  // Reutilizar conexiones idle
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Charset correcto
  charset: 'utf8mb4',
  // Para evitar problemas de zona horaria:
  // - dateStrings: false → mysql2 devuelve objetos Date en vez de strings.
  // - timezone: 'America/Bogota' → el driver sabe en qué zona está el
  //   servidor MySQL y ajusta correctamente la conversión al parsear
  //   TIMESTAMP/DATETIME. Combinado con `process.env.TZ='America/Bogota'`
  //   en server.js, evita los off-by-5h que se veían antes.
  dateStrings: false,
  timezone: 'America/Bogota',
  // Permitir placeholders nombrados (más legibles)
  namedPlaceholders: false,
  // Decimal como string para evitar pérdida de precisión
  // (en este caso lo desactivamos para que nos devuelva number directamente)
  decimalNumbers: true,
});

/**
 * Probar conexión a la base de datos
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL exitosa');
    await connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
}

/**
 * Ejecutar query
 * @param {string} sql - Consulta SQL
 * @param {array} params - Parámetros para prepared statement
 * @returns {Promise<array>} Resultados
 */
export async function query(sql, params = []) {
  const start = Date.now();
  try {
    const [results] = await pool.query(sql, params);
    // Log de queries lentas (>500ms) en desarrollo
    if (!isProduction) {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`⚠️ Slow query (${duration}ms):`, sql.substring(0, 100));
      }
    }
    return results;
  } catch (error) {
    console.error('Error en query:', error);
    throw error;
  }
}

/**
 * Obtener una columna (primera fila)
 */
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

/**
 * Obtener conexión del pool para transacciones
 */
export async function getConnection() {
  return await pool.getConnection();
}

/**
 * Cerrar el pool (útil para tests y graceful shutdown)
 */
export async function closePool() {
  await pool.end();
}

export default pool;
