import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import pool from '../src/config/database.js';
import * as CouponModel from '../src/models/Coupon.js';
import * as OrderModel from '../src/models/Order.js';

async function testCouponCheckout() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     TEST: Cupones en Checkout                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const conn = await pool.getConnection();

  try {
    // 1. Crear un cupón de prueba
    console.log('📝 Creando cupón de prueba...');
    const cuponCodigo = 'DESCUENTO10';
    await conn.query('DELETE FROM cupones WHERE codigo = ?', [cuponCodigo]);

    const cuponId = await CouponModel.createCoupon({
      restaurante_id: 1,
      codigo: cuponCodigo,
      descuento: 10,
      tipo_descuento: 'porcentaje',
      min_compra: 0,
      usos_maximos: 100,
    });
    console.log(`✅ Cupón creado con ID: ${cuponId}\n`);

    // 2. Validar el cupón
    console.log('🔍 Validando cupón...');
    const cuponValidado = await CouponModel.validateCoupon(cuponCodigo, 1, 50000);
    console.log('✅ Cupón válido:', {
      codigo: cuponValidado.codigo,
      descuento: cuponValidado.descuento,
      tipo_descuento: cuponValidado.tipo_descuento,
    });
    console.log('');

    // 3. Calcular total con descuento
    console.log('🧮 Calculando total con descuento...');
    const itemsSimulados = [
      { producto_id: 1, cantidad: 2, precio_unitario: 25000 }
    ];
    const subtotal = itemsSimulados.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);
    console.log(`   Subtotal: $${subtotal.toLocaleString('es-CO')}`);

    const descuento = subtotal * (cuponValidado.descuento / 100);
    console.log(`   Descuento (10%): -$${descuento.toLocaleString('es-CO')}`);

    const total = (subtotal - descuento) * 1.08;
    console.log(`   Total con impuestos: $${total.toLocaleString('es-CO')}`);
    console.log('');

    // 4. Crear pedido con cupón
    console.log('📦 Creando pedido con cupón...');
    const pedidoData = {
      usuario_id: 1,
      restaurante_id: 1,
      items: itemsSimulados,
      notas: 'Pedido de prueba con cupón',
      direccion_entrega: 'Calle 123 #45-67',
      telefono_contacto: '3001234567',
      coupon_id: cuponId,
      metodo_pago: 'contra_entrega',
    };

    const pedidoId = await OrderModel.createOrderWithItems(pedidoData);
    console.log(`✅ Pedido creado con ID: ${pedidoId}`);

    // 5. Verificar pedido
    console.log('\n🔍 Verificando pedido guardado...');
    const pedido = await OrderModel.getOrderById(pedidoId);
    console.log('   Pedido:', {
      id: pedido.id,
      total: pedido.total,
      cupon_codigo: pedido.cupon_codigo,
      descuento_calculado: pedido.descuento,
    });

    // 6. Validar que el descuento se guardó correctamente
    console.log('\n✅ VALIDACIONES:');
    console.log(`   - Cupón guardado: ${pedido.cupon_codigo === cuponCodigo ? '✅' : '❌'}`);
    console.log(`   - Descuento aplicado: ${pedido.descuento > 0 ? '✅' : '❌'} ($${pedido.descuento.toLocaleString('es-CO')})`);
    console.log(`   - Total correcto: ${Math.abs(pedido.total - total) < 1 ? '✅' : '❌'} (esperado: $${total.toLocaleString('es-CO')}, obtenido: $${pedido.total.toLocaleString('es-CO')})`);

    // 7. Verificar que el uso del cupón se registró
    const [cuponActualizado] = await conn.query('SELECT usos_actuales FROM cupones WHERE id = ?', [cuponId]);
    console.log(`   - Uso registrado: ${cuponActualizado[0]?.usos_actuales > 0 ? '✅' : '❌'} (usos: ${cuponActualizado[0]?.usos_actuales})`);

    // Limpieza
    console.log('\n🧹 Limpiando...');
    await conn.query('DELETE FROM items_pedido WHERE pedido_id = ?', [pedidoId]);
    await conn.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);
    await conn.query('DELETE FROM cupones WHERE codigo = ?', [cuponCodigo]);
    console.log('✅ Limpieza completada');

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              TEST COMPLETADO                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    conn.release();
  }
}

testCouponCheckout();
