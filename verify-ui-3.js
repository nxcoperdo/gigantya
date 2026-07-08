// Verificador UI/UX - screenshots del Modal de Customización + OrderDetailsModal
// Estrategia: renderizar el modal directamente en una página limpia, sin necesidad de navegación completa

const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'es-CO',
  });
  const page = await context.newPage();

  // Mock APIs
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes('paquete-modificadores')) {
      body = {
        configuracion: {
          grupos: [{ id: 1, nombre: 'Extras', adiciones: [
            { id: 10, grupo_id: 1, nombre: 'Bacon', precio_extra: 3000 },
            { id: 11, grupo_id: 1, nombre: 'Huevo frito', precio_extra: 1500 },
            { id: 12, grupo_id: 1, nombre: 'Doble queso cheddar', precio_extra: 2500 },
          ]}],
          adiciones: [
            { id: 10, grupo_id: 1, nombre: 'Bacon', precio_extra: 3000 },
            { id: 11, grupo_id: 1, nombre: 'Huevo frito', precio_extra: 1500 },
            { id: 12, grupo_id: 1, nombre: 'Doble queso cheddar', precio_extra: 2500 },
            { id: 20, grupo_id: null, nombre: 'Papas extra', precio_extra: 4500 },
            { id: 21, grupo_id: null, nombre: 'Gaseosa 400ml', precio_extra: 3500 },
          ],
          removibles: [
            { id: 100, nombre: 'Cebolla' },
            { id: 101, nombre: 'Tomate' },
            { id: 102, nombre: 'Lechuga' },
            { id: 103, nombre: 'Pepinillos' },
          ],
        },
      };
    } else if (url.includes('auth/me') || url.includes('profile')) {
      body = { usuario: { id: 1, nombre: 'Demo', restaurante: null } };
    } else if (url.includes('categories')) {
      body = { categorias: [] };
    } else if (url.match(/orders\/\d+$/)) {
      body = {
        pedido: {
          id: 12345,
          estado: 'Preparando',
          creado_en: new Date().toISOString(),
          cliente_nombre: 'Juan Pérez',
          cliente_telefono: '+57 312 456 7890',
          metodo_pago: 'nequi',
          direccion_formateada: 'Calle 5 # 4-23, Gigante, Huila',
          latitud: 2.3868,
          longitud: -75.5466,
          subtotal: 22000,
          costo_envio: 0,
          descuento: 0,
          total: 23760,
          notas: 'Entregar en portería',
          items: [
            {
              id: 1,
              nombre: 'Hamburguesa Especial',
              cantidad: 2,
              subtotal: 50600,
              precio: 22000,
              adiciones: [
                { adicion_id: 10, nombre: 'Bacon', grupo_nombre: 'Extras', cantidad: 1, precio_unitario_adicion: 3000, subtotal: 3000 },
                { adicion_id: 12, nombre: 'Doble queso cheddar', grupo_nombre: 'Extras', cantidad: 1, precio_unitario_adicion: 2500, subtotal: 2500 },
                { adicion_id: 20, nombre: 'Papas extra', grupo_nombre: null, cantidad: 1, precio_unitario_adicion: 4500, subtotal: 4500 },
              ],
              removidos: [
                { nombre: 'Cebolla' },
                { nombre: 'Tomate' },
              ],
              especificaciones: 'Término medio, sin picante',
            },
          ],
        },
      };
    } else {
      body = {};
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Test 1: ProductCustomizationModal
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Insertar y abrir el modal directamente con React via window
  await page.evaluate(() => {
    // Cargar el componente manualmente (no es trivial en runtime, así que
    // usamos un truco: navegar a restaurant/1 y mockear que el producto tiene
    // modificadores, y el modal debe abrirse al hacer click.
  });

  // Mejor: usamos la página de restaurante, donde RestaurantDetailsPage
  // abre el modal. Primero agregamos el producto al carrito con modificadores.
  await page.goto('http://localhost:5173/restaurant/1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Inyectar un producto con modificadores en la lista (re-render con store nuevo)
  // Como RestaurantDetailsPage lee de /api/restaurants/:id/productos, mockeamos mejor
  await page.route('**/api/restaurants/*/productos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        productos: [{
          id: 101,
          nombre: 'Hamburguesa Especial',
          descripcion: 'Carne 150g, queso cheddar, lechuga, tomate, salsas de la casa',
          precio: 22000,
          imagen_url: null,
          categoria_id: 1,
          categoria_nombre: 'Hamburguesas',
          disponible: 1,
          tiene_modificadores: 1,
        }],
      }),
    });
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Buscar el botón de agregar/personalizar y click
  const customizeBtn = page.locator('button:has-text("Personalizar")').first();
  if (await customizeBtn.count() > 0) {
    await customizeBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'customization-modal.png'),
      fullPage: false,
    });
    console.log('✓ customization-modal.png');
  } else {
    console.log('⚠ No se encontró "Personalizar" — intentando con otros selectores');
    const altBtn = page.locator('button[aria-label*="agregar" i], button[aria-label*="personalizar" i]').first();
    if (await altBtn.count() > 0) {
      await altBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(__dirname, 'screenshots', 'customization-modal.png'),
        fullPage: false,
      });
      console.log('✓ customization-modal.png (vía aria-label)');
    }
  }

  // Test 2: OrderDetailsModal — vamos a la lista de pedidos y abrimos uno
  await page.goto('http://localhost:5173/profile/orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'orders-list.png'),
    fullPage: false,
  });
  console.log('✓ orders-list.png');

  // Toggle dark mode y capturar
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'orders-list-dark.png'),
    fullPage: false,
  });
  console.log('✓ orders-list-dark.png');

  await browser.close();
})();
