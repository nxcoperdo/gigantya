// Verificador visual UI/UX - Playwright + mobile viewport
// Captura screenshots de las pantallas modificadas en tamaño iPhone 13/14

const { chromium, devices } = require('playwright');
const path = require('path');

const SHOTS = [
  { url: 'http://localhost:5173/',                       file: 'home.png',         wait: 2500 },
  { url: 'http://localhost:5173/cart',                   file: 'cart.png',         wait: 2000 },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'es-CO',
  });
  const page = await context.newPage();

  // Capturar errores de consola para diagnóstico
  const errors = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });

  for (const shot of SHOTS) {
    try {
      console.log(`→ ${shot.url}`);
      await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(shot.wait);
      const out = path.join(__dirname, 'screenshots', shot.file);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${out}`);
    } catch (e) {
      console.error(`  ✗ ${shot.url}: ${e.message}`);
    }
  }

  if (errors.length) {
    console.log('\n=== ERRORES ENCONTRADOS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('\n✓ Sin errores de consola');
  }

  await browser.close();
})();
