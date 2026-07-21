import { query, getConnection } from '../config/database.js';

/**
 * Modelo de modificadores de producto (estilo Rappi/PedidosYa).
 *
 * Tres entidades independientes:
 * - producto_grupos_adiciones: contenedor opcional ("Salsas", "Extras").
 * - producto_adiciones: la adición en sí (puede tener grupo_id o no).
 * - producto_ingredientes_removibles: cosas que vienen por defecto y
 *   el cliente puede desmarcar.
 *
 * Más una tabla de snapshot en pedidos:
 * - items_pedido_adiciones: la elección del cliente con precio y
 *   cantidad preservados.
 */

// =============================================================================
// GRUPOS DE ADICIONES
// =============================================================================

export async function getGruposAdicionesByProducto(productoId) {
  // Traemos también las 3 columnas de Fase 10 (obligatorio / min / max)
  // para que `getPaqueteModificadores` las propague al cliente y al admin.
  // Los defaults (0/0/99) están en la migración, así que en filas viejas
  // ya vienen populados.
  const sql = `
    SELECT id, producto_id, nombre, orden, activo,
           obligatorio, min_selecciones, max_selecciones, creado_en
    FROM producto_grupos_adiciones
    WHERE producto_id = ? AND activo = 1
    ORDER BY orden ASC, id ASC
  `;
  return await query(sql, [productoId]);
}

