/**
 * Test de Estadísticas - Simula un mes de pedidos para verificar las estadísticas
 *
 * Uso: node server/test/stats-test.js
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import * as StatsModel from '../src/models/Stats.js';

// Cargar variables de entorno explícitamente
dotenv.config({ path: './.env' });

console.log('📌 Usando configuración:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'root'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'restaurante_pedidos_gigantya'}\n`);

// Crear pool directamente con las variables cargadas
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restaurante_pedidos_gigantya',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Configuración
const RESTAURANTE_ID = 1; // Cambiar si es necesario
const DIAS_SIMULACION = 30;

// Datos de prueba
const ESTADOS = ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado'];
const METODOS_PAGO = ['contra_entrega', 'nequi', 'daviplata', 'bre_b'];

// Productos reales de la BD (verificar con check-products.js)
const PRODUCTOS = [
  { id: 1, nombre: 'Ajiaco Tolimense', precio: 25000 },
  { id: 2, nombre: 'Bandeja Paisa Adaptada', precio: 28000 },
  { id: 3, nombre: 'Lechona', precio: 35000 },
  { id: 4, nombre: 'Jugo de Lulo', precio: 6000 },
  { id: 5, nombre: 'Limonada Casera', precio: 5000 },
  { id: 8, nombre: 'burgeer', precio: 20000 },
];

// Clientes simulados - usamos el usuario admin/restaurante existente
const CLIENTES = [1, 2]; // IDs de usuarios existentes

/**
 * Genera una fecha aleatoria dentro de los últimos N días
 */
function fechaAleatoria(dias) {
  const ahora = new Date();
  const diasAtras = Math.floor(Math.random() * dias);
  const horasAtras = Math.floor(Math.random() * 24);
  const minutosAtras = Math.floor(Math.random() * 60);

  const fecha = new Date(ahora);
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(fecha.getHours() - horasAtras);
  fecha.setMinutes(fecha.getMinutes() - minutosAtras);

  return fecha;
}

/**
 * Genera un estado aleatorio con ponderación (más entregados)
 */
function estadoAleatorio() {
  const rand = Math.random();
  if (rand < 0.5) return 'Entregado';      // 50%
  if (rand < 0.7) return 'Pendiente';       // 20%
  if (rand < 0.85) return 'Preparando';     // 15%
  if (rand < 0.95) return 'Listo';          // 10%
  return 'Cancelado';                       // 5%
}

/**
 * Genera items aleatorios para un pedido
 */
function generarItems() {
  const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items
  const items = [];
  const usados = new Set();

  for (let i = 0; i < numItems; i++) {
    let producto;
    do {
      producto = PRODUCTOS[Math.floor(Math.random() * PRODUCTOS.length)];
    } while (usados.has(producto.id));

    usados.add(producto.id);
    const cantidad = Math.floor(Math.random() * 3) + 1;

    items.push({
      producto_id: producto.id,
      cantidad,
      precio_unitario: producto.precio,
      subtotal: producto.precio * cantidad
    });
  }

  return items;
}

/**
 * Crea un pedido de prueba en la base de datos
 */
