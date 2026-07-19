/**
 * Middleware para endpoints del chat del lado del VENDEDOR.
 *
 * Acepta: tipo_usuario in ('restaurante', 'cajero', 'mesero', 'cocina', 'admin')
 * y exige que el user esté atado a un restaurante_id (los clientes no).
 * Para el caso 'admin' general (sin restaurante_id), se permite porque el
 * admin del sistema podría ver chats de cualquier local en soporte, pero la
 * validación fina del restaurante del chat se hace en el controller.
 *
 * IMPORTANTE: este middleware asume que verifyToken ya corrió y pobló
 * `req.user` (incluyendo `restaurante_id`).
 */
export function requireVendedor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const rolesPermitidos = ['restaurante', 'cajero', 'mesero', 'cocina', 'admin'];
  if (!rolesPermitidos.includes(req.user.tipo_usuario)) {
    return res.status(403).json({ error: 'Solo personal del local puede acceder al chat' });
  }
  next();
}

/**
 * Verifica que el user autenticado pertenezca al restaurante_id que viene
 * en params (:id de la conversación) o en body. Para admin sin
 * restaurante_id, deja pasar (porque puede ver cualquier local).
 *
 * Importante: para usuarios `tipo_usuario='restaurante'`, si la columna
 * `usuarios.restaurante_id` está NULL (caso legado: solo tenían
 * `restaurantes.usuario_id` apuntando al dueño), hacemos el mismo fallback
 * que `requireRestaurantOwner`: buscar el restaurante por
 * `restaurantes.usuario_id`. Esto lo hacemos en una sola query y cacheamos
 * el id en `req.user.restaurante_id` para no repetir.
 *
 * Uso:
 *   router.get('/admin/conversaciones/:id/draft', verifyToken, requireVendedor, requireSameRestaurante('params'), handler)
 *
 * Modos:
 *   - 'params'        : lee req.params.restaurante_id (o req.params.id)
 *   - 'body'          : lee req.body.restaurante_id
 *   - 'resolveByConv' : busca la conversación por req.params.id y compara su restaurante_id
 */
export function requireSameRestaurante(mode = 'params') {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'No autenticado' });

      // Admin del sistema pasa siempre.
      if (req.user.tipo_usuario === 'admin') return next();

      // Fallback para dueños legados: si restaurante_id es null en el JWT
      // y el tipo es 'restaurante', buscar por restaurantes.usuario_id.
      if (!req.user.restaurante_id && req.user.tipo_usuario === 'restaurante') {
        const { query } = await import('../config/database.js');
        const rows = await query(
          'SELECT id FROM restaurantes WHERE usuario_id = ? LIMIT 1',
          [req.user.id]
        );
        if (rows && rows.length > 0) {
          req.user.restaurante_id = rows[0].id;
        }
      }

      // El resto DEBE tener restaurante_id.
      if (!req.user.restaurante_id) {
        return res.status(403).json({ error: 'No estás asociado a un local' });
      }

      let restauranteId;
      if (mode === 'resolveByConv') {
        restauranteId = req.body?.restaurante_id ?? req.params?.restaurante_id;
        if (!restauranteId) {
          return res.status(400).json({ error: 'restaurante_id requerido' });
        }
      } else if (mode === 'body') {
        restauranteId = req.body?.restaurante_id;
      } else {
        restauranteId = req.params?.restaurante_id ?? req.params?.id;
      }

      if (!restauranteId) {
        return res.status(400).json({ error: 'restaurante_id requerido' });
      }
      if (Number(restauranteId) !== Number(req.user.restaurante_id)) {
        return res.status(403).json({ error: 'No puedes operar sobre conversaciones de otro local' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
