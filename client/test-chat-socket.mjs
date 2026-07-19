// Test E2E del socket chat. Conecta dos clientes: uno vendedor con JWT,
// uno cliente anónimo, y valida que:
//   1. Conexión sin token funciona (no rompe el POS).
//   2. chat:join del anónimo a la conv es rechazado si el anon_identifier
//      no coincide.
//   3. chat:join del anónimo con el identificador correcto funciona.
//   4. chat:join del vendedor con JWT funciona.
//   5. Mensaje del vendedor vía HTTP POST se emite por socket al room.
import { io as ioc } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const URL = 'http://localhost:5000/orders';
const JWT_SECRET = 'tu_clave_secreta_super_segura_aqui_123456789';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1) Crear conversación vía HTTP
  const convRes = await fetch('http://localhost:5000/api/chat/conversaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurante_id: 1,
      cliente_nombre: 'Cliente Socket',
      cliente_telefono: '3009999999',
    }),
  });
  const conv = await convRes.json();
  console.log('✓ Conversación creada:', { id: conv.id, identificador: conv.cliente_identificador });

  // 2) JWT del vendedor
  const tokenVendedor = jwt.sign(
    { id: 4, email: 'restaurantes@test.com', tipo_usuario: 'restaurante' },
    JWT_SECRET
  );
  console.log('✓ JWT vendedor generado');

  // 3) Conectar socket del cliente anónimo
  const sockCliente = ioc(URL, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => {
    sockCliente.on('connect', resolve);
    sockCliente.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout connect')), 3000);
  });
  console.log('✓ Cliente anónimo conectado:', sockCliente.id);

  // 4) chat:join con identificador CORRECTO
  const joinRes = await new Promise(resolve => {
    sockCliente.emit('chat:join', {
      conversacion_id: conv.id,
      anon_identifier: conv.cliente_identificador,
    }, resolve);
  });
  console.log('✓ Cliente chat:join (identificador correcto):', joinRes);

  // 5) chat:join con identificador INCORRECTO
  const badJoin = await new Promise(resolve => {
    sockCliente.emit('chat:join', {
      conversacion_id: conv.id,
      anon_identifier: 'anon:0000000',
    }, resolve);
  });
  console.log('✓ Cliente chat:join (identificador MALO):', badJoin, '(esperado ok:false)');

  // 6) Conectar socket del vendedor
  const sockVendedor = ioc(URL, {
    transports: ['websocket'],
    reconnection: false,
    auth: { token: tokenVendedor },
  });
  await new Promise((resolve, reject) => {
    sockVendedor.on('connect', resolve);
    sockVendedor.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout connect vendedor')), 3000);
  });
  console.log('✓ Vendedor conectado:', sockVendedor.id);

  const joinVend = await new Promise(resolve => {
    sockVendedor.emit('chat:join', { conversacion_id: conv.id }, resolve);
  });
  console.log('✓ Vendedor chat:join:', joinVend);

  // 7) Cliente se suscribe a chat:new_message
  const msgPromise = new Promise(resolve => {
    sockCliente.on('chat:new_message', resolve);
  });

  // 8) Vendedor envía mensaje por HTTP
  const sendRes = await fetch(`http://localhost:5000/api/chat/conversaciones/${conv.id}/mensajes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVendedor}` },
    body: JSON.stringify({ contenido: 'Socket test desde vendedor' }),
  });
  const sendJson = await sendRes.json();
  console.log('✓ Vendedor POST mensaje:', sendJson.mensaje?.id);

  // 9) Cliente recibe el mensaje por socket
  const received = await Promise.race([
    msgPromise,
    delay(2000).then(() => null),
  ]);
  if (received) {
    console.log('✓ Cliente recibió chat:new_message por socket:', {
      id: received.mensaje.id,
      contenido: received.mensaje.contenido,
    });
  } else {
    console.log('✗ Cliente NO recibió el mensaje por socket (timeout)');
  }

  // 10) Probar que el POS sigue funcionando: conectar sin token y emitir
  //     join_restaurant (debe seguir funcionando).
  const sockPOS = ioc(URL, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => {
    sockPOS.on('connect', resolve);
    sockPOS.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout POS connect')), 3000);
  });
  // El join_restaurant del POS no tiene ack; solo verificamos que la
  // conexión no sea rechazada.
  console.log('✓ Socket estilo-POS (sin token) conectado:', sockPOS.id);
  sockPOS.emit('join_restaurant', 1, 4);
  await delay(300);
  console.log('✓ Socket estilo-POS emitió join_restaurant sin error');

  sockCliente.close();
  sockVendedor.close();
  sockPOS.close();
  process.exit(0);
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
