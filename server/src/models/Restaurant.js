import { query, queryOne } from '../config/database.js';

/**
 * Crear nuevo restaurante
 */
export async function createRestaurant(restaurantData) {
  const {
    usuario_id,
    nombre,
    descripcion,
    direccion,
    telefono,
    horario_apertura,
    horario_cierre,
    imagen_url,
    // FIX: la migración inicial define la ciudad con tilde ('Gigante, Huila').
    // Unificamos para evitar inconsistencias al filtrar por ciudad.
    ciudad = 'Gigante, Huila',
    ofrece_domicilio = true,
    // Flag de modalidad "consumo en el local" (comer en la mesa). El
    // admin lo activa desde el panel admin. Default FALSE: los locales
    // nuevos no ofrecen esta opción hasta que el admin la habilite.
    ofrece_consumo_en_local = false,
    // Flags de nicho. Default conservador para locales nuevos: "es
    // restaurante" en TRUE (caso más común), los otros dos en FALSE. El
    // admin los cambia desde el dashboard con los toggles correspondientes.
    es_restaurante = true,
    es_mercado_abarrotes = false,
    es_comida_rapida = false,
  } = restaurantData;

  const sql = `
    INSERT INTO restaurantes (
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      estado,
      aprobado,
      ofrece_domicilio,
      ofrece_consumo_en_local,
      es_restaurante,
      es_mercado_abarrotes,
      es_comida_rapida,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, ?, ?, ?, ?, ?, NOW())
  `;

  try {
    const result = await query(sql, [
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      // MySQL TINYINT(1): pasamos 1/0 directamente. Boolean() ya nos da un
      // boolean nativo; la coerción a 0/1 la hacemos nosotros para no
      // depender del driver.
      ofrece_domicilio ? 1 : 0,
      ofrece_consumo_en_local ? 1 : 0,
      es_restaurante ? 1 : 0,
      es_mercado_abarrotes ? 1 : 0,
      es_comida_rapida ? 1 : 0,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando restaurante: ${error.message}`);
  }
}

/**
 * Crear nuevo restaurante con una conexión específica (para transacciones)
 */
export async function createRestaurantWithConnection(restaurantData, connection) {
  const {
    usuario_id,
    nombre,
    descripcion,
    direccion,
    telefono,
    horario_apertura,
    horario_cierre,
    imagen_url,
    ciudad = 'Gigante, Huila',
    // Default `true` para mantener compatibilidad con la migración previa
    // (los restaurantes existentes en BD quedan con `ofrece_domicilio = 1`).
    // Al crear uno nuevo desde el admin se respeta lo que el admin haya elegido.
    ofrece_domicilio = true,
    // Flags de nicho. Mismos defaults que `createRestaurant`: es_restaurante
    // en TRUE (caso común), los otros en FALSE. Se respetan los valores
    // que el admin haya pasado en el payload.
    es_restaurante = true,
    es_mercado_abarrotes = false,
    es_comida_rapida = false,
  } = restaurantData;

  const sql = `
    INSERT INTO restaurantes (
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      estado,
      aprobado,
      ofrece_domicilio,
      es_restaurante,
      es_mercado_abarrotes,
      es_comida_rapida,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, ?, ?, ?, ?, NOW())
  `;

  try {
    const [result] = await connection.query(sql, [
      usuario_id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url,
      ciudad,
      // MySQL TINYINT(1): pasamos 1/0 directamente. Boolean() ya nos da un
      // boolean nativo; la coerción a 1/0 la hacemos nosotros para no
      // depender del driver.
      ofrece_domicilio ? 1 : 0,
      es_restaurante ? 1 : 0,
      es_mercado_abarrotes ? 1 : 0,
      es_comida_rapida ? 1 : 0,
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando restaurante: ${error.message}`);
  }
}

/**
 * Obtener todos los restaurantes aprobados
 */
export async function getRestaurants(filtros = {}) {
  // Detectar nombre real de la columna de puntaje en `calificaciones`
  // (la BD puede llamarse `calificacion` o `puntuacion` según la migración).
  const cols = await query("SHOW COLUMNS FROM calificaciones");
  const ratingCol =
    cols.find(c => c.Field === 'calificacion') ? 'calificacion' :
    cols.find(c => c.Field === 'puntuacion') ? 'puntuacion' : null;

  let sql = `
    SELECT r.*,
           COALESCE(AVG(c.${ratingCol ?? 'calificacion'}), 0) AS calificacion_promedio,
           COUNT(c.id) AS total_calificaciones
    FROM restaurantes r
    JOIN usuarios u ON r.usuario_id = u.id
    LEFT JOIN calificaciones c ON c.restaurante_id = r.id
    WHERE r.estado = 'activo'
      AND r.aprobado = 1
      AND u.estado = 'activo'
      AND (r.plan = 'basico' OR r.fecha_vencimiento_plan IS NULL OR r.fecha_vencimiento_plan >= NOW())
  `;
  const params = [];

  if (filtros.ciudad) {
    sql += ' AND ciudad LIKE ?';
    params.push(`%${filtros.ciudad}%`);
  }

  if (filtros.nombre) {
    sql += ' AND nombre LIKE ?';
    params.push(`%${filtros.nombre}%`);
  }

  // Filtro por categoría de producto: el restaurante debe tener al menos
  // un producto activo en una categoría con ese nombre Y de tipo compatible
  // con el nicho activo. Cada nicho tiene su propio namespace de categorías
  // (un "Hamburguesas" de comida rápida es distinto del de un restaurante).
  if (filtros.categoria) {
    // El tipo de categoría a buscar depende del nicho seleccionado:
    //   - 'restaurante'    → tipo_negocio='restaurante'
    //   - 'comida_rapida'  → tipo_negocio='comida_rapida'
    //   - 'mercado'        → tipo_negocio='mercado'
    //   - undefined/'todos' → mostrar restaurantes de cualquier nicho
    //     que tengan la categoría con ese nombre (búsqueda global).
    let tipoCategoria;
    if (filtros.tipo_negocio === 'mercado') tipoCategoria = 'mercado';
    else if (filtros.tipo_negocio === 'comida_rapida') tipoCategoria = 'comida_rapida';
    else if (filtros.tipo_negocio === 'restaurante') tipoCategoria = 'restaurante';
    // Si tipo_negocio es undefined/'todos', tipoCategoria queda undefined
    // y la query matchea cualquier tipo_negocio (sin restricción).

    if (tipoCategoria) {
      sql += ` AND EXISTS (
        SELECT 1 FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.restaurante_id = r.id
          AND p.estado = 'activo'
          AND c.nombre = ?
          AND c.tipo_negocio = ?
      )`;
      params.push(filtros.categoria, tipoCategoria);
    } else {
      // Sin nicho específico: aceptar cualquier tipo_negocio que coincida.
      sql += ` AND EXISTS (
        SELECT 1 FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.restaurante_id = r.id
          AND p.estado = 'activo'
          AND c.nombre = ?
      )`;
      params.push(filtros.categoria);
    }
  }

  // Filtro por modalidad de servicio:
  //   - true  → solo restaurantes con `ofrece_domicilio = 1` (Con domicilios)
  //   - false → solo restaurantes con `ofrece_domicilio = 0` (Solo retiro en local)
  //   - undefined/null → no se filtra (compatibilidad con llamadas existentes).
  // Como la columna tiene DEFAULT 1, MySQL la rellena automáticamente para
  // filas anteriores a esta migración, así que el filtro siempre es seguro.
  if (filtros.ofrece_domicilio === true) {
    sql += ' AND r.ofrece_domicilio = 1';
  } else if (filtros.ofrece_domicilio === false) {
    sql += ' AND r.ofrece_domicilio = 0';
  }

  // Filtro por tipo de negocio (toggle exclusivo en la home pública).
  // Acepta: 'restaurante' | 'comida_rapida' | 'mercado' | 'panaderia_pasteleria'.
  //   - 'restaurante'           → solo locales con es_restaurante=1
  //                               (locales "solo restaurante" Y combos restaurante
  //                                + comida rápida aparecen aquí; los "solo comida
  //                                rápida" quedan fuera)
  //   - 'comida_rapida'         → solo locales con es_comida_rapida=1
  //                               (locales "solo comida rápida" Y combos restaurante
  //                                + comida rápida aparecen aquí)
  //   - 'mercado'               → solo locales con es_mercado_abarrotes=1
  //                               (nicho excluyente: un mercado nunca participa de
  //                                los feeds 'restaurante' ni 'comida_rapida')
  //   - 'panaderia_pasteleria'  → solo locales con es_panaderia_pasteleria=1
  //                               (nuevo nicho, agregable vía migración
  //                                20260703000001_add_panaderia_pasteleria_nicho.
  //                                Combinable con restaurante y comida rápida;
  //                                excluyente con mercado).
  //   - undefined/null          → NO filtra por nicho (los cuatro conviven
  //                               en el listado)
  //
  // El flag `es_restaurante` (agregado en la migración
  // 20260702000001_add_es_restaurante_to_restaurantes.js) hace explícita
  // la participación del local en el nicho restaurante. Sin este flag el
  // modelo no podía distinguir "solo restaurante" de "solo comida rápida"
  // — los dos compartían el mismo estado booleano. La rama "combo" (1,1)
  // sale en los dos feeds, que es el caso de uso que motivó este cambio.
  if (filtros.tipo_negocio === 'comida_rapida') {
    sql += ' AND r.es_comida_rapida = 1';
  } else if (filtros.tipo_negocio === 'mercado') {
    sql += ' AND r.es_mercado_abarrotes = 1';
  } else if (filtros.tipo_negocio === 'restaurante') {
    // "Restaurante" se modela como presencia del flag dedicado
    // (es_restaurante=1), no como ausencia de los otros. Esto distingue
    // "solo restaurante" de "solo comida rápida" — algo que el modelo
    // anterior (ausencia de los otros dos) no podía expresar.
    sql += ' AND r.es_restaurante = 1';
  } else if (filtros.tipo_negocio === 'panaderia_pasteleria') {
    sql += ' AND r.es_panaderia_pasteleria = 1';
  }
  // Si no llega tipo_negocio, no se agrega ningún filtro por nicho y los
  // cuatro tipos de locales aparecen en el resultado (visibilidad compartida).

  sql += ' GROUP BY r.id ORDER BY FIELD(plan, "premium", "profesional", "basico"), creado_en DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo restaurantes: ${error.message}`);
  }
}

