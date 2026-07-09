/**
 * Service de Configuración POS (Fase 8).
 *
 * Capa delgada sobre el modelo `RestauranteConfig`. No toca
 * conexiones — eso lo hace el modelo. Acá solo validamos el patch
 * y disparamos auditoría + socket.
 *
 * Auth:
 *   - GET: cualquier staff del restaurante (cajero necesita ver
 *     la config para saber qué métodos de pago ofrecer).
 *   - PUT: solo el dueño del restaurante (verificado en el controller
 *     con `requireRestaurantOwner`).
 */
import * as RestauranteConfig from '../models/pos/RestauranteConfig.js';
import * as AuditLog from '../models/AuditLog.js';
import { emitToRestaurant } from '../socket/socketHandler.js';

export async function getConfig(restauranteId) {
  const cfg = await RestauranteConfig.getConfig(Number(restauranteId));
  if (!cfg) {
    const e = new Error('restaurante no encontrado');
    e.statusCode = 404;
    throw e;
  }
  return cfg;
}

export async function updateConfig(restauranteId, patch, usuarioId) {
  // 1) Validar el patch entero.
  const errs = RestauranteConfig.validateConfig(patch);
  if (errs.length) {
    const e = new Error(`Config inválida: ${errs.join('; ')}`);
    e.statusCode = 400;
    throw e;
  }

  // 2) Traer la config actual (para auditoría: "datos antes" vs "datos después").
  const antes = await RestauranteConfig.getConfig(Number(restauranteId));
  if (!antes) {
    const e = new Error('restaurante no encontrado');
    e.statusCode = 404;
    throw e;
  }

  // 3) Aplicar el update (internamente hace el merge y guarda).
  const despues = await RestauranteConfig.updateConfig(Number(restauranteId), patch);

  // 4) Auditoría + socket (best-effort).
  AuditLog.createLog({
    admin_id: Number(usuarioId),
    accion: 'restaurante.config_updated',
    entidad_tipo: 'restaurantes',
    entidad_id: Number(restauranteId),
    datos_antes: { configuracion_pos: antes },
    datos_despues: { configuracion_pos: despues, patch },
  }).catch(() => { /* best effort */ });

  emitToRestaurant(Number(restauranteId), 'pos:config_updated', {
    restaurante_id: Number(restauranteId),
    configuracion_pos: despues,
    timestamp: new Date().toISOString(),
  });

  return despues;
}

export default {
  getConfig,
  updateConfig,
};
