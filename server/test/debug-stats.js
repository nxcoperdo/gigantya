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

const RESTAURANTE_ID = 1;

console.log('═══ DEBUG: Consultas de Estadísticas ═══\n');

// 1. Productos más vendidos
console.log('1️⃣ Productos Más Vendidos:');
const [productos] = await pool.query(`
  SELECT
    p.id,
    p.nombre,
    SUM(ip.cantidad) as cantidad_vendida,
    SUM(ip.subtotal) as ingresos_generados
  FROM items_pedido ip
  JOIN productos p ON ip.producto_id = p.id
  WHERE p.restaurante_id = ?
  GROUP BY p.id, p.nombre
  ORDER BY cantidad_vendida DESC
  LIMIT 10
`, [RESTAURANTE_ID]);
console.table(productos);

// 2. Métodos de pago
console.log('\n2️⃣ Métodos de Pago:');
const [metodos] = await pool.query(`
  SELECT
    metodo_pago,
    COUNT(*) as cantidad,
    COALESCE(SUM(total), 0) as total_ventas
  FROM pedidos
  WHERE restaurante_id = ? AND estado = 'Entregado' AND metodo_pago IS NOT NULL
  GROUP BY metodo_pago
  ORDER BY cantidad DESC
`, [RESTAURANTE_ID]);
console.table(metodos);

// 3. Ventas diarias
console.log('\n3️⃣ Ventas Diarias:');
const [ventasDiarias] = await pool.query(`
  SELECT
    DATE(creado_en) as fecha,
    COALESCE(SUM(total), 0) as total_ventas,
    COUNT(*) as total_pedidos
  FROM pedidos
  WHERE restaurante_id = ?
    AND creado_en >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
  GROUP BY DATE(creado_en)
  ORDER BY fecha ASC
`, [RESTAURANTE_ID]);
console.table(ventasDiarias);

// 4. Categorías más vendidas
console.log('\n4️⃣ Categorías Más Vendidas:');
const [categorias] = await pool.query(`
  SELECT
    c.nombre as categoria,
    SUM(ip.cantidad) as cantidad_vendida,
    COALESCE(SUM(ip.subtotal), 0) as ingresos_generados
  FROM items_pedido ip
  JOIN productos p ON ip.producto_id = p.id
  LEFT JOIN categorias c ON p.categoria_id = c.id
  WHERE p.restaurante_id = ?
  GROUP BY c.nombre
  ORDER BY cantidad_vendida DESC
  LIMIT 10
`, [RESTAURANTE_ID]);
console.table(categorias);

// 5. Verificar estructura de pedidos
console.log('\n5️⃣ Estructura de Pedidos (últimos 5):');
const [pedidos] = await pool.query(`
  SELECT id, restaurante_id, estado, metodo_pago, total, creado_en
  FROM pedidos
  WHERE restaurante_id = ?
  ORDER BY creado_en DESC
  LIMIT 5
`, [RESTAURANTE_ID]);
console.table(pedidos);

// 6. Verificar items_pedido
console.log('\n6️⃣ Items de Pedido (últimos 5):');
const [items] = await pool.query(`
  SELECT ip.id, ip.pedido_id, ip.producto_id, ip.cantidad, ip.precio_unitario, ip.subtotal, p.nombre as producto_nombre
  FROM items_pedido ip
  JOIN productos p ON ip.producto_id = p.id
  ORDER BY ip.creado_en DESC
  LIMIT 5
`, [RESTAURANTE_ID]);
console.table(items);

pool.end();
