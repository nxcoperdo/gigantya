import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANES,
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_INFO,
  canAccessPlan,
  getPlanLimit,
  isPlanExpired,
} from '../src/utils/planFeatures.js';

test('planFeatures — constantes del plan', async (t) => {
  await t.test('los 3 planes están definidos', () => {
    assert.deepStrictEqual([...PLANES], ['basico', 'profesional', 'premium']);
  });

  await t.test('precios coinciden con la propuesta comercial', () => {
    assert.strictEqual(PLAN_PRICES.basico, 70000);
    assert.strictEqual(PLAN_PRICES.profesional, 120000);
    assert.strictEqual(PLAN_PRICES.premium, 200000);
  });

  await t.test('plan Básico NO tiene cupones, destacados, ni banner', () => {
    assert.strictEqual(PLAN_FEATURES.basico.cupones, false);
    assert.strictEqual(PLAN_FEATURES.basico.productos_destacados, false);
    assert.strictEqual(PLAN_FEATURES.basico.banner_home, false);
    assert.strictEqual(PLAN_FEATURES.basico.multiples_fotos, false);
    assert.strictEqual(PLAN_FEATURES.basico.estadisticas, false);
  });

  await t.test('plan Profesional SÍ tiene cupones/destacados/estadísticas pero NO banner', () => {
    assert.strictEqual(PLAN_FEATURES.profesional.cupones, true);
    assert.strictEqual(PLAN_FEATURES.profesional.productos_destacados, true);
    assert.strictEqual(PLAN_FEATURES.profesional.estadisticas, true);
    assert.strictEqual(PLAN_FEATURES.profesional.banner_home, false);
  });

  await t.test('plan Premium tiene TODO', () => {
    for (const [, value] of Object.entries(PLAN_FEATURES.premium)) {
      assert.strictEqual(value, true, `Premium debería tener la feature activa`);
    }
  });

  await t.test('límite de fotos: básico=1, profesional=5, premium=5', () => {
    assert.strictEqual(getPlanLimit('basico', 'fotos_por_producto'), 1);
    assert.strictEqual(getPlanLimit('profesional', 'fotos_por_producto'), 5);
    assert.strictEqual(getPlanLimit('premium', 'fotos_por_producto'), 5);
  });
});

test('planFeatures — canAccessPlan', async (t) => {
  await t.test('basico no accede a cupones', () => {
    assert.strictEqual(canAccessPlan('basico', 'cupones'), false);
  });

  await t.test('profesional accede a cupones pero no a banner', () => {
    assert.strictEqual(canAccessPlan('profesional', 'cupones'), true);
    assert.strictEqual(canAccessPlan('profesional', 'banner_home'), false);
  });

  await t.test('premium accede a todo', () => {
    assert.strictEqual(canAccessPlan('premium', 'cupones'), true);
    assert.strictEqual(canAccessPlan('premium', 'banner_home'), true);
  });

  await t.test('plan inexistente → false', () => {
    assert.strictEqual(canAccessPlan('inexistente', 'cupones'), false);
  });
});

test('planFeatures — isPlanExpired', async (t) => {
  await t.test('sin fecha de vencimiento nunca vence', () => {
    assert.strictEqual(isPlanExpired({ plan: 'profesional', fecha_vencimiento_plan: null }), false);
  });

  await t.test('plan básico nunca vence (ni siquiera con fecha pasada)', () => {
    assert.strictEqual(isPlanExpired({ plan: 'basico', fecha_vencimiento_plan: '2020-01-01' }), false);
  });

  await t.test('plan profesional con fecha futura → NO vencido', () => {
    const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(isPlanExpired({ plan: 'profesional', fecha_vencimiento_plan: futuro }), false);
  });

  await t.test('plan profesional con fecha pasada → SÍ vencido', () => {
    const pasado = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(isPlanExpired({ plan: 'profesional', fecha_vencimiento_plan: pasado }), true);
  });
});

test('planFeatures — PLAN_INFO', async (t) => {
  await t.test('todos los planes tienen emoji y nombre', () => {
    for (const plan of PLANES) {
      assert.ok(PLAN_INFO[plan], `PLAN_INFO.${plan} debe existir`);
      assert.ok(PLAN_INFO[plan].emoji, `PLAN_INFO.${plan}.emoji debe existir`);
      assert.ok(PLAN_INFO[plan].nombre, `PLAN_INFO.${plan}.nombre debe existir`);
      assert.ok(PLAN_INFO[plan].precio > 0, `PLAN_INFO.${plan}.precio debe ser positivo`);
    }
  });
});
