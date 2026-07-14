import * as SearchModel from '../models/Search.js';

/**
 * Whitelist de tipos de negocio válidos. Espeja los valores que acepta el
 * toggle exclusivo de la home pública (`tipoNegocioFilter` en HomePage.jsx).
 * Mantener en sync con `server/src/models/Restaurant.js` y `Product.js`.
 */
const TIPOS_NEGOCIO_VALIDOS = new Set([
  'restaurante',
  'comida_rapida',
  'mercado',
  'panaderia_pasteleria',
]);

/**
 * GET /api/search?q=&tipo_negocio=&limit=
 *
 * Sugerencias en vivo para el autocomplete de la barra de búsqueda de la
 * home del cliente. Devuelve hasta `limit` (default 5, clamp 1-10)
 * restaurantes y `limit` productos en una sola respuesta, en paralelo
 * (Promise.all) para minimizar la latencia.
 *
 * Endpoint público (sin auth): un visitante anónimo también puede buscar.
 * Rate-limit cubierto por el `apiLimiter` global (1000 req / 15 min por IP).
 *
 * Validaciones:
 *   - `q` requerido, trim, length 2..100. Si falta o es muy corto → 400.
 *   - `tipo_negocio` opcional. Si está pero no está en la whitelist → 400.
 *   - `limit` opcional. Si no es entero válido en [1, 10] → se ignora
 *     silenciosamente y se usa 5 (defensa contra requests raros, no rompe
 *     al cliente).
 */
export async function suggest(req, res) {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (rawQ.length < 2 || rawQ.length > 100) {
      return res.status(400).json({
        error: 'El parámetro "q" es requerido y debe tener entre 2 y 100 caracteres',
      });
    }

    let tipoNegocio = null;
    if (req.query.tipo_negocio !== undefined && req.query.tipo_negocio !== '') {
      const t = String(req.query.tipo_negocio).toLowerCase();
      if (!TIPOS_NEGOCIO_VALIDOS.has(t)) {
        return res.status(400).json({
          error: `"tipo_negocio" debe ser uno de: ${Array.from(TIPOS_NEGOCIO_VALIDOS).join(', ')}`,
        });
      }
      tipoNegocio = t;
    }

    let limit = 5;
    if (req.query.limit !== undefined) {
      const parsed = Number.parseInt(req.query.limit, 10);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 10) {
        limit = parsed;
      }
    }

    const [restaurantes, productos] = await Promise.all([
      SearchModel.suggestRestaurants({ q: rawQ, tipo_negocio: tipoNegocio, limit }),
      SearchModel.suggestProducts({ q: rawQ, tipo_negocio: tipoNegocio, limit }),
    ]);

    return res.json({ restaurantes, productos });
  } catch (error) {
    console.error('Error en /api/search:', error);
    return res.status(500).json({
      error: 'Error buscando sugerencias',
      detalles: error.message,
    });
  }
}

export default { suggest };
