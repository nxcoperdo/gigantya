import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: './.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restaurante_pedidos_gigantya',
});

const [productos] = await pool.query('SELECT id, nombre, precio, categoria_id FROM productos WHERE estado = "activo" LIMIT 10');
console.log('Productos activos:');
console.table(productos);

const [categorias] = await pool.query('SELECT id, nombre FROM categorias');
console.log('\nCategorías:');
console.table(categorias);

pool.end();
