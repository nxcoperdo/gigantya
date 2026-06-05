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
  const total = calculateOrderTotal([
    { producto_id: 10, cantidad: 2, precio_unitario: 12000 },
    { producto_id: 11, cantidad: 1, precio_unitario: 5500 }
  ]);

  assert.equal(total, 31860);
});