export async function createGrupoAdicion(productoId, { nombre, orden = 0, activo = true, obligatorio = false, min_selecciones = 0, max_selecciones = 99 }) {
  // Defaults Fase 10 reproducen el comportamiento pre-existente.
  const sql = `
    INSERT INTO producto_grupos_adiciones
      (producto_id, nombre, orden, activo, obligatorio, min_selecciones, max_selecciones, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const res = await query(sql, [
    productoId,
    nombre,
    orden,
    activo,
    obligatorio ? 1 : 0,
    Number(min_selecciones) || 0,
    Number(max_selecciones) || 99,
  ]);
  return res.insertId;
}

export async function updateGrupoAdicion(id, { nombre, orden, activo, obligatorio, min_selecciones, max_selecciones }) {
  // CUIDADO: COALESCE(0, max_selecciones) siempre gana 0 porque 0 es
  // no-NULL. Usamos sentinela -1 para distinguir "no mandado" de
  // "mandado como 0". Si llega -1, NO actualizamos el campo. Esta
  // función no se usa en flujo normal (el PUT llama a
  // `replacePaqueteModificadores`, que reemplaza el paquete entero) pero
  // la dejamos coherente con el patrón.
  const noNum = (v) => (v === -1 || v == null);
  const sql = `
    UPDATE producto_grupos_adiciones
    SET nombre          = COALESCE(?, nombre),
        orden           = COALESCE(?, orden),
        activo          = COALESCE(?, activo),
        obligatorio     = COALESCE(?, obligatorio),
        min_selecciones = CASE WHEN ? THEN min_selecciones ELSE ? END,
        max_selecciones = CASE WHEN ? THEN max_selecciones ELSE ? END
    WHERE id = ?
  `;
  await query(sql, [
    nombre,
    orden,
    activo,
    // obligatorio: NULL si no se mandó, sino 0/1
    (obligatorio == null) ? null : (obligatorio ? 1 : 0),
    noNum(min_selecciones) ? 1 : 0,                  // 1 = "no tocar" para min
    noNum(min_selecciones) ? 0 : Number(min_selecciones),
    noNum(max_selecciones) ? 1 : 0,                  // 1 = "no tocar" para max
    noNum(max_selecciones) ? 0 : Number(max_selecciones),
    id,
  ]);
}

export async function deleteGrupoAdicion(id) {
  // Las adiciones con este grupo_id se ponen en NULL por la FK
  // ON DELETE SET NULL (siguen vivas, quedan sueltas).
  const sql = `DELETE FROM producto_grupos_adiciones WHERE id = ?`;
  await query(sql, [id]);
}

// =============================================================================
// ADICIONES
// =============================================================================

export async function getAdicionesByProducto(productoId) {
  // Devolvemos TODAS las adiciones del producto (con o sin grupo).
  // El cliente las filtra por grupo en el render.
  const sql = `
    SELECT id, producto_id, grupo_id, nombre, precio_extra, orden, activo, creado_en
    FROM producto_adiciones
    WHERE producto_id = ? AND activo = 1
    ORDER BY grupo_id ASC, orden ASC, id ASC
  `;
  return await query(sql, [productoId]);
}

export async function createAdicion(productoId, { grupo_id = null, nombre, precio_extra = null, orden = 0, activo = true }) {
  const sql = `
    INSERT INTO producto_adiciones (producto_id, grupo_id, nombre, precio_extra, orden, activo, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;
  const res = await query(sql, [productoId, grupo_id, nombre, precio_extra, orden, activo]);
  return res.insertId;
}

export async function updateAdicion(id, { grupo_id, nombre, precio_extra, orden, activo }) {
  // COALESCE permite PATCH parcial: si no se manda un campo, queda igual.
  // Para grupo_id, precio_extra y activo necesitamos distinguir "no mandado"
  // de "mandado como null" — usamos IFNULL con un sentinela (-1) solo si
  // hace falta. Como aquí el PUT reemplaza el paquete entero (no es PATCH),
  // no se llama esta función en flujo normal. Se deja por completitud.
  const sql = `
    UPDATE producto_adiciones
    SET grupo_id = ?,
        nombre = ?,
        precio_extra = ?,
        orden = ?,
        activo = ?
    WHERE id = ?
  `;
  await query(sql, [grupo_id, nombre, precio_extra, orden, activo, id]);
}

export async function deleteAdicion(id) {
  const sql = `DELETE FROM producto_adiciones WHERE id = ?`;
  await query(sql, [id]);
}

// =============================================================================
// INGREDIENTES REMOVIBLES
// =============================================================================

export async function getRemoviblesByProducto(productoId) {
  const sql = `
    SELECT id, producto_id, nombre, orden, activo, creado_en
    FROM producto_ingredientes_removibles
    WHERE producto_id = ? AND activo = 1
    ORDER BY orden ASC, id ASC
  `;
  return await query(sql, [productoId]);
}

export async function createRemovible(productoId, { nombre, orden = 0, activo = true }) {
  const sql = `
    INSERT INTO producto_ingredientes_removibles (producto_id, nombre, orden, activo, creado_en)
    VALUES (?, ?, ?, ?, NOW())
  `;
  const res = await query(sql, [productoId, nombre, orden, activo]);
  return res.insertId;
}

export async function updateRemovible(id, { nombre, orden, activo }) {
  const sql = `
    UPDATE producto_ingredientes_removibles
    SET nombre = COALESCE(?, nombre),
        orden = COALESCE(?, orden),
        activo = COALESCE(?, activo)
    WHERE id = ?
  `;
  await query(sql, [nombre, orden, activo, id]);
}

export async function deleteRemovible(id) {
  const sql = `DELETE FROM producto_ingredientes_removibles WHERE id = ?`;
  await query(sql, [id]);
}

// =============================================================================
// PAQUETE COMPLETO
// =============================================================================

/**
 * Devuelve el paquete completo de modificadores de un producto.
 * Tres lecturas independientes (no necesitan transacción).
 * Estructura que consume el cliente:
 * {
 *   grupos: [{ id, nombre, orden, obligatorio, min_selecciones, max_selecciones }],
 *   adiciones: [{ id, grupo_id, nombre, precio_extra, orden }],
 *   removibles: [{ id, nombre, orden }],
 * }
 *
 * Las 3 columnas nuevas de Fase 10 (obligatorio / min / max) vienen en
 * cada grupo. Si el backend o el admin no las configuraron, los
 * defaults de la migración (false / 0 / 99) las hacen compatibles con
 * el shape viejo.
 */
export async function getPaqueteModificadores(productoId) {
  const [grupos, adiciones, removibles] = await Promise.all([
    getGruposAdicionesByProducto(productoId),
    getAdicionesByProducto(productoId),
    getRemoviblesByProducto(productoId),
  ]);
  return { grupos, adiciones, removibles };
}

/**
 * Reemplaza el paquete completo de modificadores de un producto
 * dentro de una transacción. Pensado para el editor admin.
 *
 * Estrategia:
 * 1. SELECT FOR UPDATE sobre el producto (lock optimista — si dos
 *    admins editan a la vez, el segundo espera).
 * 2. DELETE de grupos (CASCADE borra adiciones con ese grupo_id).
 * 3. DELETE de adiciones sueltas (grupo_id IS NULL) — el CASCADE
 *    no las toma porque su FK al grupo es SET NULL.
 * 4. DELETE de removibles.
 * 5. INSERT de los nuevos.
 */
export async function replacePaqueteModificadores(productoId, payload) {
  const { grupos = [], adiciones_sueltas = [], removibles = [] } = payload;
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock del producto
    const [productoRows] = await connection.query(
      'SELECT id FROM productos WHERE id = ? FOR UPDATE',
      [productoId]
    );
    if (productoRows.length === 0) {
      throw new Error(`Producto ${productoId} no existe`);
    }

    // 2. Borrar grupos (las adiciones con ese grupo_id se ponen NULL
    //    por la FK ON DELETE SET NULL; sobreviven vivas).
    await connection.query(
      'DELETE FROM producto_grupos_adiciones WHERE producto_id = ?',
      [productoId]
    );

    // 3. NO podemos hacer DELETE FROM producto_adiciones: la FK
    //    items_pedido_adiciones.adicion_id → producto_adiciones.id
    //    es ON DELETE RESTRICT (a propósito, para que los pedidos
    //    viejos siempre apunten a una adición válida y podamos
    //    mostrarla en el ticket). Si borramos, MySQL rebota con
    //    ER_ROW_IS_REFERENCED_2.
    //
    //    Solución: soft-delete. Marcamos las viejas como activo=0.
    //    getAdicionesByProducto filtra por activo=1, así que la API
    //    no las ve; los pedidos viejos siguen apuntando a su
    //    adicion_id original y se siguen mostrando bien en el ticket
    //    (lee el snapshot de items_pedido_adiciones.nombre y
    //    .precio_unitario_adicion, no la fila viva).
    await connection.query(
      'UPDATE producto_adiciones SET activo = 0 WHERE producto_id = ?',
      [productoId]
    );

    // 4. Borrar removibles (no tienen tabla histórica, se pueden
    //    borrar sin problema).
    await connection.query(
      'DELETE FROM producto_ingredientes_removibles WHERE producto_id = ?',
      [productoId]
    );

    // 5. INSERT de los nuevos
    // 5a. Grupos
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      if (!g.nombre || !g.nombre.trim()) continue;
      // Normalizar y validar Fase 10.
      // Defaults: opcional, min=0, max=99. Coinciden con la migración.
      const obligatorio = g.obligatorio === true;
      const minSel = Math.max(0, Math.floor(Number(g.min_selecciones ?? 0)));
      const maxSelRaw = Math.floor(Number(g.max_selecciones ?? 99));
      const maxSel = Math.max(maxSelRaw, minSel); // defensa: max < min → ajustamos a min

      // Validación de Fase 10. Si el admin manda config inválida, el PUT
      // falla con 400. El controller de productos lo mapea a 400 (el
      // error ya viene con statusCode).
      if (obligatorio && minSel < 1) {
        const err = new Error(`Grupo "${g.nombre}": si es obligatorio, min_selecciones debe ser >= 1`);
        err.statusCode = 400;
        throw err;
      }
      if (maxSelRaw < minSel) {
        const err = new Error(`Grupo "${g.nombre}": max_selecciones (${maxSelRaw}) no puede ser menor que min_selecciones (${minSel})`);
        err.statusCode = 400;
        throw err;
      }

      const [res] = await connection.query(
        `INSERT INTO producto_grupos_adiciones
          (producto_id, nombre, orden, activo, obligatorio, min_selecciones, max_selecciones, creado_en)
         VALUES (?, ?, ?, 1, ?, ?, ?, NOW())`,
        [productoId, g.nombre.trim(), i, obligatorio ? 1 : 0, minSel, maxSel]
      );
      const grupoId = res.insertId;
      // Adiciones de este grupo
      for (let j = 0; j < (g.adiciones || []).length; j++) {
        const a = g.adiciones[j];
        if (!a.nombre || !a.nombre.trim()) continue;
        await connection.query(
          `INSERT INTO producto_adiciones (producto_id, grupo_id, nombre, precio_extra, orden, activo, creado_en)
           VALUES (?, ?, ?, ?, ?, 1, NOW())`,
          [
            productoId,
            grupoId,
            a.nombre.trim(),
            a.precio_extra === '' || a.precio_extra == null ? null : Number(a.precio_extra),
            j,
          ]
        );
      }
    }

    // 5b. Adiciones sueltas
    for (let j = 0; j < adiciones_sueltas.length; j++) {
      const a = adiciones_sueltas[j];
      if (!a.nombre || !a.nombre.trim()) continue;
      await connection.query(
        `INSERT INTO producto_adiciones (producto_id, grupo_id, nombre, precio_extra, orden, activo, creado_en)
         VALUES (?, NULL, ?, ?, ?, 1, NOW())`,
        [
          productoId,
          a.nombre.trim(),
          a.precio_extra === '' || a.precio_extra == null ? null : Number(a.precio_extra),
          j,
        ]
      );
    }

    // 5c. Removibles
    for (let i = 0; i < removibles.length; i++) {
      const r = removibles[i];
      if (!r.nombre || !r.nombre.trim()) continue;
      await connection.query(
        `INSERT INTO producto_ingredientes_removibles (producto_id, nombre, orden, activo, creado_en)
         VALUES (?, ?, ?, 1, NOW())`,
        [productoId, r.nombre.trim(), i]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Devolver el paquete fresco (fuera de la transacción)
  return await getPaqueteModificadores(productoId);
}

// =============================================================================
// SNAPSHOT EN ITEMS DE PEDIDO
// =============================================================================

/**
 * Inserta una fila en items_pedido_adiciones usando la connection de
 * la transacción de createOrderWithItems. Hace un SELECT para
 * snapshot del precio (por si el local lo cambió entre el PUT del
 * paquete y este INSERT).
 */
export async function insertItemAdicion(connection, { item_pedido_id, adicion_id, cantidad = 1 }) {
  // Snapshot desde producto_adiciones
  const [adicionRows] = await connection.query(
    `SELECT nombre, precio_extra FROM producto_adiciones WHERE id = ?`,
    [adicion_id]
  );
  if (adicionRows.length === 0) {
    throw new Error(`Adición ${adicion_id} no existe`);
  }
  const { nombre, precio_extra } = adicionRows[0];
  // precio_extra es NULL para adiciones gratis. En DB se guarda como
  // 0.00 (decimal no acepta null en esta columna porque necesitamos
  // poder multiplicar por cantidad). El render sabe que NULL = gratis.
  const precioUnit = precio_extra == null ? 0 : Number(precio_extra);
  const subtotal = precioUnit * Number(cantidad);
  await connection.query(
    `INSERT INTO items_pedido_adiciones
      (item_pedido_id, adicion_id, nombre, precio_unitario_adicion, cantidad, subtotal, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [item_pedido_id, adicion_id, nombre, precioUnit, cantidad, subtotal]
  );
}

/**
 * Devuelve las adiciones de un pedido, agrupadas por item_pedido_id.
 * Cada adición incluye `grupo_nombre` (snapshot — puede ser NULL si
 * la adición no pertenece a ningún grupo). El render del ticket usa
 * este campo para mostrar el heading del grupo.
 *
 * Estructura: Map<item_pedido_id, adiciones[]>
 */
export async function getItemsAdicionesByPedido(pedidoId) {
  const sql = `
    SELECT ipa.id, ipa.item_pedido_id, ipa.adicion_id, ipa.nombre,
           ipa.grupo_nombre,
           ipa.precio_unitario_adicion, ipa.cantidad, ipa.subtotal
    FROM items_pedido_adiciones ipa
    INNER JOIN items_pedido ip ON ipa.item_pedido_id = ip.id
    WHERE ip.pedido_id = ?
    ORDER BY ipa.id ASC
  `;
  const rows = await query(sql, [pedidoId]);
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.item_pedido_id)) grouped.set(row.item_pedido_id, []);
    grouped.get(row.item_pedido_id).push({
      adicion_id: row.adicion_id,
      nombre: row.nombre,
      grupo_nombre: row.grupo_nombre || null,
      precio_unitario_adicion: Number(row.precio_unitario_adicion),
      cantidad: row.cantidad,
      subtotal: Number(row.subtotal),
    });
  }
  return grouped;
}

export default {
  getGruposAdicionesByProducto,
  createGrupoAdicion,
  updateGrupoAdicion,
  deleteGrupoAdicion,
  getAdicionesByProducto,
  createAdicion,
  updateAdicion,
  deleteAdicion,
  getRemoviblesByProducto,
  createRemovible,
  updateRemovible,
  deleteRemovible,
  getPaqueteModificadores,
  replacePaqueteModificadores,
  insertItemAdicion,
  getItemsAdicionesByPedido,
};
