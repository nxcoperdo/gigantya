/**
 * Controller público: GET del hero completo de la home (Fase 12d).
 *
 * Endpoint:
 *   - GET /api/home/hero → devuelve { settings, buttons } o defaults
 *     si algo falla.
 *
 * Sin auth: la home es pública. No hay info sensible (solo textos
 * editables y links a URLs que el admin ya hizo públicos).
 *
 * Decisión: si la llamada al modelo falla, devolvemos un fallback con
 * defaults hardcodeados (los mismos de la migración) en vez de un 500.
 * Razón: si la DB está caída temporalmente, la home debe seguir
 * mostrando algo, no una pantalla rota.
 */
import * as HomeHero from '../models/HomeHero.js';

/** Defaults de fallback (mismos que la migración). Si todo falla,
 *  la home muestra los textos originales de pre-Fase-12d. */
const FALLBACK = Object.freeze({
  settings: {
    id: 1,
    mostrar_titulo: true,
    titulo_pre: 'Pide lo que',
    titulo_post: 'Amas',
    mostrar_subtitulo: true,
    subtitulo_pre: 'Descubre los mejores locales de',
    subtitulo_bold: 'Gigante',
    subtitulo_post: 'en tu dispositivo',
    mostrar_buscador: true,
    buscador_placeholder: 'Buscar local, producto o categoría...',
    mostrar_badge_locales: true,
    badge_locales_pre: 'Más de',
    badge_locales_sufijo: 'locales disponibles',
  },
  buttons: [],
});

/** GET /api/home/hero */
export async function getHero(_req, res) {
  try {
    const { settings, buttons } = await HomeHero.getHeroCompleto();
    res.json({
      settings: settings || FALLBACK.settings,
      buttons: Array.isArray(buttons) ? buttons : [],
    });
  } catch (error) {
    // Si la DB está caída, devolvemos defaults para que la home
    // siga renderizando (no rompemos la experiencia del usuario).
    console.error('[publicHomeHero] getHero error, usando fallback:', error.message);
    res.json(FALLBACK);
  }
}

export default { getHero };
