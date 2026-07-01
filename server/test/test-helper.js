import { query, queryOne } from '../src/config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Tablas a truncar para limpiar estado entre tests.
 *
 * Los nombres coinciden con los que crean las migraciones Knex
 * (server/migrations/*.js) — NO con nombres en inglés. Antes este
 * helper usaba nombres como `order_items`/`users` que no existen en
 * la DB real y reventaba clearDatabase().
 *
 * El orden es importante: primero las hijas, después las padres, por
 * las FKs con CASCADE. SET FOREIGN_KEY_CHECKS=0/1 evita errores
 * residuales si quedó alguna referencia colgante.
 */
const TABLES_IN_FK_ORDER = [
  // Hijas de pedidos / productos / restaurantes
  'items_pedido',
  'historial_pedidos',
  'comprobantes_pago',
  'calificaciones',
  'cupones_usados',
  'favoritos',
  // Direcciones del usuario
  'direcciones',
  // Productos / categorías
  'productos',
  'producto_imagenes',
  'categorias',
  // Restaurantes
  'restaurantes',
  // Cupones (FK laxa a restaurantes, sin ON DELETE)
  'cupones',
  // Pedidos
  'pedidos',
  // Notificaciones / suscripciones / tokens cuelgan de usuarios
  'notificaciones',
  'suscripciones',
  'password_reset_tokens',
  // Barrios → sectores
  'barrios',
  'historial_busquedas',
  'sectores',
  'restaurante_envios_sector',
  // Tablas padre
  'usuarios',
];

/**
 * Limpia todas las tablas para asegurar estado limpio entre tests.
 * Si una tabla no existe todavía (ej. tests de funciones puras que
 * no llamaron a setupTestDb), se ignora y se sigue.
 */
export async function clearDatabase() {
  try {
    await query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES_IN_FK_ORDER) {
      try {
        await query(`TRUNCATE TABLE \`${table}\``);
      } catch (err) {
        // Tabla no existe aún (tests sin migraciones corridas):
        // ignorar y seguir con la siguiente.
        if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
      }
    }
    await query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🧪 Base de datos de prueba limpiada');
  } catch (error) {
    console.error('❌ Error limpiando la base de datos:', error);
    throw error;
  }
}

/**
 * Inserta datos mínimos necesarios para los tests de integración.
 *
 * El schema real (migraciones Knex) usa nombres en español y
 * columnas específicas — no `users.username` ni `users.role` como
 * tenía la versión vieja de este helper, que ya no se correspondía
 * con la DB.
 *
 * Crea tres usuarios con la password `password123`:
 *   - admin@test.com      → tipo_usuario = 'admin'      (id 1)
 *   - restaurante@test.com → tipo_usuario = 'restaurante' (id 2)
 *   - cliente@test.com    → tipo_usuario = 'cliente'    (id 3)
 *
 * Para el restaurante crea también su fila en `restaurantes` (vinculada
 * por `usuario_id` al user de tipo restaurante). Los tests pueden usar
 * el id 1 de ese restaurante.
 *
 * Devuelve un objeto con los IDs por si algún test los quiere.
 */
export async function seedTestData() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // INSERT idempotente: si ya existe un usuario con ese email (re-run
    // del mismo test), IGNORAR en lugar de tirar DUP_ENTRY. Esto permite
    // re-ejecutar seedTestData() sin truncar primero.
    await query(
      `INSERT IGNORE INTO usuarios
         (nombre, email, telefono, contrasena_hash, tipo_usuario,
          documento_identidad, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      ['testadmin', 'admin@test.com', '3000000000', hashedPassword, 'admin', '1000000001']
    );

    const adminRow = await queryOne(
      `SELECT id FROM usuarios WHERE email = 'admin@test.com' LIMIT 1`
    );
    const adminId = adminRow?.id || 1;

    await query(
      `INSERT IGNORE INTO usuarios
         (nombre, email, telefono, contrasena_hash, tipo_usuario,
          documento_identidad, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      ['testrestaurante', 'restaurante@test.com', '3000000001', hashedPassword, 'restaurante', '1000000002']
    );

    const restUserRow = await queryOne(
      `SELECT id FROM usuarios WHERE email = 'restaurante@test.com' LIMIT 1`
    );
    const restUserId = restUserRow?.id || 2;

    await query(
      `INSERT IGNORE INTO usuarios
         (nombre, email, telefono, contrasena_hash, tipo_usuario,
          documento_identidad, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      ['testcliente', 'cliente@test.com', '3000000002', hashedPassword, 'cliente', '1000000003']
    );

    // Restaurante asociado al usuario de tipo restaurante. Acepta
    // valores mínimos: nombre, usuario_id, plan, estado.
    await query(
      `INSERT IGNORE INTO restaurantes
         (usuario_id, nombre, descripcion, direccion, telefono, ciudad,
          estado, aprobado, plan, calificacion)
       VALUES (?, ?, ?, ?, ?, ?, 'activo', TRUE, 'profesional', 5.00)`,
      [
        restUserId,
        'Test Restaurant',
        'Restaurante de prueba',
        'Calle 1 #1-01',
        '3000000001',
        'Gigante, Huila',
      ]
    );

    const restRow = await queryOne(
      `SELECT id FROM restaurantes WHERE usuario_id = ? LIMIT 1`,
      [restUserId]
    );
    const restauranteId = restRow?.id || 1;

    console.log(
      `🌱 Datos de prueba insertados (admin=${adminId}, ` +
      `restaurante_usuario=${restUserId}, restaurante_id=${restauranteId})`
    );

    return { adminId, restUserId, restauranteId };
  } catch (error) {
    console.error('❌ Error insertando datos de prueba:', error);
    throw error;
  }
}
