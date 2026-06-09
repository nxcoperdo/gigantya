import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { clearDatabase, seedTestData } from './test-helper.js';
import setupTestDb from './setup-test-db.js';

test('Auth Integration Tests', async (t) => {
  // Asegurar que la DB de test existe y tiene el esquema
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
    assert.ok(response.body.token);
    assert.strictEqual(response.body.user.username, 'testadmin');
  });

  await t.test('POST /api/auth/login - should return 401 for incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'wrongpassword'
      });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error, 'Credenciales incorrectas');
  });

  await t.test('POST /api/auth/login - should return 401 for non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'password123'
      });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error, 'Credenciales incorrectas');
  });

  await t.test('POST /api/auth/register - should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'password123'
      });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.user.username, 'newuser');
  });

  await t.test('POST /api/auth/register - should return 400 if email already exists', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'another',
        email: 'admin@test.com',
        password: 'password123'
      });

    assert.strictEqual(response.status, 400);
    assert.ok(response.body.error.toLowerCase().includes('ya existe'));
  });
});
