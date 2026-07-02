import * as RestaurantModel from '../models/Restaurant.js';
import * as StatsModel from '../models/Stats.js';
import * as BarrioModel from '../models/Barrio.js';
import * as RestauranteEnvioSectorModel from '../models/RestauranteEnvioSector.js';
import { query } from '../config/database.js';

/**
 * Calcular el costo de envío de un restaurante a un barrio/sector específico.
 * Si el restaurante tiene config de envío por sector y el barrio existe, devuelve
 * el costo configurado. Si no, devuelve el costo_fijo global. Si no hay envío
 * activo, devuelve 0.
 */
function calcularEnvioParaBarrio(restaurante, barrioId) {
  const envios = restaurante.configuracion_envios
    ? (typeof restaurante.configuracion_envios === 'string'
        ? JSON.parse(restaurante.configuracion_envios)
        : restaurante.configuracion_envios)
    : { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };

  if (!envios.activo) {
    return {
      costo: 0,
      sector_id: null,
      sector_nombre: null,
      barrio_id: barrioId || null,
      envio_gratis_aplicado: false,
      envio_activo: false
    };
  }

  // Si el cliente pasó barrio_id y el barrio existe, resolver su sector.
  // Para mantener el endpoint liviano y asíncrono-friendly, devolvemos lo que
  // podemos sincronizar sin tocar la BD. El cliente también puede llamar al
  // endpoint /api/restaurants/:id?barrio_id=X y el handler resuelve abajo.
  return {
    costo: Number(envios.costo_fijo) || 0,
    sector_id: null,
    sector_nombre: null,
    barrio_id: barrioId || null,
    envio_gratis_activo: !!envios.envio_gratis_activo,
    envio_gratis_desde: Number(envios.envio_gratis_desde) || 0,
    envio_gratis_aplicado: false,
    envio_activo: true
  };
}

/**
 * Listar todos los restaurantes aprobados
 */
export async function listRestaurants(req, res) {
  try {
    const { ciudad, nombre, categoria, q, ofrece_domicilio, tipo_negocio } = req.query;
    const filtros = {};

    if (ciudad) filtros.ciudad = ciudad;
    if (nombre) filtros.nombre = nombre;
    // `q` es la búsqueda libre del frontend (se reutiliza el campo `nombre`
    // para no romper consumidores existentes del query param).
    if (q) filtros.nombre = q;
    if (categoria) filtros.categoria = categoria;

    // Filtro de modalidad de servicio (toggle en la home pública).
    // Aceptamos: 'true' | 'false' | '1' | '0'.
    // Ausente o cualquier otro valor → no filtra (compatibilidad).
    if (ofrece_domicilio !== undefined && ofrece_domicilio !== null && ofrece_domicilio !== '') {
      const v = String(ofrece_domicilio).toLowerCase();
      if (v === 'true' || v === '1') filtros.ofrece_domicilio = true;
      else if (v === 'false' || v === '0') filtros.ofrece_domicilio = false;
    }

    // Filtro de tipo de negocio (toggle EXCLUSIVO en la home).
    // Acepta: 'restaurante' | 'comida_rapida' | 'mercado'.
    // Ausente o cualquier otro valor → no filtra por nicho (los tres
    // conviven en el listado). Este toggle reemplaza al antiguo
    // `es_mercado_abarrotes` que era acumulable; ahora cada nicho se
    // selecciona con un único botón y se excluye mutuamente.
    if (tipo_negocio !== undefined && tipo_negocio !== null && tipo_negocio !== '') {
      const t = String(tipo_negocio).toLowerCase();
      if (['restaurante', 'comida_rapida', 'mercado'].includes(t)) {
        filtros.tipo_negocio = t;
      }
    }

    const restaurantes = await RestaurantModel.getRestaurants(filtros);

    res.json({
      total: restaurantes.length,
      restaurantes
    });
  } catch (error) {
    console.error('Error listando restaurantes:', error);
    res.status(500).json({
      error: 'Error listando restaurantes',
      detalles: error.message
    });
  }
}

