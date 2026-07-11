import { query, queryOne } from '../config/database.js';

/**
 * Crear nueva categoría
 */
export async function createCategory(restaurante_id, nombre, descripcion = '') {
  const sql = `
    INSERT INTO categorias (restaurante_id, nombre, descripcion)
    VALUES (?, ?, ?)
  `;

  try {
    const result = await query(sql, [restaurante_id, nombre, descripcion]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando categoría: ${error.message}`);
  }
}

/**
 * Crear nuevo producto
 */
export async function createProduct(productData) {
  const {
    restaurante_id,
    categoria_id,
    nombre,
    descripcion,
    precio,
    imagen_url,
    disponible = true
  } = productData;

  // Defensa: si el front manda categoria_id como string vacío, la columna INT
  // (nullable) lo rechaza con ER_TRUNCATED_WRONG_VALUE_FOR_FIELD. Mapeamos
  // '' → null para guardar "sin categoría" en vez de crashear el INSERT.
  // Misma lógica aplicada en updateProduct más abajo.
  const safeCategoriaId = categoria_id === '' ? null : categoria_id;

  const sql = `
    INSERT INTO productos (
      restaurante_id,
      categoria_id,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible,
      estado,
      creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', NOW())
  `;

  try {
    const result = await query(sql, [
      restaurante_id,
      safeCategoriaId,
      nombre,
      descripcion,
      precio,
      imagen_url,
      disponible ? 1 : 0
    ]);
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creando producto: ${error.message}`);
  }
}

/**
 * Obtener productos por restaurante
 */
export async function getProductsByRestaurant(restaurante_id) {
  // `tiene_modificadores` permite al cliente saber en el render inicial
  // si debe abrir el modal de customización (Rappi-style) o agregar
  // directo. Se computa con dos EXISTS a producto_adiciones y
  // producto_ingredientes_removibles. Cada EXISTS es O(log n) gracias
  // a los índices (producto_id, orden) que crea la migración
  // 20260708000001_modificadores_producto.
  const sql = `
    SELECT
      p.*,
      c.nombre AS categoria_nombre,
      c.orden  AS categoria_orden,
      EXISTS(
        SELECT 1 FROM producto_adiciones
        WHERE producto_id = p.id AND activo = 1
      ) AS tiene_adiciones,
      EXISTS(
        SELECT 1 FROM producto_ingredientes_removibles
        WHERE producto_id = p.id AND activo = 1
      ) AS tiene_removibles,
      (
        EXISTS(SELECT 1 FROM producto_adiciones WHERE producto_id = p.id AND activo = 1)
        OR EXISTS(SELECT 1 FROM producto_ingredientes_removibles WHERE producto_id = p.id AND activo = 1)
      ) AS tiene_modificadores
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.restaurante_id = ? AND p.estado = 'activo'
    ORDER BY c.orden ASC, p.nombre ASC
  `;

  try {
    return await query(sql, [restaurante_id]);
  } catch (error) {
    throw new Error(`Error obteniendo productos: ${error.message}`);
  }
}

/**
 * Obtener producto por ID
 */
export async function getProductById(id) {
  const sql = 'SELECT * FROM productos WHERE id = ? AND estado = "activo"';
  return queryOne(sql, [id]);
}

/**
 * Listar productos de todos los restaurantes aprobados y activos,
 * con el nombre/plan del restaurante padre y la categoría del producto
 * ya unidos. Pensado para el feed público de la home (vista "Productos").
 *
 * Ordena por plan del restaurante (premium → profesional → basico) y,
 * dentro del mismo plan, por producto más reciente. Replica los mismos
 * filtros que `RestaurantModel.getRestaurants` para que nunca aparezca
 * un producto cuyo restaurante esté pendiente de aprobación, inactivo,
 * o con plan vencido.
 */
export async function getAllProducts(filtros = {}) {
  let sql = `
    SELECT
      p.*,
      c.nombre  AS categoria_nombre,
      c.orden   AS categoria_orden,
      r.nombre  AS restaurante_nombre,
      r.plan    AS restaurante_plan,
      r.ciudad  AS restaurante_ciudad,
      r.horario_apertura AS restaurante_horario_apertura,
      r.horario_cierre   AS restaurante_horario_cierre
    FROM productos p
    JOIN restaurantes r ON p.restaurante_id = r.id
    JOIN usuarios     u ON r.usuario_id = u.id
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.estado = 'activo'
      AND r.estado = 'activo'
      AND r.aprobado = 1
      AND u.estado = 'activo'
      AND (r.plan = 'basico' OR r.fecha_vencimiento_plan IS NULL OR r.fecha_vencimiento_plan >= NOW())
  `;
  const params = [];

  if (filtros.categoria) {
    sql += ' AND c.nombre = ?';
    params.push(filtros.categoria);
  }

  // Filtro por tipo de negocio (toggle exclusivo en la home).
  // Mismo patrón que `RestaurantModel.getRestaurants`:
  //   - 'comida_rapida'        → solo productos de locales con es_comida_rapida=1
  //                              (locales "solo comida rápida" Y combos restaurante
  //                               + comida rápida aparecen aquí)
  //   - 'mercado'              → solo productos de locales con es_mercado_abarrotes=1
  //                              (sin participar de restaurante ni comida rápida —
  //                               un mercado sigue siendo nicho excluyente)
  //   - 'restaurante'          → solo productos de locales con es_restaurante=1
  //                              (locales "solo restaurante" Y combos restaurante
  //                               + comida rápida aparecen aquí; los "solo comida
  //                               rápida" quedan fuera)
  //   - 'panaderia_pasteleria' → solo productos de locales con es_panaderia_pasteleria=1
  //                              (nuevo nicho, agregable vía migración
  //                               20260703000001_add_panaderia_pasteleria_nicho.
  //                               Combinable con restaurante y comida rápida;
  //                               excluyente con mercado).
  //   - undefined/null         → no filtra por nicho (los cuatro conviven en el feed)
  //
  // El flag `es_restaurante` (agregado en la migración
  // 20260702000001_add_es_restaurante_to_restaurantes.js) hace explícita
  // la participación del local en el nicho restaurante. Combinado con
  // `es_comida_rapida` permite combos: (1,1) → el local sale en ambos
  // feeds. Combinado con `es_mercado_abarrotes` (que sigue siendo
  // excluyente) un mercado nunca aparece en 'restaurante' ni
  // 'comida_rapida'.
  //
  // Antes de esta migración el feed ocultaba los mercados por defecto; eso
  // cambió para que el cliente vea los tres nichos mezclados por defecto y
  // use el toggle para segmentar.
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
  // Si filtros.tipo_negocio no llega, no se aplica ningún filtro por nicho
  // y los cuatro tipos de locales aparecen en el feed.

  // Mismo orden que la lista de restaurantes: premium → profesional → basico.
  // Dentro de cada plan, los productos más recientes primero.
  sql += ' ORDER BY FIELD(r.plan, "premium", "profesional", "basico"), p.creado_en DESC';

  try {
    return await query(sql, params);
  } catch (error) {
    throw new Error(`Error obteniendo productos: ${error.message}`);
  }
}

/**
 * Actualizar producto
 */
export async function updateProduct(id, updateData) {
  const allowedFields = [
    'categoria_id',
    'nombre',
    'descripcion',
    'precio',
    'imagen_url',
    'disponible',
    // FIX: el campo `destacado` se validaba por plan en
    // productController pero no estaba en allowedFields → era código muerto.
    // Ahora el toggle de destacado realmente persiste.
    'destacado',
  ];

  const fields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (fields.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  let sql = 'UPDATE productos SET ';
  const values = [];

  fields.forEach((field, index) => {
    if (index > 0) sql += ', ';
    sql += `${field} = ?`;

    // Defensa en profundidad: si el front manda categoria_id como string vacío,
    // la columna INT lo rechaza con ER_TRUNCATED_WRONG_VALUE_FOR_FIELD.
    // Mapeamos '' → null para que el UPDATE no rompa (la columna acepta NULL).
    if (field === 'categoria_id' && updateData[field] === '') {
      values.push(null);
    } else if (field === 'disponible' || field === 'destacado') {
      // Convertir boolean a 0/1 para los flags
      values.push(updateData[field] ? 1 : 0);
    } else {
      values.push(updateData[field]);
    }
  });

  sql += ', actualizado_en = NOW() WHERE id = ?';
  values.push(id);

  try {
    await query(sql, values);
    return true;
  } catch (error) {
    throw new Error(`Error actualizando producto: ${error.message}`);
  }
}

/**
 * Eliminar producto (soft delete)
 */
export async function deleteProduct(id) {
  const sql = 'UPDATE productos SET estado = "eliminado" WHERE id = ?';

  try {
    await query(sql, [id]);
    return true;
  } catch (error) {
    throw new Error(`Error eliminando producto: ${error.message}`);
  }
}

/**
 * Toggle disponibilidad de producto
 */
export async function toggleProductAvailability(id) {
  const product = await getProductById(id);
  if (!product) throw new Error('Producto no encontrado');

  return updateProduct(id, {
    disponible: !product.disponible
  });
}

/**
 * Buscar productos
 */
export async function searchProducts(restaurante_id, query_text) {
  const sql = `
    SELECT * FROM productos
    WHERE restaurante_id = ? 
    AND estado = 'activo'
    AND (nombre LIKE ? OR descripcion LIKE ?)
    ORDER BY nombre
  `;

  try {
    return await query(sql, [
      restaurante_id,
      `%${query_text}%`,
      `%${query_text}%`
    ]);
  } catch (error) {
    throw new Error(`Error buscando productos: ${error.message}`);
  }
}

// =============================================================
// Galería de imágenes (plan Profesional/Premium)
// =============================================================

/**
 * Añadir una imagen a la galería del producto.
 * El campo legacy `imagen_url` de la tabla `productos` se mantiene
 * como "foto principal" (la primera imagen que se subió).
 */
export async function addProductImage(producto_id, imagen_url, orden = 0) {
  const sql = `
    INSERT INTO producto_imagenes (producto_id, imagen_url, orden)
    VALUES (?, ?, ?)
  `;
  const result = await query(sql, [producto_id, imagen_url, orden]);
  return result.insertId;
}

/**
 * Listar todas las imágenes de un producto, ordenadas.
 */
export async function getProductImages(producto_id) {
  const sql = `
    SELECT id, imagen_url, orden, creado_en
    FROM producto_imagenes
    WHERE producto_id = ?
    ORDER BY orden ASC, id ASC
  `;
  return query(sql, [producto_id]);
}

/**
 * Eliminar una imagen de la galería.
 */
export async function deleteProductImage(imagen_id, producto_id) {
  const sql = 'DELETE FROM producto_imagenes WHERE id = ? AND producto_id = ?';
  return query(sql, [imagen_id, producto_id]);
}

/**
 * Cuántas imágenes tiene ya un producto (para validar el límite del plan
 * antes de subir más).
 */
export async function countProductImages(producto_id) {
  const sql = 'SELECT COUNT(*) AS total FROM producto_imagenes WHERE producto_id = ?';
  const row = await queryOne(sql, [producto_id]);
  return row?.total || 0;
}

/**
 * Cuenta los productos ACTIVOS de un restaurante.
 * Se usa para validar el límite `max_productos` del plan Free (10 productos).
 * Solo contamos los activos porque los inactivos (soft-delete via estado)
 * ya no ocupan cupo en el menú.
 */
export async function countActiveProductsByRestaurant(restaurante_id) {
  const sql = `
    SELECT COUNT(*) AS total
    FROM productos
    WHERE restaurante_id = ? AND estado = 'activo'
  `;
  const row = await queryOne(sql, [restaurante_id]);
  return row?.total || 0;
}

export default {
  createCategory,
  createProduct,
  getProductsByRestaurant,
  getProductById,
  getAllProducts,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  searchProducts,
  // Galería de imágenes (plan Profesional/Premium)
  addProductImage,
  getProductImages,
  deleteProductImage,
  countProductImages,
  countActiveProductsByRestaurant,
};