/**
 * Obtener restaurante por ID con sus productos
 */
export async function getRestaurantById(id) {
  const sql = `
    SELECT r.*
    FROM restaurantes r
    JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.id = ? AND r.estado = 'activo' AND u.estado = 'activo'
  `;

  const restaurante = await queryOne(sql, [id]);
  
  if (!restaurante) return null;

  // Parsear campos JSON
  if (restaurante.configuracion_impuestos) {
    try {
      restaurante.configuracion_impuestos = JSON.parse(restaurante.configuracion_impuestos);
    } catch (e) {
      console.error('Error parsing configuracion_impuestos:', e);
      restaurante.configuracion_impuestos = { activo: true, porcentaje: 8 };
    }
  } else {
    restaurante.configuracion_impuestos = { activo: true, porcentaje: 8 };
  }

  if (restaurante.configuracion_envios) {
    try {
      restaurante.configuracion_envios = JSON.parse(restaurante.configuracion_envios);
    } catch (e) {
      console.error('Error parsing configuracion_envios:', e);
      restaurante.configuracion_envios = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };
    }
  } else {
    restaurante.configuracion_envios = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };
  }

  // Obtener categorías y productos
  const productos = await query(`
    SELECT 
      p.id,
      p.nombre,
      p.descripcion,
      p.precio,
      p.imagen_url,
      p.disponible,
      c.id as categoria_id,
      c.nombre as categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.restaurante_id = ? AND p.estado = 'activo'
    ORDER BY c.nombre, p.nombre
  `, [id]);

  // Agrupar por categoría
  restaurante.productos = {};
  productos.forEach(p => {
    const categoria = p.categoria_nombre || 'Sin categoría';
    if (!restaurante.productos[categoria]) {
      restaurante.productos[categoria] = [];
    }
    restaurante.productos[categoria].push({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      imagen_url: p.imagen_url,
      disponible: p.disponible === 1
    });
  });

  return restaurante;
}

