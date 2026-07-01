import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { clearDatabase, seedTestData } from './test-helper.js';
import setupTestDb from './setup-test-db.js';

test('Product Integration Tests', async (t) => {
  // setupTestDb dropea/crea la DB y corre las migraciones Knex.
  // clearDatabase + seedTestData dejan el estado limpio con admin y
  // restaurante seedeados.
  await setupTestDb();
  await clearDatabase();
  const seed = await seedTestData();

  // Tokens JWT firmados con la misma clave que el middleware:
  //   - adminToken     → id 1 (admin seedeado)
  //   - restaurantToken → id del user restaurante seedeado
  //   - clientToken    → id del user cliente seedeado
  //
  // El middleware decodifica el JWT y carga `req.user.tipo_usuario` de
  // la DB. Por eso firmamos con el id del user creado por seed.
  const jwtSecret =
    process.env.JWT_SECRET ||
    'tu_clave_secreta_super_segura_aqui_123456789_cambiar_en_produccion';

  const adminToken = jwt.sign({ id: seed.adminId, role: 'admin' }, jwtSecret);
  const restaurantToken = jwt.sign(
    { id: seed.restUserId, role: 'restaurante' },
    jwtSecret
  );
  const clientToken = jwt.sign(
    { id: 3, role: 'cliente' },
    jwtSecret
  );

  await t.test('GET /api/products - should return a list of products (object with productos array)', async () => {
    // La shape real del endpoint es { total, productos: [...] }, no
    // un array directo como asumía la versión vieja.
    const response = await request(app).get('/api/products');

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.body.productos), 'body.productos should be an array');
    assert.strictEqual(typeof response.body.total, 'number');
  });

  await t.test('POST /api/products - should create a new product as restaurant owner', async () => {
    // El controller exige `req.user.tipo_usuario === 'restaurante'`
    // y obtiene el restaurante_id del JWT (no del body). Antes este
    // test usaba admin y esperaba `body.producto.nombre`, lo que no
    // matcheaba: admin devuelve 403, y la respuesta real es
    // `{ mensaje, producto_id }`, no `{ producto: { nombre } }`.
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({
        nombre: 'Test Burger',
        descripcion: 'Delicious test burger',
        precio: 10.50,
      });

    assert.strictEqual(response.status, 201);
    assert.ok(response.body.producto_id, 'response should have producto_id');
    assert.ok(response.body.mensaje, 'response should have a mensaje');
  });

  await t.test('GET /api/products/:id - should return 404 for non-existent product', async () => {
    const response = await request(app).get('/api/products/9999');

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, 'Producto no encontrado');
  });

  await t.test('DELETE /api/products/:id - should return 403 for a non-restaurant (cliente) user', async () => {
    // El controller exige rol 'restaurante' (los clientes NO pueden
    // eliminar productos; el 403 es coherente con la autorización).
    const response = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${clientToken}`);

    assert.strictEqual(response.status, 403);
  });
});
