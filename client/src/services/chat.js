/**
 * Wrapper HTTP para el chat.
 *
 * Usa la instancia global `api` (axios con interceptor de token) cuando
 * hay sesión. Para clientes anónimos (sin JWT) usa `apiAnon` (misma
 * baseURL sin interceptor) y manda `anon_identifier` para que el
 * backend identifique al dueño de la conversación.
 */
import axios from 'axios';
import api from './api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Instancia SIN token — para endpoints anónimos.
const apiAnon = axios.create({ baseURL: API_URL });

const isLoggedIn = () => !!localStorage.getItem('token');

/**
 * Devuelve { identifier, instance } para una conversación. Si hay
 * sesión, usa la instancia con token y no manda identifier. Si no,
 * usa apiAnon + el anon_identifier del localStorage que ChatContext
 * mantiene con la clave `chat_identity_<restaurante_id>`.
 */
async function getContext(chatIdentidad) {
  if (isLoggedIn()) {
    return { instance: api, identifier: null };
  }
  if (!chatIdentidad?.telefono) {
    throw new Error('No hay identidad de chat guardada (nombre + teléfono)');
  }
  const tel = String(chatIdentidad.telefono).replace(/[\s\-()]/g, '');
  return { instance: apiAnon, identifier: `anon:${tel}` };
}

export const chatService = {
  /**
   * Crea o devuelve la conversación abierta del cliente con el local.
   * Si el usuario está logueado, el server usa el id del JWT. Si no,
   * requiere cliente_nombre + cliente_telefono en el body.
   */
  ensureConversation: async ({ restaurante_id, cliente_nombre, cliente_telefono }) => {
    const useAnon = !isLoggedIn();
    const instance = useAnon ? apiAnon : api;
    const res = await instance.post('/chat/conversaciones', {
      restaurante_id,
      cliente_nombre,
      cliente_telefono,
    });
    return res.data;
  },

  listMensajes: async (conversacion_id, chatIdentidad) => {
    const { instance, identifier } = getContext(chatIdentidad);
    const config = identifier ? { params: { anon_identifier: identifier } } : {};
    const res = await instance.get(`/chat/conversaciones/${conversacion_id}/mensajes`, config);
    return res.data;
  },

  /**
   * Envía un mensaje. Acepta `contenido` (texto) y/o `adjuntos`
   * ({producto_id, nombre, precio}) cuando viene del click en el catálogo.
   * Backend exige al menos `contenido` no vacío.
   */
  sendMensaje: async (conversacion_id, { contenido, adjuntos = null }, chatIdentidad) => {
    const { instance, identifier } = getContext(chatIdentidad);
    const body = { contenido, adjuntos };
    if (identifier) body.anon_identifier = identifier;
    const res = await instance.post(`/chat/conversaciones/${conversacion_id}/mensajes`, body);
    return res.data.mensaje;
  },

  markRead: async (conversacion_id, chatIdentidad) => {
    const { instance, identifier } = getContext(chatIdentidad);
    const config = identifier ? { params: { anon_identifier: identifier } } : {};
    const res = await instance.post(`/chat/conversaciones/${conversacion_id}/leido`, {}, config);
    return res.data;
  },

  // ========== Admin (vendedor) ==========

  adminListConversaciones: async ({ estado = 'abierta' } = {}) => {
    const res = await api.get('/chat/admin/conversaciones', { params: { estado } });
    return res.data;
  },

  adminBuildDraft: async (conversacion_id) => {
    const res = await api.get(`/chat/admin/conversaciones/${conversacion_id}/draft`);
    return res.data;
  },

  adminConvertToOrder: async (conversacion_id, pedidoDraft) => {
    const res = await api.post(`/chat/admin/conversaciones/${conversacion_id}/draft-pedido`, pedidoDraft);
    return res.data;
  },
};

export default chatService;
