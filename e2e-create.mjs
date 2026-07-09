import { query, closePool } from './src/config/database.js';

// Simulamos exactamente lo que crea un pedido de cliente con es_retiro_local=true
// (el código de Order.js líneas 612-613 setea esRetiroLocal ? 1 : 0 y esConsumoEnLocal ? 1 : 0).
// Como las columnas son TINYINT, los 1/0 funcionan; y como mesa_id y creado_por son NULL
// por default, el insert no requiere esos campos.

const productos = await query(`SELECT id, nombre, precio FROM productos WHERE disponible = 1 LIMIT 2`);
console.log('Productos disponibles:', productos.length);
if (productos.length === 0) {
  console.log('Sin productos — fin del test');
  await closePool();
  process.exit(0);
}

const usuario = await query(`SELECT id FROM usuarios WHERE email = 'ensayosnicolas@gmail.com' LIMIT 1`);
const restaurante = await query(`SELECT id FROM restaurantes LIMIT 1`);
if (!usuario[0] || !restaurante[0]) {
  console.log('Faltan datos — fin del test');
  await closePool();
  process.exit(0);
}

const uid = usuario[0].id;
const rid = restaurante[0].id;

// 1) Crear pedido de prueba como CLIENTE (no POS): sin mesa_id, canal='web', creado_por=NULL.
const insert = await query(
  `INSERT INTO pedidos
    (usuario_id, restaurante_id, total, costo_envio, estado, metodo_pago,
     estado_validacion_pago, cupon_id, notas, direccion_entrega, telefono_contacto,
     barrio_id, sector_id, latitud, longitud, direccion_formateada, place_id,
     es_retiro_local, es_consumo_en_local)
   VALUES (?, ?, ?, 0, 'Pendiente', 'contra_entrega', 'aprobado',
           NULL, '', 'Test dir', '3001234567', NULL, NULL, NULL, NULL, NULL, NULL,
           1, 0)`,
  [uid, rid, 50000.00]
);
const pedidoId = insert.insertId;
console.log('Pedido creado con id:', pedidoId, '(cliente con es_retiro_local=1)');

const [verif] = await query(`SELECT id, canal, mesa_id, creado_por, es_retiro_local, es_consumo_en_local FROM pedidos WHERE id = ?`, [pedidoId]);
console.log('Verificación:', verif);

// 2) Crear pedido POS: con mesa_id, canal='pos', creado_por=mesero.
const mesero = await query(`SELECT id FROM usuarios WHERE email = 'mesero.demo@test.com' LIMIT 1`);
const mesa = await query(`SELECT id FROM mesas WHERE restaurante_id = ? LIMIT 1`, [rid]);
if (mesero[0] && mesa[0]) {
  const insert2 = await query(
    `INSERT INTO pedidos
      (usuario_id, restaurante_id, total, costo_envio, estado, metodo_pago,
       estado_validacion_pago, cupon_id, notas, direccion_entrega, telefono_contacto,
       barrio_id, sector_id, latitud, longitud, direccion_formateada, place_id,
       es_retiro_local, es_consumo_en_local, mesa_id, canal, creado_por)
     VALUES (NULL, ?, 35000.00, 0, 'Pendiente', 'contra_entrega', 'aprobado',
             NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
             0, 1, ?, 'pos', ?)`,
    [rid, mesa[0].id, mesero[0].id]
  );
  const pedidoPosId = insert2.insertId;
  const [v2] = await query(`SELECT id, canal, mesa_id, creado_por, es_consumo_en_local FROM pedidos WHERE id = ?`, [pedidoPosId]);
  console.log('Pedido POS:', v2);
}

// 3) Cleanup: borrar los pedidos de prueba.
await query(`DELETE FROM pedidos WHERE id IN (?, ?)`, [pedidoId, insert2?.insertId || 0]);
console.log('Limpieza OK');

await closePool();
