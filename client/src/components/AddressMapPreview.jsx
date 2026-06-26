import { ExternalLink, MapPin } from 'lucide-react';

/**
 * Mini-mapa embebido (iframe) para mostrar el pin exacto de una dirección.
 *
 * Props:
 *   - latitud, longitud: números (obligatorios)
 *   - direccion: texto a mostrar como etiqueta
 *   - zoom (opcional, default 16)
 *   - height (opcional, default 220px)
 *
 * Si faltan lat/lng, no renderiza nada.
 */
export default function AddressMapPreview({
  latitud,
  longitud,
  direccion,
  zoom = 16,
  height = 220,
}) {
  if (latitud === null || latitud === undefined || longitud === null || longitud === undefined) {
    return null;
  }
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  // URL oficial de embed: no requiere API key, usa el dominio público de Google Maps.
  const src = `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=${zoom}&output=embed`;
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="space-y-2">
      {direccion && (
        <p className="text-sm text-[color:var(--text-secondary)] flex items-start gap-2">
          <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <span className="break-words">{direccion}</span>
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
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ExternalLink size={14} />
        Ver en Google Maps (abre en nueva pestaña)
      </a>
    </div>
  );
}