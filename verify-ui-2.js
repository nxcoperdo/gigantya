// Verificador UI/UX - captura modal de customización y order details
// Interceptor de API para evitar depender del backend

const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'es-CO',
  });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  // Mock del restaurante con productos
  const mockRestaurant = {
    id: 1,
    nombre: 'Restaurante Demo',
    imagen_url: null,
    calificacion_promedio: 4.7,
    categorias: [{ id: 1, nombre: 'Hamburguesas' }],
    configuracion_envios: JSON.stringify({ activo: true, costo_fijo: 3000, envio_gratis_activo: true, envio_gratis_desde: 25000 }),
    configuracion_impuestos: JSON.stringify({ activo: true, porcentaje: 8 }),
  };

  const mockProductos = [
    {
      id: 101,
      nombre: 'Hamburguesa Especial',
      descripcion: 'Carne 150g, queso cheddar, lechuga, tomate, salsas de la casa',
      precio: 22000,
      imagen_url: null,
      categoria_id: 1,
      categoria_nombre: 'Hamburguesas',
      disponible: 1,
    },
  ];

  const mockPaquete = {
    grupos: [
      {
        id: 1,
        nombre: 'Extras',
        adiciones: [
          { id: 10, grupo_id: 1, nombre: 'Bacon', precio_extra: 3000 },
          { id: 11, grupo_id: 1, nombre: 'Huevo', precio_extra: 1500 },
          { id: 12, grupo_id: 1, nombre: 'Doble queso', precio_extra: 2500 },
        ],
      },
    ],
    adiciones: [
      { id: 10, grupo_id: 1, nombre: 'Bacon', precio_extra: 3000 },
      { id: 11, grupo_id: 1, nombre: 'Huevo', precio_extra: 1500 },
      { id: 12, grupo_id: 1, nombre: 'Doble queso', precio_extra: 2500 },
      { id: 20, grupo_id: null, nombre: 'Papas extra', precio_extra: 4500 },
    ],
    removibles: [
      { id: 100, nombre: 'Cebolla' },
      { id: 101, nombre: 'Tomate' },
      { id: 102, nombre: 'Lechuga' },
    ],
  };

  // Interceptar llamadas a /api/...
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.match(/\/restaurants\/\d+$/)) body = { restaurante: mockRestaurant };
    else if (url.match(/\/restaurants\/\d+\/productos/)) body = { productos: mockProductos };
    else if (url.match(/\/productos\/\d+\/paquete-modificadores/)) body = { configuracion: mockPaquete };
    else if (url.match(/\/categories/)) body = { categorias: [] };
    else if (url.match(/\/auth\/me/)) body = { usuario: { id: 1, nombre: 'Cliente', restaurante: null } };
    else body = {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Navegar al home y luego a un restaurante
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Ir directamente a la URL del restaurante
  await page.goto('http://localhost:5173/restaurant/1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Screenshot del RestaurantDetails
  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'restaurant.png'),
    fullPage: false,
  });
  console.log('✓ restaurant.png');

  // Buscar el botón para abrir el modal del producto
  const addBtn = await page.locator('button:has-text("Agregar"), button:has-text("Personalizar"), [aria-label*="agregar" i]').first();
  if (await addBtn.count() > 0) {
    await addBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'customization-modal.png'),
      fullPage: false,
    });
    console.log('✓ customization-modal.png');
  } else {
    console.log('⚠ No se encontró botón para abrir modal de customización');
  }

  // Capturar OrderDetailsModal (necesita un pedido) — vamos a /checkout? no, mejor
  // navegar al perfil para tener el botón de "Ver pedido"
  await page.goto('http://localhost:5173/profile/orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(__dirname, 'screenshots', 'orders.png'),
    fullPage: false,
  });
  console.log('✓ orders.png');

  if (errors.length) {
    console.log('\n=== ERRORES ===');
    errors.slice(0, 8).forEach((e) => console.log(e));
  }

  await browser.close();
})();
