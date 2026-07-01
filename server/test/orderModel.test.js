import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOrderTotal, normalizeOrderItems } from '../src/models/Order.js';

test('normalizeOrderItems groups duplicate products', () => {
  const items = normalizeOrderItems([
    { producto_id: 10, cantidad: 1, precio_unitario: 1 },
    { producto_id: '10', cantidad: 2, precio_unitario: 999 },
    { producto_id: 11, cantidad: '3' }
  ]);

  assert.deepEqual(items, [
    { producto_id: 10, cantidad: 3 },
    { producto_id: 11, cantidad: 3 }
  ]);
});

test('normalizeOrderItems rejects invalid quantities', () => {
  assert.throws(
    () => normalizeOrderItems([{ producto_id: 10, cantidad: 0 }]),
    /cantidad entera positiva/
  );
});

test('calculateOrderTotal ignores client prices when given server-priced items', () => {
  // 2 × 12.000 + 1 × 5.500 = 29.500 subtotal; impuestos 8% = 2.360 → total 31.860.
  // calculateOrderTotal devuelve un OBJETO con desglose, no un número.
  // Antes: `assert.equal(total, 31860)` — fallaba porque comparaba objeto
  // con número. Test puro (no toca DB) y por eso no necesita setupTestDb.
  const total = calculateOrderTotal([
    { producto_id: 10, cantidad: 2, precio_unitario: 12000 },
    { producto_id: 11, cantidad: 1, precio_unitario: 5500 }
  ]);

  assert.equal(total.total, 31860);
  assert.equal(total.subtotal, 29500);
  // Total = subtotal + impuestos (envío=0 cuando no se pasa costo)
  assert.equal(total.total, total.subtotal + total.impuestos);
});
