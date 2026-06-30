import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function setupTestDb() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  let connection;

  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a MySQL para setup');

    // Intentar usar la DB de test. Si no existe, lanzará error y el usuario sabrá que debe crearla.
    await connection.query('USE restaurante_pedidos_test');
    console.log('✅ Base de datos de prueba seleccionada: restaurante_pedidos_test');

    // El schema vive en <repo-root>/database/schema.sql, pero este script
    // se ejecuta desde <repo-root>/server, así que subimos dos niveles.
    const schemaPath = path.resolve('..', '..', 'database', 'schema.sql');
    let schema = await fs.readFile(schemaPath, 'utf8');

    // Eliminar líneas de CREATE DATABASE y USE para evitar interferir con nuestra DB de test
    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS .*;\\n?/gi, '');
    schema = schema.replace(/USE .*;\\n?/gi, '');

    await connection.query(schema);
    console.log('✅ Esquema de base de datos aplicado correctamente');

  } catch (error) {
    console.error('❌ Error en setup de DB de prueba:', error);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('👉 POR FAVOR: Crea la base de datos "restaurante_pedidos_test" en tu servidor MySQL y dale permisos al usuario de la aplicación.');
    }
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

export default setupTestDb;