async function crearPedidoDePrueba() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Generar datos del pedido
    const fecha = fechaAleatoria(DIAS_SIMULACION);
    const estado = estadoAleatorio();
    const metodoPago = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
    const clienteId = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
    const items = generarItems();

    // Calcular total
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Insertar pedido
    const [pedidoResult] = await conn.query(`
      INSERT INTO pedidos (
        usuario_id, restaurante_id, total, estado, metodo_pago,
        estado_validacion_pago, notas, direccion_entrega, telefono_contacto, creado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clienteId,
      RESTAURANTE_ID,
      total,
      estado,
      metodoPago,
      'aprobado',
      'Pedido de prueba - Stats Test',
      'Calle falsa 123',
      '3001234567',
      fecha.toISOString().slice(0, 19).replace('T', ' ')
    ]);

    const pedidoId = pedidoResult.insertId;

    // Insertar items
    for (const item of items) {
      await conn.query(`
        INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal, creado_en)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        pedidoId,
        item.producto_id,
        item.cantidad,
        item.precio_unitario,
        item.subtotal,
        fecha.toISOString().slice(0, 19).replace('T', ' ')
      ]);
    }

    await conn.commit();

    return {
      id: pedidoId,
      fecha,
      estado,
      metodoPago,
      total,
      items: items.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Limpieza - Elimina pedidos de prueba
 */
async function limpiarPedidosDePrueba() {
  console.log('\n🧹 Limpiando pedidos de prueba...');

  const [result] = await pool.query(`
    DELETE FROM pedidos
    WHERE restaurante_id = ? AND notas LIKE '%Pedido de prueba%'
  `, [RESTAURANTE_ID]);

  console.log(`   ✅ ${result.affectedRows} pedidos eliminados`);
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     TEST DE ESTADÍSTICAS - Simulación de Pedidos       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Paso 1: Limpieza previa
    await limpiarPedidosDePrueba();

    // Paso 2: Crear pedidos simulados
    const NUM_PEDIDOS = 50; // Cantidad de pedidos a simular
    console.log(`📦 Creando ${NUM_PEDIDOS} pedidos simulados...\n`);

    const pedidosCreados = [];
    for (let i = 0; i < NUM_PEDIDOS; i++) {
      const pedido = await crearPedidoDePrueba();
      pedidosCreados.push(pedido);

      if ((i + 1) % 10 === 0) {
        console.log(`   Progreso: ${i + 1}/${NUM_PEDIDOS} pedidos creados`);
      }
    }

    console.log(`\n✅ ${pedidosCreados.length} pedidos creados exitosamente\n`);

    // Resumen de pedidos creados
    const resumen = {
      total: pedidosCreados.length,
      entregados: pedidosCreados.filter(p => p.estado === 'Entregado').length,
      pendientes: pedidosCreados.filter(p => p.estado === 'Pendiente').length,
      cancelados: pedidosCreados.filter(p => p.estado === 'Cancelado').length,
      totalVentas: pedidosCreados
        .filter(p => p.estado === 'Entregado')
        .reduce((sum, p) => sum + p.total, 0)
    };

    console.log('📊 Resumen de pedidos creados:');
    console.log(`   Total: ${resumen.total}`);
    console.log(`   Entregados: ${resumen.entregados}`);
    console.log(`   Pendientes: ${resumen.pendientes}`);
    console.log(`   Cancelados: ${resumen.cancelados}`);
    console.log(`   Total Ventas (entregados): $${resumen.totalVentas.toLocaleString('es-CO')}\n`);

    // Paso 3: Probar estadísticas Básicas (Plan Profesional)
    console.log('═══════════════════════════════════════════════════════');
    console.log('📈 TEST: Estadísticas Básicas (Plan Profesional)');
    console.log('═══════════════════════════════════════════════════════\n');

    const basicStats = await StatsModel.getBasicStats(RESTAURANTE_ID);

    console.log('✅ Estadísticas Básicas obtenidas:\n');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ VENTAS                                  │');
    console.log('   ├─────────────────────────────────────────┤');
    console.log(`   │ Hoy:      $${basicStats.ventas.hoy.toLocaleString('es-CO').padStart(20)} │`);
    console.log(`   │ Semana:   $${basicStats.ventas.semana.toLocaleString('es-CO').padStart(20)} │`);
    console.log(`   │ Mes:      $${basicStats.ventas.mes.toLocaleString('es-CO').padStart(20)} │`);
    console.log('   └─────────────────────────────────────────┘\n');

    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ PEDIDOS                                 │');
    console.log('   ├─────────────────────────────────────────┤');
    console.log(`   │ Total:       ${String(basicStats.pedidos.total).padStart(21)} │`);
    console.log(`   │ Completados: ${String(basicStats.pedidos.completados).padStart(21)} │`);
    console.log(`   │ Cancelados:  ${String(basicStats.pedidos.cancelados).padStart(21)} │`);
    console.log(`   │ Pendientes:  ${String(basicStats.pedidos.pendientes).padStart(21)} │`);
    console.log('   └─────────────────────────────────────────┘\n');

    console.log(`   Ticket Promedio: $${basicStats.ticket_promedio.toLocaleString('es-CO')}\n`);

    console.log('   Productos Más Vendidos:');
    basicStats.productos_mas_vendidos?.slice(0, 5).forEach((prod, idx) => {
      console.log(`     ${idx + 1}. ${prod.nombre}: ${prod.cantidad_vendida} unidades`);
    });

    console.log('\n   Métodos de Pago:');
    basicStats.metodos_pago?.forEach(metodo => {
      console.log(`     - ${metodo.metodo_pago}: ${metodo.cantidad} pedidos (${metodo.porcentaje}%)`);
    });

    console.log('\n   Ventas Diarias (últimos 5 días):');
    basicStats.ventas_diarias?.slice(0, 5).forEach(dia => {
      const fecha = new Date(dia.fecha + 'T00:00:00');
      console.log(`     - ${fecha.toLocaleDateString('es-CO')}: $${dia.total_ventas.toLocaleString('es-CO')} (${dia.total_pedidos} pedidos)`);
    });

    // Paso 4: Probar estadísticas Premium
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('⭐ TEST: Estadísticas Premium (Plan Premium)');
    console.log('═══════════════════════════════════════════════════════\n');

    const premiumStats = await StatsModel.getPremiumStats(RESTAURANTE_ID);

    console.log('✅ Estadísticas Premium obtenidas:\n');

    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ HORARIOS                                │');
    console.log('   ├─────────────────────────────────────────┤');
    if (premiumStats.hora_pico?.hora != null) {
      console.log(`   │ Hora Pico: ${String(premiumStats.hora_pico.hora).padStart(2, '0')}:00 - ${String(premiumStats.hora_pico.hora + 1).padStart(2, '0')}:00 │`);
    } else {
      console.log('   │ Hora Pico: No hay datos                     │');
    }
    console.log('   └─────────────────────────────────────────┘\n');

    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ DÍAS RENTABLES                          │');
    console.log('   ├─────────────────────────────────────────┤');
    if (premiumStats.dia_mas_rentable?.dia) {
      console.log(`   │ Día con más ingresos: ${premiumStats.dia_mas_rentable.dia.padEnd(14)} │`);
    }
    console.log('   └─────────────────────────────────────────┘\n');

    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ EVOLUCIÓN DE VENTAS                     │');
    console.log('   ├─────────────────────────────────────────┤');
    console.log(`   │ Este mes:     $${String(premiumStats.evolucion_ventas.este_mes.total).padStart(16)} │`);
    console.log(`   │ Mes anterior: $${String(premiumStats.evolucion_ventas.mes_anterior.total).padStart(16)} │`);
    console.log(`   │ Crecimiento:  ${String(premiumStats.crecimiento_mensual + '%').padStart(20)} │`);
    console.log('   └─────────────────────────────────────────┘\n');

    console.log('   Clientes Recurrentes:');
    if (premiumStats.clientes_recurrentes?.length > 0) {
      premiumStats.clientes_recurrentes.slice(0, 5).forEach((cliente, idx) => {
        console.log(`     ${idx + 1}. ${cliente.nombre}: ${cliente.total_pedidos} pedidos, $${cliente.gasto_total.toLocaleString('es-CO')}`);
      });
    } else {
      console.log('     No hay clientes recurrentes');
    }

    console.log('\n   Clientes Nuevos vs Recurrentes:');
    premiumStats.clientes_nuevos_vs_recurrentes?.forEach(tipo => {
      console.log(`     - ${tipo.tipo_cliente}: ${tipo.cantidad} clientes`);
    });

    console.log('\n   Tendencias de Productos:');
    if (premiumStats.tendencias_productos?.length > 0) {
      premiumStats.tendencias_productos.slice(0, 5).forEach(prod => {
        console.log(`     - ${prod.nombre}: ${prod.tendencia} (${prod.variacion}%)`);
      });
    } else {
      console.log('     No hay datos de tendencias');
    }

    // Paso 5: Validaciones
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ VALIDACIONES');
    console.log('═══════════════════════════════════════════════════════\n');

    const validaciones = [
      {
        nombre: 'Ventas del mes > 0',
        paso: basicStats.ventas.mes > 0,
      },
      {
        nombre: 'Total pedidos > 0',
        paso: basicStats.pedidos.total > 0,
      },
      {
        nombre: 'Productos más vendidos tiene datos',
        paso: basicStats.productos_mas_vendidos?.length > 0,
      },
      {
        nombre: 'Métodos de pago tiene datos',
        paso: basicStats.metodos_pago?.length > 0,
      },
      {
        nombre: 'Ventas diarias tiene datos',
        paso: basicStats.ventas_diarias?.length > 0,
      },
      {
        nombre: 'Ticket promedio > 0',
        paso: basicStats.ticket_promedio > 0,
      },
      {
        nombre: 'Hora pico no es null/undefined',
        paso: premiumStats.hora_pico?.hora != null,
      },
      {
        nombre: 'Días rentables tiene datos',
        paso: premiumStats.dias_rentables?.length > 0,
      },
      {
        nombre: 'Evolución de ventas tiene datos',
        paso: premiumStats.evolucion_ventas?.este_mes?.total != null,
      },
    ];

    let aprobadas = 0;
    let fallidas = 0;

    validaciones.forEach((validacion, idx) => {
      const estado = validacion.paso ? '✅' : '❌';
      console.log(`   ${estado} ${idx + 1}. ${validacion.nombre}`);
      if (validacion.paso) aprobadas++;
      else fallidas++;
    });

    console.log(`\n   📊 Resultado: ${aprobadas}/${validaciones.length} validaciones aprobadas\n`);

    // Paso 6: Limpieza final
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧹 LIMPIEZA');
    console.log('═══════════════════════════════════════════════════════\n');

    const confirmarLimpieza = process.argv.includes('--cleanup');

    if (confirmarLimpieza) {
      await limpiarPedidosDePrueba();
      console.log('   ✅ Pedidos de prueba eliminados\n');
    } else {
      console.log('   ⚠️  Pedidos de prueba NO eliminados (usa --cleanup para eliminar)\n');
    }

    // Resultado final
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log(`║              TEST ${fallidas === 0 ? 'COMPLETADO' : 'FINALIZADO'}                     ║`);
    console.log('╚════════════════════════════════════════════════════════╝\n');

    if (fallidas > 0) {
      console.log(`⚠️  ${fallidas} validaciones fallidas. Revisa los resultados arriba.\n`);
      process.exit(1);
    } else {
      console.log('✅ ¡Todas las validaciones pasaron correctamente!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ ERROR DURANTE EL TEST:\n');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar test
main();
