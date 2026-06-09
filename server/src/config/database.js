import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Crear pool de conexiones a MySQL
 * Esto permite reutilizar conexiones de forma eficiente
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.NODE_ENV === 'test' ? 'restaurante_pedidos_test' : (process.env.DB_NAME || 'restaurante_pedidos_gigantya'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('Error en query:', error);
    throw error;
  }
}

/**
 * Obtener una columna
 */
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

export default pool;

