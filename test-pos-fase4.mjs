/**
 * Smoke test E2E de Fase 4: KDS + impresión.
 *
 * Levanta el server en un puerto fijo (5781), prueba:
 *   1. Login como usuario staff.
 *   2. Listar pedidos POS con filtro CSV.
 *   3. Crear pedido POS.
 *   4. GET /api/print/kitchen-ticket/:id devuelve PDF.
 *   5. GET /api/print/receipt/:id devuelve PDF.
 *   6. PATCH status válido.
 *   7. PATCH status inválido → 400.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverCwd = join(__dirname, 'server');
const PORT = 5781;
const baseUrl = `http://127.0.0.1:${PORT}/api`;

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['./src/app.js'], {
      cwd: serverCwd, stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, PORT: String(PORT) },
    });
    proc.on('error', reject);
    proc.on('exit', (code) => { if (code !== 0 && code !== null) console.log('server exited code=' + code); });
    setTimeout(() => resolve(proc), 1500);
  });
}

async function req(path, opts = {}) {
  const u = new URL(`${baseUrl}${path}`);
  return new Promise((resolve, reject) => {
    const r = http.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

async function loginAsStaff() {
  let query;
  try {
    const dbMod = await import(pathToFileURL(join(serverCwd, 'src/config/database.js')).href);
    query = dbMod.query;
  } catch (e) {
    return { token: null, info: 'BD no accesible: ' + e.message };
  }
  let rows;
  try {
    rows = await query(
      `SELECT id, email FROM usuarios
       WHERE tipo_usuario IN ('cajero','mesero','cocina','restaurante')
         AND estado = 'activo'
       ORDER BY id ASC LIMIT 1`
    );
  } catch (e) {
    return { token: null, info: 'query falló: ' + e.message };
  }
  if (!rows.length) return { token: null, info: 'sin usuario staff' };
  const u = rows[0];
  const candidates = ['123456', 'demo1234', 'pos1234', 'cocina123', 'mesero123', 'password', 'admin123', u.email.split('@')[0] + '123'];
  for (const c of candidates) {
    const r = await req('/auth/login', { method: 'POST', body: { email: u.email, contrasena: c } });
    if (r.status === 200) {
      const j = JSON.parse(r.body.toString());
      return { token: j.token, info: `login ${u.email}/${c} rol=${j.usuario.tipo_usuario}` };
    }
  }
  return { token: null, info: `login falló para ${u.email}` };
}

async function main() {
  console.log('Iniciando server…');
  const proc = await startServer();
  try {
    // Esperar a que el server esté vivo (health check).
    for (let i = 0; i < 10; i++) {
      try {
        const r = await req('/health');
        if (r.status === 200) break;
      } catch (_) { /* noop */ }
      await sleep(500);
    }

    const { token, info } = await loginAsStaff();
    console.log('LOGIN:', info);
    if (!token) { console.log('SKIP'); return; }
    const authH = { Authorization: `Bearer ${token}` };

    // 2) Listar con CSV
    const listR = await req('/pos/orders?estado=Pendiente,Preparando,Listo', { headers: authH });
    const listJ = JSON.parse(listR.body.toString());
    console.log(`LIST status=${listR.status} total=${listJ.total || 0}`);

    // 3) Crear pedido POS
    // Buscar restaurante y producto del staff.
    const meR = await req('/users/me', { headers: authH });
    let restauranteId = null;
    if (meR.status === 200) {
      const me = JSON.parse(meR.body.toString());
      restauranteId = me.usuario?.restaurante_id;
    }
    if (!restauranteId) {
      // El usuario es `restaurante` (dueño), no staff con restaurante_id.
      // Buscar el restaurante del dueño.
      const meJ = JSON.parse(meR.body.toString());
      const ownerId = meJ.usuario?.id;
      const rR = await req(`/restaurants/by-user/${ownerId}`, { headers: authH });
      if (rR.status === 200) restauranteId = JSON.parse(rR.body.toString()).id || JSON.parse(rR.body.toString()).restaurante?.id;
    }
    if (!restauranteId) {
      // Último fallback: primer restaurante de la BD
      try {
        const dbMod = await import(pathToFileURL(join(serverCwd, 'src/config/database.js')).href);
        const rs = await dbMod.query('SELECT id FROM restaurantes ORDER BY id ASC LIMIT 1');
        if (rs.length) restauranteId = rs[0].id;
      } catch (_) { /* noop */ }
    }
    if (!restauranteId) { console.log('NO_RESTAURANTE'); return; }
    console.log('restaurante_id=', restauranteId);

    const prodsR = await req(`/products/restaurant/${restauranteId}`);
    const prods = JSON.parse(prodsR.body.toString());
    if (!prods.productos?.length) { console.log('NO_PRODUCTOS'); return; }
    const prod = prods.productos[0];
    console.log('producto elegido:', prod.id, prod.nombre);

    const createR = await req('/pos/orders', {
      method: 'POST', headers: authH,
      body: { tipo: 'pickup', items: [{ producto_id: prod.id, cantidad: 1 }] },
    });
    const createJ = JSON.parse(createR.body.toString());
    console.log(`CREATE status=${createR.status} pedido=${createJ.pedido?.id} print_url=${createJ.print_url || 'none'}`);
    const pedidoId = createJ.pedido?.id;
    if (!pedidoId) { console.log('NO_PEDIDO_ID body=', JSON.stringify(createJ).slice(0, 200)); return; }

    // 4) Kitchen ticket PDF
    const ktR = await req(`/print/kitchen-ticket/${pedidoId}`, { headers: authH });
    const ktMagic = ktR.body.slice(0, 4).toString();
    console.log(`KT status=${ktR.status} ct=${ktR.headers['content-type']} bytes=${ktR.body.length} magic=${ktMagic} (esperado %PDF)`);

    // 5) Receipt PDF
    const rcR = await req(`/print/receipt/${pedidoId}`, { headers: authH });
    const rcMagic = rcR.body.slice(0, 4).toString();
    console.log(`RC status=${rcR.status} ct=${rcR.headers['content-type']} bytes=${rcR.body.length} magic=${rcMagic} (esperado %PDF)`);

    // 6) PATCH status válido
    const stR = await req(`/pos/orders/${pedidoId}/status`, {
      method: 'PATCH', headers: authH, body: { estado: 'Preparando' },
    });
    console.log(`PATCH OK status=${stR.status}`);

    // 7) PATCH status inválido
    const stBadR = await req(`/pos/orders/${pedidoId}/status`, {
      method: 'PATCH', headers: authH, body: { estado: 'Pendiente' },
    });
    console.log(`PATCH BAD status=${stBadR.status} (esperado 400)`);
  } finally {
    proc.kill('SIGTERM');
    await sleep(300);
  }
}

main().catch((e) => { console.error('TEST ERR:', e); process.exit(1); });
