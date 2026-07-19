// Test rápido: aplica la migración y hace un round-trip INSERT/SELECT.
// Se corre con: node scripts/test-chat-migration.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, queryOne } from '../server/src/config/database.js';
import * as Conversacion from '../server/src/models/Conversacion.js';
import * as Mensaje from '../server/src/models/Mensaje.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, '..', 'database', 'migrations_manuales', '20260719000001_chat_fruver.sql'),
  'utf8'
);

function splitStatements(s) {
  // Strip comentarios y sentencias vacías. Para nuestro SQL (sin DELIMITER) alcanza.
  return s
    .split(/;\s*\n/)
    .map(s => s.replace(/^--.*$/gm, '').trim())
    .filter(s => s.length > 0 && !s.startsWith('SELECT') /* los SELECT info no se corren */);
}

async function main() {
  console.log('=== Aplicando migración ===');
  const stmts = splitStatements(sql);
  for (const stmt of stmts) {
    try {
      await query(stmt);
      console.log('  ✓', stmt.substring(0, 60).replace(/\n/g, ' '), '...');
    } catch (err) {
      // Idempotente: ignorar "already exists" si los chequeos IF NOT EXISTS fallan en MySQL viejo
      if (/already exists|Duplicate|1060|1061|1062|1091|1826|3730|3731/.test(err.message)) {
        console.log('  ↪ ya existe:', err.message.substring(0, 80));
        continue;
      }
      throw err;
    }
  }

  console.log('\n=== Verificando tablas ===');
  const tables = await query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('conversaciones','mensajes')`
  );
  console.log('  Tablas:', tables.map(t => t.TABLE_NAME));

  console.log('\n=== Verificando columna pedidos.origen ===');
  const col = await queryOne(
    `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'origen'`
  );
  console.log('  pedidos.origen:', col);

  console.log('\n=== Round-trip: crear conversación + mensaje ===');
  // Limpiar datos de prueba previos (idempotencia del test)
  await query(`DELETE FROM conversaciones WHERE cliente_identificador = 'anon:test-chat'`);

  const { id: convId, esNueva } = await Conversacion.getOrCreateForClient({
    restaurante_id: 4,
    cliente_identificador: 'anon:test-chat',
    cliente_nombre: 'Test Cliente',
    cliente_telefono: '3001234567',
  });
  console.log(`  Conversación creada: id=${convId}, esNueva=${esNueva}`);

  // Segunda llamada: debe devolver la misma (esNueva=false)
  const segunda = await Conversacion.getOrCreateForClient({
    restaurante_id: 4,
    cliente_identificador: 'anon:test-chat',
  });
  console.log(`  Segunda llamada: id=${segunda.id}, esNueva=${segunda.esNueva} (esperado false, mismo id)`);

  // Insertar mensaje del cliente
  const msgCliente = await Mensaje.append({
    conversacion_id: convId,
    emisor_tipo: 'cliente',
    contenido: 'Hola, tiene tomate?',
    adjuntos: { producto_id: 99, nombre: 'Tomate', precio: 3500 },
  });
  console.log(`  Mensaje cliente: id=${msgCliente.id}, adjuntos_json=${msgCliente.adjuntos_json}`);

  // Insertar mensaje del vendedor
  const msgVendedor = await Mensaje.append({
    conversacion_id: convId,
    emisor_tipo: 'vendedor',
    emisor_usuario_id: 1, // placeholder
    contenido: 'Sí, ¿cuántas libras?',
  });
  console.log(`  Mensaje vendedor: id=${msgVendedor.id}`);

  // Listar
  const lista = await Mensaje.listByConversacion(convId, { direction: 'asc' });
  console.log(`  Listado (${lista.length} mensajes):`, lista.map(m => `[${m.emisor_tipo}] ${m.contenido}`));

  // touch + markRead
  await Conversacion.touchUltimo(convId);
  await Mensaje.markReadByOther(convId, 'vendedor');
  const sinLeer = await Mensaje.countUnread(convId, 'vendedor');
  console.log(`  No leídos para vendedor tras markRead: ${sinLeer} (esperado 0)`);

  // Limpiar
  await query(`DELETE FROM conversaciones WHERE cliente_identificador = 'anon:test-chat'`);
  console.log('\n=== Limpieza OK ===');
  process.exit(0);
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
