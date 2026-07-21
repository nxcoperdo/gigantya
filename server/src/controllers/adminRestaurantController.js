/**
 * Controller admin: edición completa de un restaurante.
 *
 * Endpoint (protegido por `requireAdmin` desde `adminRoutes.js`):
 *   - PUT /api/admin/restaurants/:id   → updateRestaurant
 *
 * Acepta multipart con `imagen_url` y/o `banner_url` (archivos)
 * + un body con los campos editables del restaurante. Mismo patrón
 * que el controller del dueño (`restaurantController.updateRestaurant`),
 * pero con dos diferencias clave:
 *
 *   1. NO chequea ownership (es admin, no dueño).
 *   2. Usa `queryOne` directo (sin filtros de estado/aprobado) para
 *      que el admin pueda editar locales pendientes de aprobación
 *      o inactivos.
 *
 * Whitelist admin-friendly: subset de `RestaurantModel.allowedFields`
 * que excluye los campos que tienen endpoints dedicados
 * (plan/fecha_vencimiento_plan/custom_config/calificacion) o que son
 * automáticos (creado_en, actualizado_en).
 *
 * Los archivos van a `uploads/restaurant-assets-admin/` (subdir
 * dedicado vía `createUploader`). El admin puede subir a cualquier
 * local sin importar el plan; si el plan no habilita `banner_home`,
 * el banner queda "latente" en BD hasta que el local upgradee.
 */
import { query, queryOne } from '../config/database.js';
import * as RestaurantModel from '../models/Restaurant.js';

// Whitelist de campos que el admin puede tocar. NO incluye plan,
// fecha_vencimiento_plan, custom_config, estado, aprobado,
// calificacion — esos tienen sus propios endpoints / reglas de
// negocio. Ver `RestaurantModel.allowedFields` (línea 481) para
// la lista completa.
const ADMIN_EDITABLE_FIELDS = [
  'nombre',
  'descripcion',
  'direccion',
  'telefono',
  'horario_apertura',
  'horario_cierre',
  'imagen_url',
  'banner_url',
  'configuracion_impuestos',
  'configuracion_envios',
  'ofrece_domicilio',
  'ofrece_consumo_en_local',
  'es_restaurante',
  'es_mercado_abarrotes',
  'es_comida_rapida',
  'es_panaderia_pasteleria',
  'tiempo_preparacion_minutos',
];

/** PUT /api/admin/restaurants/:id */
export async function updateRestaurant(req, res) {
  try {
    const { id } = req.params;
    const restaurantId = Number(id);
    if (!restaurantId || Number.isNaN(restaurantId)) {
      return res.status(400).json({ error: 'id de local inválido' });
    }

    // req.files viene de multer.fields([{name:'imagen_url'...}, {name:'banner_url'...}])
    const files = req.files || {};
    const imagenFile = files.imagen_url?.[0];
    const bannerFile = files.banner_url?.[0];

    // Filtrar updateData a la whitelist. Ignoramos silenciosamente
    // cualquier campo que el cliente envíe fuera de la whitelist
    // (incluido plan, fecha_vencimiento_plan, etc.) — defense in depth.
    const rawUpdate = req.body || {};
    const updateData = {};
    for (const key of ADMIN_EDITABLE_FIELDS) {
      if (key in rawUpdate && rawUpdate[key] !== undefined) {
        updateData[key] = rawUpdate[key];
      }
    }

    // Si el cliente mandó custom_config u otros campos prohibidos,
    // los descartamos SIN error (UX: el form no debería mandarlos,
    // pero si los manda por error, no rompemos la request).
    // Si querés ser estricto y devolver 400, acá iría un check de
    // "campos no permitidos".

    if (Object.keys(updateData).length === 0 && !imagenFile && !bannerFile) {
      return res.status(400).json({
        error: 'No se proporcionaron datos ni imágenes para actualizar',
      });
    }

    // Verificar que el local existe. Usamos queryOne directo (sin
    // filtros de estado/aprobado) para que el admin pueda editar
    // locales pendientes o inactivos.
    const restaurante = await queryOne(
      'SELECT id, nombre FROM restaurantes WHERE id = ? LIMIT 1',
      [restaurantId]
    );
    if (!restaurante) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    // Parsear configuracion_impuestos / configuracion_envios si
    // vinieron como string (caso típico de FormData con append de
    // JSON.stringify). El modelo espera un objeto o un string JSON
    // válido; el updateRestaurant los guarda como JSON column.
    if (typeof updateData.configuracion_impuestos === 'string') {
      try {
        updateData.configuracion_impuestos = JSON.parse(updateData.configuracion_impuestos);
      } catch (e) {
        return res.status(400).json({
          error: 'configuracion_impuestos no es un JSON válido',
        });
      }
    }
    if (typeof updateData.configuracion_envios === 'string') {
      try {
        updateData.configuracion_envios = JSON.parse(updateData.configuracion_envios);
      } catch (e) {
        return res.status(400).json({
          error: 'configuracion_envios no es un JSON válido',
        });
      }
    }

    // Persistir cambios de campos (si hay)
    if (Object.keys(updateData).length > 0) {
      await RestaurantModel.updateRestaurant(restaurantId, updateData);
    }

    // Si vino un archivo de imagen, persistir la URL.
    // Usamos la ruta con subdir para que el express.static('/uploads')
    // pueda servirla. El factory createUploader guarda el archivo
    // en uploads/<subdir>/<random>.<ext> y expone solo el basename
    // en req.file.filename — por eso construimos la URL completa acá.
    const filesChanged = [];
    if (imagenFile) {
      const filePath = `/uploads/restaurant-assets-admin/${imagenFile.filename}`;
      await RestaurantModel.updateRestaurant(restaurantId, { imagen_url: filePath });
      filesChanged.push(`imagen_url=${filePath}`);
    }
    if (bannerFile) {
      const filePath = `/uploads/restaurant-assets-admin/${bannerFile.filename}`;
      await RestaurantModel.updateRestaurant(restaurantId, { banner_url: filePath });
      filesChanged.push(`banner_url=${filePath}`);
    }

    // Traer el local actualizado para devolverlo al front
    const actualizado = await queryOne(
      'SELECT * FROM restaurantes WHERE id = ? LIMIT 1',
      [restaurantId]
    );

    // Logging. Mismo formato que adminHomeMediaController.
    console.log(
      `[admin-restaurant] Local ${restaurantId} ("${restaurante.nombre}") ` +
      `editado por admin=${req.user?.id || '?'} ` +
      `campos=${Object.keys(updateData).join(',') || '(ninguno)'} ` +
      `archivos=${filesChanged.join(',') || '(ninguno)'}`
    );

    res.json({
      mensaje: 'Local actualizado exitosamente',
      restaurante: actualizado,
    });
  } catch (error) {
    console.error('[admin-restaurant] error:', error);
    res.status(500).json({
      error: 'Error actualizando local',
      detalles: error.message,
    });
  }
}
