import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { clearDatabase, seedTestData } from './test-helper.js';

test('Product Integration Tests', async (t) => {
  await clearDatabase();
  await seedTestData();

  // Generate token for seeded admin
  const adminToken = jwt.sign(
    { id: 1, role: 'admin' }, // Assuming ID 1 is the admin from seed l la base de datos
    process.env.JWT_SECRET || 'tu_clave_secreta_super_segura_aqui_123456789_cambiar_en_produccion'
  );

  await t.test('GET /api/products - should return a list of products', async () => {
    const response = await request(app).get('/api/products');
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.body));
  });

  await t.test('POST /api/products - should create a new product as admin', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        restaurante_id: 1,
        nombre: 'Test Burger',
        descripcion: 'Delicious test burger',
        precio: 10.50
      });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.producto.nombre, 'Test Burger');
  });

  await t.test('GET /api/products/:id - should return 404 for non-existent product', async () => {
    const response = await request(app).get('/api/products/9999');
    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Producto no encontrado');
  });

  await t.test('DELETE /api/products/:id - should return 403 for non-admin user', async () => {
    // Generate a client token
    const clientToken = jwt.sign({ id: 2, role: 'cliente' }, process.env.JWT_SECRET || '...');

    const response = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${clientToken}`);

    assert.strictEqual(response.status, 403);
  });
});