/**
 * Obtener detalles de un restaurante con su menú
 * Si se pasa `?barrio_id=X`, devuelve también `envio_para_barrio` con el costo
 * de envío resuelto según el sector del barrio.
 */
export async function getRestaurant(req, res) {
  try {
    const { id } = req.params;
    const { barrio_id } = req.query;

    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({
        error: 'Local no encontrado'
      });
    }

    const response = { restaurante };

    if (barrio_id) {
      try {
        const barrio = await BarrioModel.getBarrioById(Number(barrio_id));
        if (barrio) {
          const envios = restaurante.configuracion_envios
            ? (typeof restaurante.configuracion_envios === 'string'
                ? JSON.parse(restaurante.configuracion_envios)
                : restaurante.configuracion_envios)
            : { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };

          let costo = 0;
          if (envios.activo) {
            const sectorCosto = await RestauranteEnvioSectorModel.getCosto(Number(id), Number(barrio.sector_id));
            if (sectorCosto !== null && sectorCosto !== undefined) {
              costo = sectorCosto;
            } else {
              costo = Number(envios.costo_fijo) || 0;
            }
          }

          response.envio_para_barrio = {
            costo,
            sector_id: Number(barrio.sector_id),
            sector_nombre: barrio.sector_nombre,
            barrio_id: Number(barrio.id),
            barrio_nombre: barrio.nombre,
            envio_gratis_activo: !!envios.envio_gratis_activo,
            envio_gratis_desde: Number(envios.envio_gratis_desde) || 0,
            envio_gratis_aplicado: false,
            envio_activo: !!envios.activo
          };
        } else {
          response.envio_para_barrio = calcularEnvioParaBarrio(restaurante, barrio_id);
        }
      } catch (barrioError) {
        console.error('Error resolviendo envío por barrio:', barrioError);
        response.envio_para_barrio = calcularEnvioParaBarrio(restaurante, barrio_id);
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error obteniendo restaurante:', error);
    res.status(500).json({
      error: 'Error obteniendo restaurante',
      detalles: error.message
    });
  }
}

/**
 * Crear nuevo restaurante (solo para usuarios tipo restaurante)
 */
export async function createRestaurant(req, res) {
  try {
    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url
    } = req.body;

    // Validar que sea tipo restaurante
    if (req.user.tipo_usuario !== 'restaurante') {
      return res.status(403).json({ 
        error: 'Solo los usuarios con local pueden crear locales'
      });
    }

    // Validaciones
    if (!nombre || !descripcion || !direccion || !telefono) {
      return res.status(400).json({ 
        error: 'Campos requeridos: nombre, descripcion, direccion, telefono' 
      });
    }

    // Verificar que no tenga otro restaurante
    const restauranteExistente = await RestaurantModel.getRestaurantByUserId(req.user.id);
    if (restauranteExistente) {
      return res.status(409).json({ 
        error: 'Ya tienes un local registrado'
      });
    }

    // Crear restaurante
    const restauranteId = await RestaurantModel.createRestaurant({
      usuario_id: req.user.id,
      nombre,
      descripcion,
      direccion,
      telefono,
      horario_apertura,
      horario_cierre,
      imagen_url
    });

    res.status(201).json({
      mensaje: 'Local creado exitosamente. Pendiente de aprobación del administrador.',
      restaurante_id: restauranteId
    });
  } catch (error) {
    console.error('Error creando restaurante:', error);
    res.status(500).json({ 
      error: 'Error creando restaurante',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar restaurante (solo owner)
 */
export async function updateRestaurant(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // req.files es un objeto con arrays: { imagen_url: [...], banner_url: [...] }
    const files = req.files || {};
    const imagenFile = files.imagen_url?.[0];
    const bannerFile = files.banner_url?.[0];

    if ((!updateData || Object.keys(updateData).length === 0) && !imagenFile && !bannerFile) {
      return res.status(400).json({
        error: 'No se proporcionaron datos ni imágenes para actualizar'
      });
    }

    // Verificar que sea el dueño
    const restaurante = await RestaurantModel.getRestaurantById(id);

    if (!restaurante) {
      return res.status(404).json({
        error: 'Local no encontrado'
      });
    }

    if (restaurante.usuario_id !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permiso para editar este local'
      });
    }

    if (updateData && Object.keys(updateData).length > 0) {
      // Sanitizar/validar custom_config.social (Facebook / Instagram) si viene presente.
      // Solo los planes con `redes_sociales` pueden persistir estos campos.
      if (updateData.custom_config && typeof updateData.custom_config === 'object') {
        const socialInput = updateData.custom_config.social;

        if (socialInput && typeof socialInput === 'object') {
          const cleanedSocial = {};

          for (const network of ['facebook', 'instagram']) {
            const raw = socialInput[network];

            // Si no viene el campo, se omite (no se pisa lo guardado).
            if (raw === undefined) continue;

            // null o string vacío → guardar como null (permite "borrar" una URL).
            if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
              cleanedSocial[network] = null;
              continue;
            }

            // Debe ser string.
            if (typeof raw !== 'string') {
              return res.status(400).json({
                error: `URL de ${network} inválida`
              });
            }

            // Validar formato URL. new URL() lanza TypeError si no parsea.
            try {
              const parsed = new URL(raw.trim());
              // Solo aceptamos http/https (evita javascript:, data:, file:, etc.)
              if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return res.status(400).json({
                  error: `URL de ${network} inválida (solo http/https)`
                });
              }
              cleanedSocial[network] = parsed.toString();
            } catch {
              return res.status(400).json({
                error: `URL de ${network} inválida`
              });
            }
          }

          if (Object.keys(cleanedSocial).length > 0) {
            updateData.custom_config = {
              ...updateData.custom_config,
              social: cleanedSocial
            };
          } else {
            // El bloque social quedó completamente vacío → eliminarlo del custom_config.
            const { social: _omit, ...restConfig } = updateData.custom_config;
            updateData.custom_config = restConfig;
          }
        }
      }

      await RestaurantModel.updateRestaurant(id, updateData);
    }

    // Si se ha subido un archivo de imagen del restaurante, actualizar la imagen_url en la DB
    if (imagenFile) {
      const filePath = `/uploads/${imagenFile.filename}`;
      await RestaurantModel.updateRestaurant(id, { imagen_url: filePath });
    }

    // Si se ha subido un archivo de banner, actualizar la banner_url en la DB
    if (bannerFile) {
      const filePath = `/uploads/${bannerFile.filename}`;
      await RestaurantModel.updateRestaurant(id, { banner_url: filePath });
    }

    res.json({
      mensaje: 'Local actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando restaurante:', error);
    res.status(500).json({
      error: 'Error actualizando restaurante',
      detalles: error.message
    });
  }
}

/**
 * Obtener estadísticas de ventas para el restaurante
 * Solo disponible para planes Profesional y Premium
 * - Profesional: estadísticas básicas
 * - Premium: estadísticas completas avanzadas
 *
 * El control de acceso está centralizado en `resolveStatsForRestaurant`
 * (server/src/utils/statsAccess.js). No duplicar la lógica acá.
 */
export async function getRestaurantStats(req, res) {
  try {
    const { resolveStatsForRestaurant, StatsAccessError } = await import('../utils/statsAccess.js');

    const restaurante = await RestaurantModel.getRestaurantByUserId(req.user.id);

    try {
      const { estadisticas, plan, es_premium } = await resolveStatsForRestaurant(restaurante);
      res.json({ estadisticas, plan, es_premium });
    } catch (err) {
      if (err instanceof StatsAccessError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      detalles: error.message
    });
  }
}

export default {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  getRestaurantStats
};

