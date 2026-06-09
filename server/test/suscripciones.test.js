import test from 'node:test';
import assert from 'node:assert/strict';
import * as SubscriptionModel from '../src/models/Subscription.js';

test('Subscription — modelo expone todas las funciones', async (t) => {
  await t.test('exporta las funciones esperadas', () => {
    const expected = [
      'createSubscription',
      'getActiveSubscription',
      'getSubscriptionHistory',
      'markSubscriptionExpired',
      'markReminderSent',
      'getSubscriptionsExpiringInDays',
      'getExpiredActiveSubscriptions',
    ];
    for (const fn of expected) {
      assert.strictEqual(typeof SubscriptionModel[fn], 'function', `${fn} debe ser función`);
    }
  });

  await t.test('default export contiene las mismas funciones', () => {
    const def = SubscriptionModel.default;
    assert.ok(def, 'debe existir default export');
    assert.strictEqual(typeof def.createSubscription, 'function');
    assert.strictEqual(typeof def.getActiveSubscription, 'function');
    assert.strictEqual(typeof def.getSubscriptionHistory, 'function');
  });
});
