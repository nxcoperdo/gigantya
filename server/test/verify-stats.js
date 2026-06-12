import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import * as StatsModel from '../src/models/Stats.js';

dotenv.config({ path: './.env' });

console.log('═══ TEST: Verificar estructura de datos de Stats ═══\n');

const RESTAURANTE_ID = 1;

const stats = await StatsModel.getBasicStats(RESTAURANTE_ID);

console.log('📦 Estructura de basicStats:\n');
console.log('ventas:', stats.ventas);
console.log('pedidos:', stats.pedidos);
console.log('ticket_promedio:', stats.ticket_promedio);

console.log('\n📦 productos_mas_vendidos (primer elemento):');
console.log(stats.productos_mas_vendidos?.[0]);

console.log('\n📦 metodos_pago (primer elemento):');
console.log(stats.metodos_pago?.[0]);

console.log('\n📦 ventas_diarias (primer elemento):');
console.log(stats.ventas_diarias?.[0]);

console.log('\n📦 categorias_mas_vendidas (primer elemento):');
console.log(stats.categorias_mas_vendidas?.[0]);

// Probar acceso a propiedades
console.log('\n📍 Prueba de acceso a propiedades:');
if (stats.productos_mas_vendidos?.[0]) {
  const p = stats.productos_mas_vendidos[0];
  console.log(`   nombre: "${p.nombre}"`);
  console.log(`   cantidad_vendida: ${p.cantidad_vendida}`);
  console.log(`   ingresos_generados: ${p.ingresos_generados}`);
} else {
  console.log('   No hay productos');
}

if (stats.metodos_pago?.[0]) {
  const m = stats.metodos_pago[0];
  console.log(`   metodo_pago: "${m.metodo_pago}"`);
  console.log(`   cantidad: ${m.cantidad}`);
  console.log(`   porcentaje: ${m.porcentaje}`);
} else {
  console.log('   No hay métodos de pago');
}
