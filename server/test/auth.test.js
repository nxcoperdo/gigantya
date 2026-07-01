import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { clearDatabase, seedTestData } from './test-helper.js';
import setupTestDb from './setup-test-db.js';

// 🔑 SOLUCIÓN AL ERROR DE JWT: Forzar un secreto de prueba si no viene en las variables de entorno
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_de_prueba_para_jwt_123';

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
                contrasena: 'password123' // 🛠️ Corregido: 'password' cambiado a 'contrasena'
            });

        assert.strictEqual(response.status, 200);
        assert.ok(response.body.token, 'response should have a JWT token');
        assert.ok(response.body.usuario, 'response should have a usuario object');
        assert.strictEqual(response.body.usuario.nombre, 'testadmin');
        assert.strictEqual(response.body.usuario.email, 'admin@test.com');
    });

    await t.test('POST /api/auth/login - should return 401 for incorrect password', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@test.com',
                contrasena: 'wrongpassword' // 🛠️ Corregido: 'password' cambiado a 'contrasena'
            });

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
                contrasena: 'password123' // 🛠️ Corregido: 'password' cambiado a 'contrasena'
            });

        assert.strictEqual(response.status, 401);
        assert.ok(
            response.body.error.toLowerCase().includes('credencial'),
            `expected error to mention credentials, got: ${response.body.error}`
        );
    });

    await t.test('POST /api/auth/register - should register a new client successfully', async () => {
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
                email: 'admin@test.com',
                telefono: '3009999999',
                contrasena: 'password123',
                contrasena_confirmacion: 'password123',
                direccion: 'Calle 6 #12-45',
                ciudad: 'Gigante, Huila',
                latitud: 2.3870,
                longitud: -75.6798,
            });

        assert.strictEqual(response.status, 409);
        assert.ok(
            response.body.error.toLowerCase().includes('ya'),
            `expected error to mention "ya" (already), got: ${response.body.error}`
        );
    });
});
