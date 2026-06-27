import { ExternalLink, MapPin } from 'lucide-react';

/**
 * Mini-mapa embebido (iframe) para mostrar el pin de una dirección.
 *
 * Soporta dos modos según los datos disponibles:
 *
 *   1. **Con coordenadas** (latitud + longitud): armamos el embed con
 *      `q=lat,lng` y un zoom alto (16 por default). Es lo más preciso:
 *      Google centra el mapa exactamente en el punto.
 *
 *   2. **Sin coordenadas pero con texto** (direccion): caemos a `q=texto`,
 *      y siempre le concatenamos "Gigante, Huila, Colombia" si no está
 *      presente. Esto le da a Google un anclaje geográfico para que el
 *      mapa centre en Gigante (Huila, Colombia) y no en cualquier otro
 *      "Gigante" del mundo (Perú, Italia, etc.).
 *
 *      Esto pasa cuando el cliente usó el fallback manual del autocomplete
 *      (sin coordenadas) o cuando la dirección vino por un canal sin
 *      geocodificación (ej. migración de datos, import masivo, etc.).
 *
 * El iframe de embed (`maps.google.com/maps?q=...&output=embed`) NO requiere
 * API key, NO requiere whitelist, NO consume billing. Es el endpoint público
 * de embed.
 *
 * Props:
 *   - latitud, longitud (number|null): coordenadas del pin. Opcionales.
 *   - direccion (string): texto legible ("Calle 5 #12-45"). Opcional pero
 *     usado como fallback si no hay coords y como etiqueta.
 *   - zoom (opcional, default 16): nivel de zoom cuando hay coords. Si vamos
 *     por texto, Google decide el zoom (no podemos forzarlo en el embed).
 *   - height (opcional, default 220px): alto del iframe.
 *
 * Si no hay coords NI texto, no renderiza nada.
 */
export default function AddressMapPreview({
  latitud,
  longitud,
  direccion,
  zoom = 16,
  height = 220,
}) {
  const hasCoords =
    latitud !== null &&
    latitud !== undefined &&
    longitud !== null &&
    longitud !== undefined &&
    Number.isFinite(Number(latitud)) &&
    Number.isFinite(Number(longitud));

  const direccionLimpia = (direccion || '').trim();

  // Si no hay nada para mostrar, salimos temprano.
  if (!hasCoords && !direccionLimpia) return null;

  let src;
  let externalUrl;
  let zoomLabel;

  if (hasCoords) {
    // Modo preciso: pin exacto en el mapa.
    const lat = Number(latitud);
    const lng = Number(longitud);
    src = `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=${zoom}&output=embed`;
    externalUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    zoomLabel = `Zoom ${zoom}`;
  } else {
    // Modo fallback: sin coords del cliente, geocodificamos por texto. Le
    // agregamos "Gigante, Huila, Colombia" siempre que no esté presente para
    // anclar el resultado a la zona correcta.
    const yaTieneGigante = /gigante/i.test(direccionLimpia);
    const queryTexto = yaTieneGigante
      ? direccionLimpia
      : `${direccionLimpia}, Gigante, Huila, Colombia`;

    const qEncoded = encodeURIComponent(queryTexto);
    src = `https://maps.google.com/maps?q=${qEncoded}&hl=es&output=embed`;
    externalUrl = `https://www.google.com/maps/search/?api=1&query=${qEncoded}`;
    zoomLabel = 'Búsqueda por texto';
  }

  return (
    <div className="space-y-2">
      {direccionLimpia && (
        <p className="text-sm text-[color:var(--text-secondary)] flex items-start gap-2">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <span className="break-words">{direccionLimpia}</span>
        </p>
      )}
      <div className="rounded-xl overflow-hidden border border-[color:var(--border-default)] bg-[color:var(--bg-muted)]">
        <iframe
          title="Mapa de la dirección"
          src={src}
          width="100%"
          height={height}
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ExternalLink size={14} />
          Ver en Google Maps (abre en nueva pestaña)
        </a>
        <span
          className="text-xs text-[color:var(--text-muted)]"
          title={hasCoords ? 'Pin exacto por coordenadas' : 'Centrado por texto de la dirección'}
        >
          {zoomLabel}
        </span>
      </div>
    </div>
  );
}