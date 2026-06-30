import { query } from '../src/config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Limpia todas las tablas de la base de datos para asegurar un estado limpio entre tests.
 * El orden es importante debido a las claves foráneas.
 */
export async function clearDatabase() {
  const tables = [
    'order_items',
    'orders',
    'ratings',
    'notifications',
    'favoritos',
    'addresses',
    'search_history',
    'preferences',
    'products',
    'categories',
    'restaurants',
    'users'
  ];

  try {
    // Deshabilitar chequeo de llaves foráneas para limpiar tablas rápidamente
    await query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      await query(`TRUNCATE TABLE ${table}`);
    }

    await query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🧪 Base de datos de prueba limpiada');
  } catch (error) {
    console.error('❌ Error limpiando la base de datos:', error);
    throw error;
  }
}

/**
 * Inserta datos mínimos necesarios para que los tests funcionen
 */
export async function seedTestData() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);
    // Insertar un usuario administrador base
    await query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['testadmin', 'admin@test.com', hashedPassword, 'admin']
    );

    // Insertar un restaurante base
    await query(
      'INSERT INTO restaurants (name, description, address, phone) VALUES (?, ?, ?, ?)',
      ['Test Restaurant', 'Best food', 'Test Street 123', '123456789']
    );

    console.log('🌱 Datos de prueba insertados');
  } catch (error) {
    console.error('❌ Error insertando datos de prueba:', error);
    throw error;
  }
}