/**
 * Obtener restaurante por usuario_id
 */
export async function getRestaurantByUserId(usuario_id) {
  const sql = 'SELECT * FROM restaurantes WHERE usuario_id = ? LIMIT 1';
  return queryOne(sql, [usuario_id]);
}

/**
 * Obtener datos del usuario propietario del restaurante
 */
export async function getRestaurantUser(restaurante_id) {
  const sql = `
    SELECT u.id, u.email, u.nombre, u.telefono
    FROM usuarios u
    INNER JOIN restaurantes r ON u.id = r.usuario_id
    WHERE r.id = ?
    LIMIT 1
  `;
  return queryOne(sql, [restaurante_id]);
}

/**
 * Obtener usuario por ID
 */
export async function getUserById(id) {
  const sql = 'SELECT id, email, nombre, telefono FROM usuarios WHERE id = ? LIMIT 1';
  return queryOne(sql, [id]);
}

/**
 * Actualizar restaurante
 */
export async function updateRestaurant(id, updateData) {
  const allowedFields = [
    'nombre',
    'descripcion',
    'direccion',
    'telefono',
    'horario_apertura',
    'horario_cierre',
    'imagen_url',
    'plan',
    'banner_url',
    'custom_config',
    'configuracion_impuestos',
    'configuracion_envios',
    'fecha_vencimiento_plan',
    // Modalidad de servicio (toggle en el dashboard del restaurante).
    // - true  → "Ofrece servicio a domicilio"
    // - false → "Solo retiro en local"
    'ofrece_domicilio',
    // Modalidad "consumo en el local" (comer en la mesa). El admin lo
    // activa desde el panel admin (`/admin/restaurants/:id/ofrece-consumo-en-local`).
    // - true  → el cliente puede elegir "Consumo en el local" en el checkout
    // - false → el botón aparece deshabilitado en el checkout
    'ofrece_consumo_en_local',
    // Tipo de negocio "Restaurante" (switch en el dashboard admin). Default
    // TRUE al crear locales nuevos: un local recién creado participa del
    // nicho restaurante salvo que el admin explícitamente lo desactive
    // (caso típico: registrar una hamburguesería como "solo comida rápida").
    'es_restaurante',
    // Tipo de negocio "Mercado y abarrotes" (switch en el dashboard admin).
    // Acumulable con `ofrece_domicilio`: un mercado puede ofrecer domicilio
    // o no, en cualquier combinación.
    'es_mercado_abarrotes',
    // Tipo de negocio "Comida rápida" (switch en el dashboard admin).
    // Mismo patrón que `es_mercado_abarrotes`. Mutuamente excluyente en
    // la UI (un restaurante no puede ser comida rápida Y mercado a la vez),
    // pero ambos flags persisten independientes en la BD para permitir
    // transiciones sin pérdida de datos. Combinable con `es_restaurante`
    // para el caso "restaurante + comida rápida" (combo).
    'es_comida_rapida',
    // Cuarto nicho (agregado en la migración
    // 20260703000001_add_panaderia_pasteleria_nicho.js). Combinable con
    // `es_restaurante` y `es_comida_rapida`. Mutuamente excluyente con
    // `es_mercado_abarrotes` (esa exclusión se valida solo en la UI).
    'es_panaderia_pasteleria',
    // Tiempo estimado de preparación del pedido en minutos (input en
    // `RestaurantModal.jsx`, mostrado en el header de
    // `RestaurantDetailsPage.jsx`). Es un entero positivo o `null` para
    // indicar "no configurado" (el frontend no muestra nada en ese caso).
    // Migración: 20260705000001_add_tiempo_preparacion_minutos_to_restaurantes.js
    'tiempo_preparacion_minutos',
  ];

  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Los datos de actualización deben ser un objeto válido');
  }

  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  let sql = 'UPDATE restaurantes SET ';
  const values = [];

  // Campos booleanos que la columna MySQL guarda como INT/TINYINT (0/1).
  // El frontend los manda como boolean JS → al serializar a JSON se vuelven 'true'/'false',
  // lo que MySQL rechaza con ER_TRUNCATED_WRONG_VALUE_FOR_FIELD. Normalizamos a 0/1 antes de bind.
  const booleanIntFields = new Set(['ofrece_domicilio', 'ofrece_consumo_en_local', 'es_restaurante', 'es_mercado_abarrotes', 'es_comida_rapida', 'es_panaderia_pasteleria']);

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;

    let value = updateData[field];
    // Stringify objects for JSON columns
    if ((field === 'custom_config' || field === 'configuracion_pagos' || field === 'configuracion_impuestos' || field === 'configuracion_envios') && typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }
    // Normalizar booleanos a 0/1 para columnas INT.
    if (booleanIntFields.has(field)) {
      value = value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    }
    values.push(value);
  });

  sql += ', actualizado_en = NOW() WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando restaurante: ${error.message}`);
  }
}

/**
 * Aprobar restaurante (solo admin)
 */
export async function approveRestaurant(id) {
  const sql = 'UPDATE restaurantes SET aprobado = 1 WHERE id = ?';
  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error aprobando restaurante: ${error.message}`);
  }
}

/**
 * Rechazar restaurante (solo admin)
 */
export async function rejectRestaurant(id) {
  const sql = 'UPDATE restaurantes SET estado = "rechazado" WHERE id = ?';
  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error rechazando restaurante: ${error.message}`);
  }
}

export default {
  createRestaurant,
  createRestaurantWithConnection,
  getRestaurants,
  getRestaurantById,
  getRestaurantByUserId,
  getRestaurantUser,
  getUserById,
  updateRestaurant,
  approveRestaurant,
  rejectRestaurant
};

