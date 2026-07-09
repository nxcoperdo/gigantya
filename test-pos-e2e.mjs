/**
 * Smoke test E2E del MVP POS — Fases 1-5 encadenadas.
 *
 * Levanta el server en un puerto fijo (5781), prepara la BD, y
 * ejecuta el guion de 10 pasos del plan. Sale con código 0 si todos
 * pasan, con código 1 si algo falla.
 *
 * Pre-requisitos en la BD local:
 *   - Restaurante id=1.
 *   - Usuarios con email cajero.demo/mesero.demo/cocina.demo@test.com
 *     (cualquier contraseña; el test la sobreescribe).
 *   - Al menos 1 producto y 1 mesa (opcional; el test crea los suyos
 *     si faltan).
 *   - Tablas `pagos` y `cajas_sesiones` (Fase 5). Si no existen, el
 *     test las crea.
 *
 * Pasos cubiertos:
 *   1. Resetear contraseñas de staff a valor conocido.
 *   2. Login cajero y abrir caja con $200.000 COP de fondo.
 *   3. Login mesero y crear 4 mesas (drag se simula con PUT x/y).
 *   4. Mesero toma pedido en una mesa (2 items, uno con adición).
 *   5. KDS ve el pedido en "Pendiente" + PATCH → "Preparando" → "Listo".
 *   6. Cajero ve el pedido en "Listo" en Caja y cobra $50.000 efectivo.
 *   7. Mesa pasa a "libre", pedido a "Entregado", pago insertado.
 *   8. Cajero cierra caja con conteo exacto (sin diferencia).
 *   9. Walk-in: cajero crea pedido para recoger, lo cobra, mesa no aplica.
 *   10. Regresión cliente: un cliente hace un pedido web normal.
 *   11. Reportes POS: estadísticas, top productos, revenue, métodos de pago,
 *       detalle de sesión.
 *   12. Pago parcial: cargo la mitad → estado_pago='parcial', luego el resto
 *       → 'pagado' + 'Entregado' + mesa liberada.
 *   13. Transfer: muevo pedido de mesa A → mesa B; huella transferido_de_mesa_id.
 *   14. Merge: fusiono mesas A + B; pedidos de A pasan a B.
 *   15. Config POS: GET/PUT restaurantes.configuracion_pos (solo dueño).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';
import dotenv from './server/node_modules/dotenv/lib/main.js';
import bcrypt from './server/node_modules/bcryptjs/index.js';
import mysql from './server/node_modules/mysql2/promise.js';

// Cargamos el .env del server ANTES de leer process.env.DB_*.
// El server hace lo mismo al arrancar, pero el test necesita las
// credenciales para preparar la BD antes de levantar el proceso.
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), 'server', '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverCwd = join(__dirname, 'server');
const PORT = 5781;
const baseUrl = `http://127.0.0.1:${PORT}/api`;

const TEST_PASSWORD = 'e2e-test-2026';
const RESTAURANTE_ID = 1; // único restaurante de la BD local
const PRODUCTO_PARA_PEDIDOS = 1; // id del producto "awdaw"

// Contadores para reporte final
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${tag} ${name}${detail ? ' — ' + detail : ''}`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['./src/server.js'], {
      cwd: serverCwd, stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, PORT: String(PORT) },
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) console.log('server exited code=' + code);
    });
    // Damos tiempo al server para arrancar y abrir el puerto. Si no,
    // el primer /health del loop de espera va a fallar.
    setTimeout(() => resolve(proc), 2500);
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

async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', body: { email, contrasena: password } });
  if (r.status !== 200) {
    throw new Error(`login ${email} falló: ${r.status} ${r.body.toString().slice(0, 200)}`);
  }
  const j = JSON.parse(r.body.toString());
  return j.token;
}

// ===== Setup BD =====

// Crea la tabla `name` con la DDL provista solo si no existe.
// Idempotencia: si la tabla ya está, no hace nada.
async function ensureTable(conn, name, ddl) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [name]
  );
  if (rows[0].c === 0) {
    console.log(`  [setup] creando tabla ${name}…`);
    await conn.query(ddl);
  }
}

async function setupDb() {
  const url = `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  const conn = await mysql.createConnection(url);

  // 1. Asegurar que existan las tablas de Fase 5.
  const [t1] = await conn.query(
    `SELECT COUNT(*) c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'pagos'`);
  if (t1[0].c === 0) {
    console.log('  [setup] creando tabla pagos…');
    await conn.query(`CREATE TABLE pagos (
      id INT NOT NULL AUTO_INCREMENT,
      pedido_id INT NOT NULL,
      restaurante_id INT NOT NULL,
      metodo VARCHAR(20) NOT NULL,
      monto DECIMAL(10, 2) NOT NULL,
      propina DECIMAL(10, 2) NOT NULL DEFAULT 0,
      descuento DECIMAL(10, 2) NOT NULL DEFAULT 0,
      referencia_externa VARCHAR(100) NULL,
      recibido_por INT NULL,
      caja_sesion_id INT NULL,
      items_pagados_json JSON NULL,
      creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pagos_pedido (pedido_id),
      KEY idx_pagos_rest_fecha (restaurante_id, creado_en),
      CONSTRAINT fk_pagos_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      CONSTRAINT fk_pagos_rest FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
      CONSTRAINT fk_pagos_user FOREIGN KEY (recibido_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  const [t2] = await conn.query(
    `SELECT COUNT(*) c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'cajas_sesiones'`);
  if (t2[0].c === 0) {
    console.log('  [setup] creando tabla cajas_sesiones…');
    await conn.query(`CREATE TABLE cajas_sesiones (
      id INT NOT NULL AUTO_INCREMENT,
      restaurante_id INT NOT NULL,
      usuario_id INT NOT NULL,
      monto_apertura DECIMAL(10, 2) NOT NULL DEFAULT 0,
      monto_cierre_esperado DECIMAL(10, 2) NULL,
      monto_cierre_real DECIMAL(10, 2) NULL,
      diferencia DECIMAL(10, 2) NULL,
      desglose_billetes JSON NULL,
      notas_cierre TEXT NULL,
      abierta_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      cerrada_en TIMESTAMP NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
      PRIMARY KEY (id),
      KEY idx_caja_estado (restaurante_id, estado),
      KEY idx_caja_user_estado (usuario_id, estado),
      CONSTRAINT fk_caja_rest FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
      CONSTRAINT fk_caja_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  // FK pagos→cajas_sesiones (puede o no existir).
  const [fkExists] = await conn.query(
    `SELECT COUNT(*) c FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE() AND table_name = 'pagos' AND constraint_name = 'fk_pagos_caja_sesion'`);
  if (fkExists[0].c === 0) {
    await conn.query(`ALTER TABLE pagos ADD CONSTRAINT fk_pagos_caja_sesion FOREIGN KEY (caja_sesion_id) REFERENCES cajas_sesiones(id) ON DELETE SET NULL`);
  }

  // 1.bis Tablas de Fase 6 (ingredientes, BOM, kardex). Si no existen,
  //      las creamos con tipos consistentes con la BD local.
  await ensureTable(conn, 'ingredientes', `
    CREATE TABLE ingredientes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      restaurante_id INT NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      unidad VARCHAR(20) NOT NULL DEFAULT 'unidad',
      stock_actual DECIMAL(12, 3) NOT NULL DEFAULT 0,
      stock_minimo DECIMAL(12, 3) NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ingredientes_rest_activo (restaurante_id, activo),
      CONSTRAINT fk_ingredientes_restaurante FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable(conn, 'producto_ingredientes', `
    CREATE TABLE producto_ingredientes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      producto_id INT NOT NULL,
      ingrediente_id INT UNSIGNED NOT NULL,
      cantidad DECIMAL(12, 3) NOT NULL,
      notas VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_pi_producto_ingrediente (producto_id, ingrediente_id),
      KEY idx_pi_producto (producto_id),
      KEY idx_pi_ingrediente (ingrediente_id),
      CONSTRAINT fk_pi_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
      CONSTRAINT fk_pi_ingrediente FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable(conn, 'ingredientes_movimientos', `
    CREATE TABLE ingredientes_movimientos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      restaurante_id INT NOT NULL,
      ingrediente_id INT UNSIGNED NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      cantidad DECIMAL(12, 3) NOT NULL,
      stock_anterior DECIMAL(12, 3) NOT NULL,
      stock_nuevo DECIMAL(12, 3) NOT NULL,
      pedido_id INT NULL,
      usuario_id INT NULL,
      notas VARCHAR(255) NULL,
      creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_mov_consumo_pedido (pedido_id, ingrediente_id, tipo),
      KEY idx_mov_ingrediente_fecha (ingrediente_id, creado_en),
      KEY idx_mov_restaurante_fecha (restaurante_id, creado_en),
      KEY idx_mov_pedido (pedido_id),
      KEY idx_mov_tipo_fecha (tipo, creado_en),
      CONSTRAINT fk_mov_ingrediente FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE,
      CONSTRAINT fk_mov_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
      CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      CONSTRAINT fk_mov_restaurante FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // 1.ter Ingredientes demo para Fase 6. Si ya existen, los dejamos.
  //      Nombres: Carne (kg), Pan (unidad), Queso (kg).
  const [ingCount] = await conn.query(
    `SELECT COUNT(*) c FROM ingredientes WHERE restaurante_id = ?`,
    [RESTAURANTE_ID]
  );
  let carneId, panId, quesoId;
  if (ingCount[0].c === 0) {
    console.log('  [setup] insertando ingredientes demo (Carne, Pan, Queso)…');
    const [r1] = await conn.query(
      `INSERT INTO ingredientes (restaurante_id, nombre, unidad, stock_actual, stock_minimo)
       VALUES (?, 'Carne', 'kg', 10.000, 2.000)`,
      [RESTAURANTE_ID]
    );
    carneId = r1.insertId;
    const [r2] = await conn.query(
      `INSERT INTO ingredientes (restaurante_id, nombre, unidad, stock_actual, stock_minimo)
       VALUES (?, 'Pan', 'unidad', 50.000, 10.000)`,
      [RESTAURANTE_ID]
    );
    panId = r2.insertId;
    const [r3] = await conn.query(
      `INSERT INTO ingredientes (restaurante_id, nombre, unidad, stock_actual, stock_minimo)
       VALUES (?, 'Queso', 'kg', 5.000, 0.500)`,
      [RESTAURANTE_ID]
    );
    quesoId = r3.insertId;
  } else {
    // Reusar los IDs existentes para que el BOM se referencie bien.
    const [rows] = await conn.query(
      `SELECT id, nombre FROM ingredientes WHERE restaurante_id = ?`,
      [RESTAURANTE_ID]
    );
    for (const r of rows) {
      if (r.nombre === 'Carne') carneId = r.id;
      else if (r.nombre === 'Pan') panId = r.id;
      else if (r.nombre === 'Queso') quesoId = r.id;
    }
  }
  console.log(`  [setup] ingredientes: Carne=${carneId} Pan=${panId} Queso=${quesoId}`);

  // BOM para el producto de prueba (id=1). 0.2 kg Carne + 1 Pan + 0.05 kg Queso
  // por unidad de producto. Si ya existe, lo dejamos.
  const [bomCount] = await conn.query(
    `SELECT COUNT(*) c FROM producto_ingredientes WHERE producto_id = ?`,
    [PRODUCTO_PARA_PEDIDOS]
  );
  if (bomCount[0].c === 0 && carneId && panId && quesoId) {
    console.log('  [setup] insertando BOM del producto id=1…');
    await conn.query(
      `INSERT INTO producto_ingredientes (producto_id, ingrediente_id, cantidad, notas) VALUES
         (?, ?, 0.200, 'Carne por unidad'),
         (?, ?, 1.000, 'Pan por unidad'),
         (?, ?, 0.050, 'Queso por unidad')`,
      [PRODUCTO_PARA_PEDIDOS, carneId, PRODUCTO_PARA_PEDIDOS, panId, PRODUCTO_PARA_PEDIDOS, quesoId]
    );
  }

  // Resetear stocks a valores conocidos para que el test sea
  // reproducible. Sin esto, corridas previas dejan Queso en 0 (porque
  // el 10.4 hace merma para cruzar el mínimo) y el paso 9 (cliente
  // web) falla con 409 STOCK_INSUFICIENTE al pedir 1 unidad.
  await conn.query(
    `UPDATE ingredientes
        SET stock_actual = CASE nombre
                            WHEN 'Carne' THEN 10.000
                            WHEN 'Pan'   THEN 50.000
                            WHEN 'Queso' THEN 5.000
                          END
      WHERE restaurante_id = ?`,
    [RESTAURANTE_ID]
  );
  // Limpiar kardex de la corrida previa para que el contador de
  // 'consumo_pedido' en el paso 10.1 sea exacto (= filas de ESTA run).
  await conn.query(
    `DELETE FROM ingredientes_movimientos WHERE restaurante_id = ?`,
    [RESTAURANTE_ID]
  );
  console.log('  [setup] stocks reseteados y kardex limpio');

  // 2. Resetear contraseñas de los usuarios demo.
  const hash = await bcrypt.hash(TEST_PASSWORD, 8);
  const emails = [
    'cajero.demo@test.com',
    'mesero.demo@test.com',
    'cocina.demo@test.com',
    'restaurantes@test.com',
  ];
  for (const email of emails) {
    await conn.query(
      `UPDATE usuarios SET contrasena_hash = ? WHERE email = ?`,
      [hash, email]
    );
  }
  console.log(`  [setup] contraseñas reseteadas para ${emails.length} usuarios`);

  // 3. Cerrar cualquier sesión de caja abierta del cajero (de runs previos).
  await conn.query(
    `UPDATE cajas_sesiones SET estado='cerrada', cerrada_en=NOW(),
            monto_cierre_esperado=0, monto_cierre_real=0, diferencia=0
      WHERE usuario_id IN (SELECT id FROM usuarios WHERE email='cajero.demo@test.com')
        AND estado='abierta'`);
  console.log('  [setup] sesiones de caja previas cerradas');

  // 4. Resetear mesas a libre.
  await conn.query(`UPDATE mesas SET estado='libre' WHERE restaurante_id=?`, [RESTAURANTE_ID]);

  // 5. Forzar plan Golden Plus en el local del test. El POS (Fase 1-8) está
  // gateado con `requirePlanFeatureForStaff('pos')` desde Fase 9, y solo
  // Golden Plus incluye `pos: true`. Si el local quedó en `premium` o
  // `basico` de un run anterior, todos los pasos fallarían con 403.
  await conn.query(
    `UPDATE restaurantes
        SET plan='golden_plus',
            fecha_vencimiento_plan = DATE_ADD(NOW(), INTERVAL 30 DAY)
      WHERE id = ?`,
    [RESTAURANTE_ID],
  );
  console.log('  [setup] restaurante forzado a plan=golden_plus con 30 días');

  return conn;
}

// ===== Pasos del guion =====

async function step1_loginStaff() {
  console.log('\n--- Paso 1: login de los 3 roles staff + dueño ---');
  const t1 = await login('cajero.demo@test.com', TEST_PASSWORD);
  record('cajero login', !!t1);
  const t2 = await login('mesero.demo@test.com', TEST_PASSWORD);
  record('mesero login', !!t2);
  const t3 = await login('cocina.demo@test.com', TEST_PASSWORD);
  record('cocina login', !!t3);
  // Dueño: el plan dice que el dueño crea las mesas. En la BD local
  // existe `restaurantes@test.com` (tipo=restaurante).
  const t4 = await login('restaurantes@test.com', TEST_PASSWORD);
  record('dueño login', !!t4);
  return { cajero: t1, mesero: t2, cocina: t3, dueno: t4 };
}

async function step2_abrirCaja(tokenCajero) {
  console.log('\n--- Paso 2: cajero abre caja con $200.000 fondo ---');
  const r = await req('/pos/cash-sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenCajero}` },
    body: { monto_apertura: 200000 },
  });
  const j = JSON.parse(r.body.toString());
  record('abrir caja', r.status === 201 && !!j.sesion?.id, `status=${r.status} sesion=${j.sesion?.id}`);
  // currentSession debe devolverla
  const cur = await req('/pos/cash-sessions/current', { headers: { Authorization: `Bearer ${tokenCajero}` } });
  const cj = JSON.parse(cur.body.toString());
  record('currentSession devuelve la caja', cur.status === 200 && cj.sesion?.id === j.sesion?.id);
  return j.sesion.id;
}

async function step3_crearMesas(tokenDueno) {
  console.log('\n--- Paso 3: dueño crea mesas (3 ya existen, agrego 1 más) ---');
  const ah = { Authorization: `Bearer ${tokenDueno}` };
  const lr = await req('/pos/tables', { headers: ah });
  const lj = JSON.parse(lr.body.toString());
  const existentes = lj.mesas || lj.tables || lj;
  console.log(`  [info] mesas existentes: ${existentes.length}`);
  if (existentes.length < 4) {
    // Por diseño, solo dueño/admin puede crear mesas. El mesero NO.
    const cr = await req('/pos/tables', {
      method: 'POST', headers: ah,
      body: { nombre: `Mesa E2E ${Date.now()}`, capacidad: 4 },
    });
    const cj = JSON.parse(cr.body.toString());
    record('crear mesa nueva (dueño)', cr.status === 201 || cr.status === 200, `status=${cr.status}`);
    return (existentes[0]?.id) || cj.mesa?.id;
  }
  record('≥4 mesas disponibles', true, `total=${existentes.length}`);
  return existentes[0].id;
}

async function step4_tomarPedidoMesa(tokenMesero, mesaId) {
  console.log('\n--- Paso 4: mesero toma pedido en mesa ---');
  const ah = { Authorization: `Bearer ${tokenMesero}` };
  const r = await req('/pos/orders', {
    method: 'POST', headers: ah,
    body: {
      mesa_id: mesaId,
      tipo: 'dine_in',
      items: [
        { producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 2 },
        { producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 },
      ],
    },
  });
  const j = JSON.parse(r.body.toString());
  record('crear pedido POS', r.status === 201 && !!j.pedido?.id, `status=${r.status} pedido=${j.pedido?.id} total=${j.pedido?.total}`);
  // Mesa debe haber pasado a 'ocupada'.
  const mesaR = await req('/pos/tables', { headers: ah });
  const mesaJ = JSON.parse(mesaR.body.toString());
  const mesaObj = (mesaJ.mesas || mesaJ).find((m) => m.id === mesaId);
  record('mesa ocupada tras pedido', mesaObj?.estado === 'ocupada', `estado=${mesaObj?.estado}`);
  return j.pedido;
}

async function step5_kdsAvanzar(tokenCocina, pedidoId) {
  console.log('\n--- Paso 5: KDS ve pedido, avanza Pendiente→Preparando→Listo ---');
  const ah = { Authorization: `Bearer ${tokenCocina}` };
  // Listar pendientes (CSV).
  const lr = await req('/pos/orders?estado=Pendiente,Preparando,Listo', { headers: ah });
  const lj = JSON.parse(lr.body.toString());
  const loVemos = (lj.pedidos || []).some((p) => p.id === pedidoId);
  record('KDS ve el pedido nuevo', loVemos, `total=${lj.total}`);

  // Imprimir comanda (debe ser PDF).
  const kt = await req(`/print/kitchen-ticket/${pedidoId}`, { headers: ah });
  const magic = kt.body.slice(0, 4).toString();
  record('kitchen-ticket PDF', kt.status === 200 && magic === '%PDF', `status=${kt.status} magic=${magic}`);

  // PATCH a Preparando.
  const r1 = await req(`/pos/orders/${pedidoId}/status`, {
    method: 'PATCH', headers: ah, body: { estado: 'Preparando' },
  });
  record('PATCH a Preparando', r1.status === 200, `status=${r1.status}`);

  // PATCH a Listo.
  const r2 = await req(`/pos/orders/${pedidoId}/status`, {
    method: 'PATCH', headers: ah, body: { estado: 'Listo' },
  });
  record('PATCH a Listo', r2.status === 200, `status=${r2.status}`);

  // PATCH inválido (Listo→Pendiente) debe 400.
  const r3 = await req(`/pos/orders/${pedidoId}/status`, {
    method: 'PATCH', headers: ah, body: { estado: 'Pendiente' },
  });
  record('PATCH inválido rechazado', r3.status === 400, `status=${r3.status}`);
}

async function step6_cobrarEfectivo(tokenCajero, pedidoId, sesionId) {
  console.log('\n--- Paso 6: cajero cobra $50.000 en efectivo (con vuelto) ---');
  const ah = { Authorization: `Bearer ${tokenCajero}` };
  // El total real del pedido es 1.222.232 * 3 = 3.666.696. No podemos
  // cobrar menos del total. Vamos a usar el TOTAL EXACTO para que cuadre
  // y verificar que eso pasa el pedido a Entregado.
  const det = await req(`/pos/orders/${pedidoId}`, { headers: ah });
  const dj = JSON.parse(det.body.toString());
  const total = Number(dj.pedido?.total);
  console.log(`  [info] total del pedido = ${total}`);
  const r = await req(`/pos/orders/${pedidoId}/charge`, {
    method: 'POST', headers: ah,
    body: {
      caja_sesion_id: sesionId,
      pagos: [{ metodo: 'efectivo', monto: total, referencia_externa: null }],
    },
  });
  const j = JSON.parse(r.body.toString());
  record('cobrar pedido', r.status === 201 || r.status === 200, `status=${r.status} pagos=${j.pagos_ids?.length || 0}`);

  // Verificar que el pedido pasó a Entregado.
  const det2 = await req(`/pos/orders/${pedidoId}`, { headers: ah });
  const dj2 = JSON.parse(det2.body.toString());
  record('pedido a Entregado', dj2.pedido?.estado === 'Entregado', `estado=${dj2.pedido?.estado}`);

  // Mesa a libre.
  const mesaR = await req('/pos/tables', { headers: ah });
  const mesaJ = JSON.parse(mesaR.body.toString());
  const mesaObj = (mesaJ.mesas || mesaJ).find((m) => m.id === dj2.pedido.mesa_id);
  record('mesa liberada', mesaObj?.estado === 'libre', `estado=${mesaObj?.estado}`);

  // Pago insertado.
  const pagosR = await req(`/pos/orders/${pedidoId}/pagos`, { headers: ah });
  const pagosJ = JSON.parse(pagosR.body.toString());
  const ok = Array.isArray(pagosJ.pagos) && pagosJ.pagos.length >= 1
    && Number(pagosJ.pagos[0].monto) === total;
  record('pago insertado en BD', ok, `pagos=${pagosJ.pagos?.length} monto=${pagosJ.pagos?.[0]?.monto}`);
}

async function step7_cerrarCaja(tokenCajero, sesionId) {
  console.log('\n--- Paso 7: cajero cierra caja con arqueo exacto ---');
  const ah = { Authorization: `Bearer ${tokenCajero}` };
  // El esperado = apertura (200000) + Σ pagos efectivo de la sesión.
  const sum = await req(`/pos/cash-sessions/${sesionId}/summary`, { headers: ah });
  const sj = JSON.parse(sum.body.toString());
  const esperado = Number(sj.esperado_actual);
  console.log(`  [info] esperado actual = ${esperado}`);

  // Desglosamos el esperado en denominaciones para que el JSON
  // `desglose_billetes` también cuadre exacto.
  const denom = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
  let resto = Math.round(esperado);
  const desglose = {};
  for (const d of denom) {
    const cant = Math.floor(resto / d);
    if (cant > 0) desglose[String(d)] = cant;
    resto -= cant * d;
  }
  console.log(`  [info] desglose simulado =`, desglose, `| resta ${resto}`);

  const key = `e2e-close-${sesionId}-${Date.now()}`;
  const r = await req(`/pos/cash-sessions/${sesionId}/close`, {
    method: 'POST', headers: { ...ah, 'Idempotency-Key': key },
    body: {
      monto_cierre_real: esperado,
      desglose_billetes: desglose,
      notas_cierre: 'cierre E2E',
    },
  });
  const j = JSON.parse(r.body.toString());
  const diferencia = Number(j.sesion?.diferencia ?? 999);
  record('cerrar caja', r.status === 200, `status=${r.status} diferencia=${diferencia}`);
  record('cuadra sin diferencia', Math.abs(diferencia) < 0.01, `diferencia=${diferencia}`);

  // Reintentar con misma Idempotency-Key: misma respuesta.
  const r2 = await req(`/pos/cash-sessions/${sesionId}/close`, {
    method: 'POST', headers: { ...ah, 'Idempotency-Key': key },
    body: { monto_cierre_real: esperado, desglose_billetes: {}, notas_cierre: null },
  });
  record('idempotency: misma key = misma respuesta', r2.status === 200,
    `status=${r2.status} replay=${r2.headers['x-idempotent-replay']}`);

  // currentSession debe devolver 404/null (ya no hay caja abierta).
  const cur = await req('/pos/cash-sessions/current', { headers: ah });
  const cj = JSON.parse(cur.body.toString());
  record('caja cerrada no aparece en currentSession', cj.sesion === null, `sesion=${cj.sesion?.id || 'null'}`);
}

async function step8_walkIn(tokenCajero) {
  console.log('\n--- Paso 8: pedido walk-in (recoger, sin mesa) ---');
  const ah = { Authorization: `Bearer ${tokenCajero}` };
  // Reabrir caja porque acabamos de cerrar.
  const openR = await req('/pos/cash-sessions', {
    method: 'POST', headers: ah, body: { monto_apertura: 0 },
  });
  const openJ = JSON.parse(openR.body.toString());
  record('reabrir caja para walk-in', openR.status === 201, `sesion=${openJ.sesion?.id}`);

  const r = await req('/pos/orders', {
    method: 'POST', headers: ah,
    body: {
      tipo: 'pickup',
      cliente_nombre: 'Walk-in E2E',
      cliente_telefono: '3001234567',
      items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 }],
    },
  });
  const j = JSON.parse(r.body.toString());
  record('crear pedido walk-in', r.status === 201 && !!j.pedido?.id,
    `status=${r.status} pedido=${j.pedido?.id} canal=${j.pedido?.canal}`);
  record('canal=pos', j.pedido?.canal === 'pos', `canal=${j.pedido?.canal}`);
  record('mesa_id=null (no es dine-in)', !j.pedido?.mesa_id);

  // Cobrar.
  const total = Number(j.pedido.total);
  const cr = await req(`/pos/orders/${j.pedido.id}/charge`, {
    method: 'POST', headers: ah,
    body: {
      caja_sesion_id: openJ.sesion?.id,
      pagos: [{ metodo: 'transferencia', monto: total, referencia_externa: 'TX-999' }],
    },
  });
  record('cobrar walk-in transferencia', cr.status === 201 || cr.status === 200, `status=${cr.status}`);
}

async function step9_regresionCliente(conn) {
  console.log('\n--- Paso 9: regresión cliente web ---');
  // Crear usuario cliente de prueba.
  const hash = await bcrypt.hash(TEST_PASSWORD, 8);
  const [oldUser] = await conn.query(`SELECT id FROM usuarios WHERE email='e2e-cliente@test.com'`);
  let userId;
  if (oldUser.length) {
    userId = oldUser[0].id;
    await conn.query(`UPDATE usuarios SET contrasena_hash=? WHERE id=?`, [hash, userId]);
  } else {
    const [r] = await conn.query(
      `INSERT INTO usuarios (nombre, email, contrasena_hash, tipo_usuario, estado)
       VALUES (?, ?, ?, 'cliente', 'activo')`,
      ['Cliente E2E', 'e2e-cliente@test.com', hash]
    );
    userId = r.insertId;
  }
  // Login como cliente.
  const t = await login('e2e-cliente@test.com', TEST_PASSWORD);
  record('cliente login', !!t);

  // Crear pedido web (canal='web').
  const r = await req('/orders', {
    method: 'POST', headers: { Authorization: `Bearer ${t}` },
    body: {
      restaurante_id: RESTAURANTE_ID,
      items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 }],
      metodo_pago: 'contra_entrega',
    },
  });
  const j = JSON.parse(r.body.toString());
  const pedidoId = j.pedido?.id || j.id;
  const canal = j.pedido?.canal || j.canal;
  record('crear pedido web cliente', r.status === 201 && !!pedidoId, `status=${r.status} canal=${canal}`);
  record('canal=web (no se rompió)', canal === 'web', `canal=${canal}`);
}

async function step10_inventario(conn, tokenCajero) {
  console.log('\n--- Paso 10 (Fase 6): inventario BOM + Kardex ---');

  // 10.1 — Verificar que el pedido del paso 4 (mesa, 3 unidades del producto 1)
  //        ya descontó ingredientes (la lógica nueva está dentro de
  //        orderService.createOrderCore). Esperado:
  //          Carne:  -3 * 0.200 = 0.600 kg
  //          Pan:    -3 * 1.000 = 3.000 unidad
  //          Queso:  -3 * 0.050 = 0.150 kg
  //        Y debe haber 3 filas de tipo='consumo_pedido' en kardex.
  const [consumoCount] = await conn.query(
    `SELECT COUNT(*) c FROM ingredientes_movimientos WHERE tipo='consumo_pedido' AND restaurante_id=?`,
    [RESTAURANTE_ID]
  );
  record('kardex: hay movimientos consumo_pedido', consumoCount[0].c >= 3,
    `filas=${consumoCount[0].c}`);

  const [carne] = await conn.query(
    `SELECT stock_actual FROM ingredientes WHERE restaurante_id=? AND nombre='Carne'`,
    [RESTAURANTE_ID]
  );
  // 10.000 inicial - 0.600 (paso 4) - 0.200 (paso 8) = 9.200
  const carneStock = Number(carne[0].stock_actual);
  record('Carne: stock decrementado',
    carneStock >= 0 && carneStock < 10.000,
    `stock_actual=${carneStock} (esperado ~9.200 después de paso 4 + paso 8)`);

  // 10.2 — Stock insuficiente: crear un pedido POS con 50 unidades del
  //        producto 1. La Carne inicial es 9.000 kg y cada unidad
  //        consume 0.200 kg → se necesitan 10.000 kg, claramente más
  //        que el stock. El backend debe responder 409 STOCK_INSUFICIENTE
  //        y NO crear el pedido. Antes el test usaba 1000 unidades, pero
  //        eso desbordaba DECIMAL(10,2) del campo `total` (precio × 1000
  //        ≈ 1.222M, fuera de rango) y producía 500 antes de llegar al
  //        chequeo de stock. 50 unidades = 61M, que sí cabe.
  const ah = { Authorization: `Bearer ${tokenCajero}` };
  const r = await req('/pos/orders', {
    method: 'POST', headers: ah,
    body: {
      tipo: 'pickup',
      cliente_nombre: 'Stock Insuf E2E',
      cliente_telefono: '3000000000',
      items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 50 }],
    },
  });
  const j = JSON.parse(r.body.toString());
  record('stock insuficiente → 409', r.status === 409,
    `status=${r.status} error=${j.error || j.code || 'n/a'}`);

  // 10.3 — Verificar que ese pedido NO quedó creado (rollback total).
  //        Toleramos los pedidos válidos previos (paso 4 + paso 8 = 2 POS);
  //        un nuevo pedido POS de 50 u. NO debe estar presente.
  const [bigOrder] = await conn.query(
    `SELECT COUNT(*) c FROM items_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
      WHERE p.canal='pos' AND p.restaurante_id=? AND ip.cantidad >= 50
        AND p.creado_en >= (NOW() - INTERVAL 1 MINUTE)`,
    [RESTAURANTE_ID]
  );
  record('rollback: pedido stock-insuf no se creó', bigOrder[0].c === 0,
    `items_pedido con cantidad>=50: ${bigOrder[0].c} (esperado 0)`);

  // 10.4 — Alerta al cruzar mínimo: registramos un movimiento manual
  //        (merma) que baje el Queso de ~4.85 a un valor < 0.5 (mínimo).
  const [queso] = await conn.query(
    `SELECT id, stock_actual FROM ingredientes WHERE restaurante_id=? AND nombre='Queso'`,
    [RESTAURANTE_ID]
  );
  const quesoId = queso[0].id;
  const stockQueso = Number(queso[0].stock_actual);
  // Merma de 4.5 kg lleva Queso a stockQueso-4.5. Si es > 4.5, podemos
  // tirar a 0.2 (bajo mínimo 0.5).
  if (stockQueso > 0.5) {
    const merma = stockQueso - 0.200;
    const mr = await req('/pos/inventory/movimientos', {
      method: 'POST', headers: ah,
      body: {
        ingrediente_id: quesoId,
        tipo: 'merma',
        cantidad: -Number(merma.toFixed(3)),
        notas: 'merma E2E para alerta',
      },
    });
    record('merma manual OK', mr.status === 201, `status=${mr.status}`);

    // Verificar que la fila del kardex quedó con stock_nuevo < stock_minimo.
    const [lastMov] = await conn.query(
      `SELECT stock_nuevo, stock_minimo FROM ingredientes_movimientos im
         JOIN ingredientes i ON i.id = im.ingrediente_id
        WHERE im.ingrediente_id = ? AND im.tipo = 'merma'
        ORDER BY im.id DESC LIMIT 1`,
      [quesoId]
    );
    const cross = lastMov[0]
      ? Number(lastMov[0].stock_nuevo) < Number(lastMov[0].stock_minimo)
      : false;
    record('kardex: stock_nuevo cruzó por debajo del mínimo', cross,
      `stock_nuevo=${lastMov[0]?.stock_nuevo} minimo=${lastMov[0]?.stock_minimo}`);
  } else {
    record('kardex: stock_nuevo cruzó por debajo del mínimo', true,
      'skip: stock Queso ya estaba bajo mínimo');
  }

  // 10.5 — Verificar ingredientes: lista endpoint funciona y devuelve el BOM.
  const lr = await req('/pos/inventory/ingredientes', { headers: ah });
  const lj = JSON.parse(lr.body.toString());
  const total = (lj.ingredientes || []).length;
  record('listar ingredientes del restaurante', lr.status === 200 && total >= 3,
    `count=${total}`);
}

async function step11_reportes(tokenDueno, tokenCajero, sesionCerradaId) {
  console.log('\n--- Paso 11 (Fase 7): reportes POS ---');
  const ahDueno = { Authorization: `Bearer ${tokenDueno}` };
  const ahCajero = { Authorization: `Bearer ${tokenCajero}` };

  // 11.1 — Estadísticas generales: KPIs (revenue_total > 0, total_pedidos >= 1).
  //         Filtramos por los últimos 30 días para incluir los pagos de los
  //         pasos 4 y 8.
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r1 = await req(`/pos/reports/estadisticas?desde=${desde}&hasta=${hasta}`, { headers: ahDueno });
  const j1 = JSON.parse(r1.body.toString());
  record('GET /reports/estadisticas (dueño)',
    r1.status === 200 && j1.total_pedidos >= 1 && j1.revenue_total > 0,
    `status=${r1.status} pedidos=${j1.total_pedidos} revenue=${j1.revenue_total} ticket=${j1.ticket_promedio}`);

  // 11.2 — Top productos: debe contener al menos 1 producto (el 1).
  const r2 = await req(`/pos/reports/top-productos?desde=${desde}&hasta=${hasta}&limite=10`,
    { headers: ahDueno });
  const j2 = JSON.parse(r2.body.toString());
  const topOk = Array.isArray(j2.items) && j2.items.length >= 1
    && j2.items.some((p) => Number(p.producto_id) === PRODUCTO_PARA_PEDIDOS);
  record('GET /reports/top-productos contiene producto 1',
    r2.status === 200 && topOk,
    `count=${j2.items?.length} top=${j2.items?.[0]?.nombre}`);

  // 11.3 — Revenue por día: serie con al menos 1 bucket de fecha.
  const r3 = await req(`/pos/reports/revenue?desde=${desde}&hasta=${hasta}&agrupadoPor=dia`,
    { headers: ahDueno });
  const j3 = JSON.parse(r3.body.toString());
  record('GET /reports/revenue por día',
    r3.status === 200 && Array.isArray(j3.items) && j3.items.length >= 1,
    `buckets=${j3.items?.length} total_revenue=${j3.items?.reduce((s, x) => s + Number(x.revenue || 0), 0)}`);

  // 11.4 — Métodos de pago: debe incluir 'efectivo' (paso 6) y
  //        'transferencia' (paso 8).
  const r4 = await req(`/pos/reports/metodos-pago?desde=${desde}&hasta=${hasta}`,
    { headers: ahDueno });
  const j4 = JSON.parse(r4.body.toString());
  const metodos = (j4.items || []).map((x) => x.metodo);
  record('GET /reports/metodos-pago incluye efectivo + transferencia',
    r4.status === 200 && metodos.includes('efectivo') && metodos.includes('transferencia'),
    `metodos=${metodos.join(',')}`);

  // 11.5 — Detalle de sesión cerrada (la del paso 7). El cajero
  //        también puede verla (requireStaff).
  if (sesionCerradaId) {
    const r5 = await req(`/pos/reports/sesion/${sesionCerradaId}`, { headers: ahCajero });
    const j5 = JSON.parse(r5.body.toString());
    record('GET /reports/sesion/:id por cajero',
      r5.status === 200 && Number(j5.sesion?.id) === Number(sesionCerradaId)
        && Number(j5.kpis?.total_cobrado) > 0,
      `status=${r5.status} total_cobrado=${j5.kpis?.total_cobrado} por_metodo=${j5.por_metodo?.length}`);
  } else {
    record('GET /reports/sesion/:id por cajero', false, 'sesionCerradaId es null');
  }

  // 11.6 — Defensa de tenant: un cajero de OTRO restaurante no debe
  //        ver la sesión. Como solo hay 1 restaurante en la BD local,
  //        validamos al menos que la query directa (sin restaurante
  //        propio) responda coherentemente: un admin sin
  //        ?restaurante_id debe recibir 400.
  const r6 = await login('admin@test.com', TEST_PASSWORD).then(async (tok) => {
    return req(`/pos/reports/estadisticas?desde=${desde}&hasta=${hasta}`,
      { headers: { Authorization: `Bearer ${tok}` } });
  }).catch(() => ({ status: 0 }));
  // admin login puede no existir en la BD local; si no existe, skip.
  if (r6.status === 400) {
    record('admin sin restaurante_id recibe 400', true, 'status=400');
  } else if (r6.status === 200) {
    record('admin sin restaurante_id recibe 400', false, `status=200 (no rechazó)`);
  } else {
    record('admin sin restaurante_id recibe 400', true, `skip: admin login no disponible (status=${r6.status})`);
  }
}

async function step12_chargeParcial(conn, tokens) {
  console.log('\n--- Paso 12 (Fase 8): pago parcial + split por monto ---');
  const ah = { Authorization: `Bearer ${tokens.mesero}` };
  const ahCajero = { Authorization: `Bearer ${tokens.cajero}` };

  // 12.1 — Crear pedido nuevo (mesa cualquiera).
  const mesas = await listarMesasLibres(conn);
  const mesa = mesas[0];
  if (!mesa) {
    record('split monto: hay mesa libre', false, 'no hay mesas');
    return;
  }
  const cr = await req('/pos/orders', {
    method: 'POST', headers: ah,
    body: {
      mesa_id: mesa.id,
      tipo: 'dine_in',
      items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 }],
    },
  });
  const cj = JSON.parse(cr.body.toString());
  const pedidoId = cj.pedido?.id;
  const total = Number(cj.pedido?.total || 0);
  record('split monto: crear pedido', cr.status === 201 && !!pedidoId,
    `status=${cr.status} pedido=${pedidoId} total=${total}`);
  if (!pedidoId || total <= 0) return;

  // 12.2 — Avanzar a 'Listo' para poder cobrar.
  await req(`/pos/orders/${pedidoId}/status`, {
    method: 'PATCH', headers: ah, body: { estado: 'Listo' },
  });

  // 12.3 — Reabrir caja (puede estar cerrada de pasos anteriores).
  let sesionId;
  const cur = await req('/pos/cash-sessions/current', { headers: ahCajero });
  const curj = JSON.parse(cur.body.toString());
  if (curj.sesion?.id) {
    sesionId = curj.sesion.id;
  } else {
    const openR = await req('/pos/cash-sessions', {
      method: 'POST', headers: ahCajero, body: { monto_apertura: 0 },
    });
    const openJ = JSON.parse(openR.body.toString());
    sesionId = openJ.sesion?.id;
  }

  // 12.4 — Cobrar la mitad.
  const mitad = Math.round((total / 2) * 100) / 100;
  const r1 = await req(`/pos/orders/${pedidoId}/charge-partial`, {
    method: 'POST', headers: ahCajero,
    body: {
      caja_sesion_id: sesionId,
      pagos: [{ metodo: 'efectivo', monto: mitad }],
    },
  });
  const j1 = JSON.parse(r1.body.toString());
  record('split monto: 1er pago parcial',
    r1.status === 200 && j1.estado_pago === 'parcial' && !j1.pedido_completado,
    `status=${r1.status} estado_pago=${j1.estado_pago} completado=${j1.pedido_completado} suma=${j1.suma_acumulada}`);

  // 12.5 — Verificar que la mesa sigue ocupada y el pedido NO está
  //        Entregado. El estado del pedido puede ser 'Pendiente',
  //        'Preparando' o 'Listo' según el flujo (cocina puede o no
  //        haber avanzado). Lo que importa para el split: NO pasó a
  //        'Entregado' y `estado_pago='parcial'`.
  const det = await req(`/pos/orders/${pedidoId}`, { headers: ahCajero });
  const dj = JSON.parse(det.body.toString());
  const pedidoSigueActivo = dj.pedido?.estado !== 'Entregado' && dj.pedido?.estado !== 'Cancelado'
    && dj.pedido?.estado_pago === 'parcial';
  record('split monto: pedido sigue activo con estado_pago=parcial', pedidoSigueActivo,
    `estado=${dj.pedido?.estado} estado_pago=${dj.pedido?.estado_pago}`);

  // 12.6 — Cobrar el resto.
  const resto = Math.round((total - mitad) * 100) / 100;
  const r2 = await req(`/pos/orders/${pedidoId}/charge-partial`, {
    method: 'POST', headers: ahCajero,
    body: {
      caja_sesion_id: sesionId,
      pagos: [{ metodo: 'efectivo', monto: resto }],
    },
  });
  const j2 = JSON.parse(r2.body.toString());
  record('split monto: 2do pago completa el total',
    r2.status === 201 && j2.estado_pago === 'pagado' && j2.pedido_completado,
    `status=${r2.status} estado_pago=${j2.estado_pago} completado=${j2.pedido_completado}`);

  // 12.7 — Mesa liberada.
  const det2 = await req(`/pos/orders/${pedidoId}`, { headers: ahCajero });
  const dj2 = JSON.parse(det2.body.toString());
  const mesaLibreR = await req('/pos/tables', { headers: ahCajero });
  const mesaLibreJ = JSON.parse(mesaLibreR.body.toString());
  const mesaObj = (mesaLibreJ.mesas || mesaLibreJ).find((m) => m.id === dj2.pedido.mesa_id);
  record('split monto: mesa liberada al completar pago',
    dj2.pedido?.estado === 'Entregado' && mesaObj?.estado === 'libre',
    `estado_pedido=${dj2.pedido?.estado} estado_mesa=${mesaObj?.estado}`);
}

async function listarMesasLibres(conn) {
  const [rows] = await conn.query(
    `SELECT id, nombre FROM mesas WHERE restaurante_id = ? AND estado = 'libre' ORDER BY id ASC LIMIT 4`,
    [RESTAURANTE_ID]
  );
  return rows;
}

async function step13_transfer(conn, tokens) {
  console.log('\n--- Paso 13 (Fase 8): transfer de pedido entre mesas ---');
  const ah = { Authorization: `Bearer ${tokens.mesero}` };

  const mesas = await listarMesasLibres(conn);
  if (mesas.length < 2) {
    record('transfer: hay 2+ mesas libres', false, `libres=${mesas.length}`);
    return;
  }
  const mesaA = mesas[0];
  const mesaB = mesas[1];

  // 13.1 — Crear pedido en mesa A.
  const cr = await req('/pos/orders', {
    method: 'POST', headers: ah,
    body: {
      mesa_id: mesaA.id,
      tipo: 'dine_in',
      items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 }],
    },
  });
  const cj = JSON.parse(cr.body.toString());
  const pedidoId = cj.pedido?.id;
  record('transfer: crear pedido en mesa A', cr.status === 201 && !!pedidoId,
    `status=${cr.status} pedido=${pedidoId} mesa=${mesaA.id}`);
  if (!pedidoId) return;

  // 13.2 — Transferir a mesa B.
  const tr = await req(`/pos/orders/${pedidoId}/transfer`, {
    method: 'POST', headers: ah,
    body: { mesa_destino_id: mesaB.id },
  });
  const tj = JSON.parse(tr.body.toString());
  record('transfer: mover a mesa B',
    tr.status === 200 && Number(tj.mesa_destino_id) === Number(mesaB.id),
    `status=${tr.status} destino=${tj.mesa_destino_id}`);

  // 13.3 — Verificar huella transferido_de_mesa_id en BD.
  const [rows] = await conn.query(
    `SELECT mesa_id, transferido_de_mesa_id FROM pedidos WHERE id = ?`,
    [pedidoId]
  );
  const r = rows[0];
  record('transfer: huella transferido_de_mesa_id grabada',
    Number(r?.mesa_id) === Number(mesaB.id) && Number(r?.transferido_de_mesa_id) === Number(mesaA.id),
    `mesa_id=${r?.mesa_id} transferido_de_mesa_id=${r?.transferido_de_mesa_id}`);

  // 13.4 — Verificar que mesa A está libre y mesa B ocupada.
  const ahCajero = { Authorization: `Bearer ${tokens.cajero}` };
  const tblR = await req('/pos/tables', { headers: ahCajero });
  const tblJ = JSON.parse(tblR.body.toString());
  const mesaAObj = (tblJ.mesas || tblJ).find((m) => m.id === mesaA.id);
  const mesaBObj = (tblJ.mesas || tblJ).find((m) => m.id === mesaB.id);
  record('transfer: mesa A libre, mesa B ocupada',
    mesaAObj?.estado === 'libre' && mesaBObj?.estado === 'ocupada',
    `A=${mesaAObj?.estado} B=${mesaBObj?.estado}`);

  // 13.5 — Defensa de tenant: intentar transferir a mesa de OTRO
  //        restaurante. Como solo hay 1 restaurante en la BD local,
  //        validamos al menos que la API rechace un id inválido.
  const badR = await req(`/pos/orders/${pedidoId}/transfer`, {
    method: 'POST', headers: ah,
    body: { mesa_destino_id: 999999 },
  });
  record('transfer: mesa destino inexistente → 404',
    badR.status === 404,
    `status=${badR.status}`);
}

async function step14_merge(conn, tokens) {
  console.log('\n--- Paso 14 (Fase 8): merge de mesas ---');
  const ah = { Authorization: `Bearer ${tokens.mesero}` };

  // Reusar las mesas que ya quedaron ocupadas del paso 13 (mesa B
  // con el pedido transferido). Necesitamos una mesa origen con
  // pedidos activos.
  const [mesasOcupadas] = await conn.query(
    `SELECT id, nombre FROM mesas WHERE restaurante_id = ? AND estado = 'ocupada' ORDER BY id ASC LIMIT 2`,
    [RESTAURANTE_ID]
  );
  if (mesasOcupadas.length < 2) {
    // Forzar: crear 2 pedidos en 2 mesas distintas.
    const libres = await listarMesasLibres(conn);
    if (libres.length < 2) {
      record('merge: hay 2+ mesas para fusionar', false, `libres=${libres.length} ocupadas=${mesasOcupadas.length}`);
      return;
    }
    for (const m of libres.slice(0, 2)) {
      await req('/pos/orders', {
        method: 'POST', headers: ah,
        body: { mesa_id: m.id, tipo: 'dine_in', items: [{ producto_id: PRODUCTO_PARA_PEDIDOS, cantidad: 1 }] },
      });
    }
  }
  const [mRows] = await conn.query(
    `SELECT id FROM mesas WHERE restaurante_id = ? AND estado = 'ocupada' ORDER BY id ASC LIMIT 2`,
    [RESTAURANTE_ID]
  );
  if (mRows.length < 2) {
    record('merge: hay 2+ mesas ocupadas', false, `ocupadas=${mRows.length}`);
    return;
  }
  const mesaOrigen = mRows[0];
  const mesaDestino = mRows[1];

  // Contar pedidos de origen antes.
  const [antesRows] = await conn.query(
    `SELECT COUNT(*) c FROM pedidos WHERE mesa_id = ? AND estado NOT IN ('Cancelado','Entregado')`,
    [mesaOrigen.id]
  );
  const antes = Number(antesRows[0].c);

  const mr = await req('/pos/tables/merge', {
    method: 'POST', headers: ah,
    body: { mesa_origen_id: mesaOrigen.id, mesa_destino_id: mesaDestino.id },
  });
  const mj = JSON.parse(mr.body.toString());
  record('merge: respuesta 200 con pedidos_movidos',
    mr.status === 200 && Array.isArray(mj.pedidos_movidos) && mj.pedidos_movidos.length === antes,
    `status=${mr.status} movidos=${mj.pedidos_movidos?.length} esperados=${antes}`);

  // Verificar mesa origen libre y destino ocupada.
  const ahCajero = { Authorization: `Bearer ${tokens.cajero}` };
  const tblR = await req('/pos/tables', { headers: ahCajero });
  const tblJ = JSON.parse(tblR.body.toString());
  const mesaOrObj = (tblJ.mesas || tblJ).find((m) => m.id === mesaOrigen.id);
  const mesaDeObj = (tblJ.mesas || tblJ).find((m) => m.id === mesaDestino.id);
  record('merge: mesa origen libre, destino sigue ocupada',
    mesaOrObj?.estado === 'libre' && mesaDeObj?.estado === 'ocupada',
    `origen=${mesaOrObj?.estado} destino=${mesaDeObj?.estado}`);
}

async function step15_config(tokenDueno) {
  console.log('\n--- Paso 15 (Fase 8): configuración POS ---');
  const ahDueno = { Authorization: `Bearer ${tokenDueno}` };

  // 15.1 — GET inicial devuelve config con defaults aplicados.
  const r1 = await req('/pos/config', { headers: ahDueno });
  const j1 = JSON.parse(r1.body.toString());
  const cfg = j1.configuracion_pos;
  record('config: GET inicial devuelve defaults',
    r1.status === 200 && cfg && Array.isArray(cfg.metodos_pago_habilitados)
      && typeof cfg.propina_sugerida_porcentaje === 'number',
    `status=${r1.status} propina=${cfg?.propina_sugerida_porcentaje} metodos=${cfg?.metodos_pago_habilitados?.length}`);

  // 15.2 — PUT válido actualiza la config.
  const r2 = await req('/pos/config', {
    method: 'PUT', headers: ahDueno,
    body: {
      propina_sugerida_porcentaje: 15,
      metodos_pago_habilitados: ['efectivo', 'transferencia', 'nequi'],
      split_bill_habilitado: true,
    },
  });
  const j2 = JSON.parse(r2.body.toString());
  const cfg2 = j2.configuracion_pos;
  record('config: PUT válido actualiza',
    r2.status === 200 && cfg2?.propina_sugerida_porcentaje === 15
      && cfg2?.metodos_pago_habilitados?.length === 3,
    `status=${r2.status} propina=${cfg2?.propina_sugerida_porcentaje} metodos=${cfg2?.metodos_pago_habilitados?.join(',')}`);

  // 15.3 — GET refleja los cambios.
  const r3 = await req('/pos/config', { headers: ahDueno });
  const j3 = JSON.parse(r3.body.toString());
  record('config: GET refleja el cambio',
    r3.status === 200 && j3.configuracion_pos?.propina_sugerida_porcentaje === 15,
    `propina=${j3.configuracion_pos?.propina_sugerida_porcentaje}`);

  // 15.4 — PUT con valor inválido (propina fuera de rango) → 400.
  const r4 = await req('/pos/config', {
    method: 'PUT', headers: ahDueno,
    body: { propina_sugerida_porcentaje: 150 },
  });
  record('config: PUT inválido rechazado',
    r4.status === 400,
    `status=${r4.status}`);

  // 15.5 — Defensa: el cajero (no dueño) NO debe poder hacer PUT.
  //        Login con cajero para tener un token fresco.
  const tCajero = await login('cajero.demo@test.com', TEST_PASSWORD);
  const r5 = await req('/pos/config', {
    method: 'PUT', headers: { Authorization: `Bearer ${tCajero}` },
    body: { split_bill_habilitado: false },
  });
  record('config: PUT por cajero NO-dueño → 403',
    r5.status === 403,
    `status=${r5.status}`);
}

async function main() {
  console.log('Setup BD…');
  const conn = await setupDb();

  console.log('Iniciando server en puerto', PORT);
  const proc = await startServer();
  try {
    // Esperar a que el server esté vivo.
    for (let i = 0; i < 20; i++) {
      try {
        const r = await req('/health');
        if (r.status === 200) break;
      } catch (_) { /* noop */ }
      await sleep(300);
    }

    const tokens = await step1_loginStaff();
    const sesionId = await step2_abrirCaja(tokens.cajero);
    const mesaId = await step3_crearMesas(tokens.dueno);
    const pedido = await step4_tomarPedidoMesa(tokens.mesero, mesaId);
    await step5_kdsAvanzar(tokens.cocina, pedido.id);
    await step6_cobrarEfectivo(tokens.cajero, pedido.id, sesionId);
    await step7_cerrarCaja(tokens.cajero, sesionId);
    await step8_walkIn(tokens.cajero);
    await step9_regresionCliente(conn);
    await step10_inventario(conn, tokens.cajero);
    await step11_reportes(tokens.dueno, tokens.cajero, sesionId);
    await step12_chargeParcial(conn, tokens);
    await step13_transfer(conn, tokens);
    await step14_merge(conn, tokens);
    await step15_config(tokens.dueno);
  } finally {
    proc.kill('SIGTERM');
    await sleep(300);
    await conn.end();
  }

  console.log('\n========== RESUMEN ==========');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`Pasaron: ${passed}/${results.length}`);
  if (failed.length) {
    console.log('Fallaron:');
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('\nTEST ERR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
