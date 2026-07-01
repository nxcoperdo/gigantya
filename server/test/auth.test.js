import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { clearDatabase, seedTestData } from './test-helper.js';
import setupTestDb from './setup-test-db.js';

test('Auth Integration Tests', async (t) => {
  // Asegurar que la DB de test existe y tiene el esquema (dropea + crea
  // + corre migraciones Knex). Es idempotente.
  await setupTestDb();

  // Preparar la base de datos antes de todos los tests de este grupo
  await clearDatabase();
  await seedTestData();

  await t.test('POST /api/auth/login - should login successfully with correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });

    assert.strictEqual(response.status, 200);
    assert.ok(response.body.token, 'response should have a JWT token');
    // El controller real devuelve `usuario: { id, nombre, email, tipo_usuario }`
    // (no `user.username` como tenía la versión vieja).
    assert.ok(response.body.usuario, 'response should have a usuario object');
    assert.strictEqual(response.body.usuario.nombre, 'testadmin');
    assert.strictEqual(response.body.usuario.email, 'admin@test.com');
  });

  await t.test('POST /api/auth/login - should return 401 for incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'wrongpassword'
      });

    // El controller devuelve "Credenciales inválidas" (con i acentuada).
    assert.strictEqual(response.status, 401);
    assert.ok(
      response.body.error.toLowerCase().includes('credencial'),
      `expected error to mention credentials, got: ${response.body.error}`
    );
  });

  await t.test('POST /api/auth/login - should return 401 for non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'password123'
      });

    assert.strictEqual(response.status, 401);
    assert.ok(
      response.body.error.toLowerCase().includes('credencial'),
      `expected error to mention credentials, got: ${response.body.error}`
    );
  });

  await t.test('POST /api/auth/register - should register a new client successfully', async () => {
    // El register real exige:
    //   - nombre (no "username")
    //   - direccion (calle/carrera/número)
    //   - barrio_id (del catálogo sectores/barrios) O coordenadas
    //
    // Para el test, mandamos coordenadas válidas para evitar tener que
    // sembrar barrios. El controller acepta (barrio_id || lat+lng) como
    // par de selección de dirección.
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'New User',
        email: 'newuser@test.com',
        telefono: '3001234567',
        contrasena: 'password123',
        contrasena_confirmacion: 'password123',
        direccion: 'Calle 5 #12-45',
        ciudad: 'Gigante, Huila',
        latitud: 2.3869,
        longitud: -75.6797,
      });

    assert.strictEqual(response.status, 201);
    assert.ok(response.body.token, 'response should have a JWT token');
    assert.ok(response.body.usuario, 'response should have a usuario object');
    assert.strictEqual(response.body.usuario.nombre, 'New User');
    assert.strictEqual(response.body.usuario.email, 'newuser@test.com');
  });

  await t.test('POST /api/auth/register - should return 409 if email already exists', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Another',
        email: 'admin@test.com', // ya existe del seed
        telefono: '3009999999',
        contrasena: 'password123',
        contrasena_confirmacion: 'password123',
        direccion: 'Calle 6 #12-45',
        ciudad: 'Gigante, Huila',
        latitud: 2.3870,
        longitud: -75.6798,
      });

    // El controller devuelve 409 (no 400 como tenía el test viejo)
    // y un mensaje que dice "ya está registrado".
    assert.strictEqual(response.status, 409);
    assert.ok(
      response.body.error.toLowerCase().includes('ya'),
      `expected error to mention "ya" (already), got: ${response.body.error}`
    );
  });
});
