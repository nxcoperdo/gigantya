/**
 * Genera el sitemap.xml de GigantYA consultando los restaurantes aprobados
 * en producción vía la API pública.
 *
 * Salida: client/public/sitemap.xml (Vite lo copia a client/dist/ en el build,
 *         y Nginx lo sirve estático en https://gigantya.com/sitemap.xml).
 *
 * Uso:
 *   - Local:    node scripts/generate-sitemap.js
 *   - Deploy:   este script se corre automáticamente en deploy.sh
 *               antes de `npm run build` del cliente.
 *
 * Variables de entorno:
 *   SITEMAP_BASE_URL   - Dominio canónico. Default: https://gigantya.com
 *   SITEMAP_API_URL    - Endpoint público de restaurantes.
 *                        Default: https://gigantya.com/api/restaurants
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://gigantya.com').replace(/\/+$/, '');
const API_URL = process.env.SITEMAP_API_URL || `${BASE_URL}/api/restaurants`;
const OUTPUT_PATH = join(ROOT, 'client', 'public', 'sitemap.xml');

/**
 * Fecha actual en formato ISO 8601 (UTC, sufijo Z) requerido por el protocolo
 * sitemap. Lo calculamos una sola vez para que todas las URLs tengan el mismo
 * <lastmod> (más liviano que una fecha distinta por URL).
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Construye el bloque <url>...</url> para un <loc> dado, con los campos
 * opcionales que el protocolo sitemap soporta.
 */
function urlEntry(loc, { lastmod = nowIso(), changefreq = 'weekly', priority = '0.8' } = {}) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Fetch con timeout: la API podría estar caída durante el deploy y queremos
 * fallar rápido y claro, no colgar el deploy 60s.
 */
async function fetchWithTimeout(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`API respondió HTTP ${res.status} para ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normaliza distintos formatos de respuesta de la API. El endpoint
 * /api/restaurants históricamente devolvió:
 *   { total, restaurantes: [...] }
 * pero algunas versiones devuelven un array directo. Aceptamos ambos.
 */
function extractRestaurantes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.restaurantes)) return payload.restaurantes;
  throw new Error('La API no devolvió un array de restaurantes reconocible');
}

/**
 * Genera el XML completo y lo escribe en OUTPUT_PATH. Lanza si la API falla:
 * preferimos un deploy que se rompa con un error claro antes que un sitemap
 * silenciosamente desactualizado.
 */
async function generate() {
  console.log(`[sitemap] Consultando ${API_URL}...`);
  const payload = await fetchWithTimeout(API_URL);
  const restaurantes = extractRestaurantes(payload);
  console.log(`[sitemap] ${restaurantes.length} restaurante(s) recibido(s) de la API`);

  // 1. Home estática (siempre primera, prioridad máxima)
  const entries = [
    urlEntry(`${BASE_URL}/`, { changefreq: 'daily', priority: '1.0' }),
  ];

  // 2. Una URL por cada restaurante aprobado. Validamos que el id sea un entero
  // positivo para no inyectar basura si la API devuelve algo raro.
  for (const r of restaurantes) {
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0) {
      console.warn(`[sitemap] Saltando restaurante con id inválido: ${r.id}`);
      continue;
    }
    entries.push(urlEntry(`${BASE_URL}/restaurant/${id}`));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, xml, 'utf8');
  console.log(`[sitemap] Escrito ${OUTPUT_PATH} (${entries.length} URLs)`);
}

// CLI: exit code 1 si algo falla (deploy debe abortar)
generate().catch((err) => {
  console.error('[sitemap] ERROR generando sitemap:', err.message);
  process.exit(1);
});
