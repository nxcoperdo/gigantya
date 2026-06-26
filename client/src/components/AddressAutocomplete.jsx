import { useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { loadGoogleMaps, hasGoogleMapsApiKey } from '../utils/googleMapsLoader';

/**
 * Input con Google Places Autocomplete moderno.
 *
 * Implementación: usa `google.maps.places.PlaceAutocompleteElement`,
 * el web component oficial recomendado por Google desde marzo 2025
 * (reemplazo del deprecado `google.maps.places.Autocomplete`).
 *
 * Refs:
 *   - https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
 *
 * Props:
 *   - value (string): texto a mostrar en el input (controlado).
 *   - onChange (fn): callback con `{ target: { value, name } }` cuando el usuario escribe.
 *   - onPlaceSelected (fn): callback cuando se selecciona una sugerencia.
 *       Recibe `{ direccion, direccion_formateada, latitud, longitud, place_id, ciudad, pais }`
 *   - placeholder, disabled, className, inputClassName, id, name, required.
 *
 * Si NO hay API key configurada, renderiza un input de texto plano (fallback).
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Escribe tu dirección...',
  disabled = false,
  className = '',
  inputClassName = 'input',
  id,
  name,
  required = false,
  defaultCity = 'Gigante, Huila',
}) {
  const fallbackInputRef = useRef(null);
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const lastEmittedValueRef = useRef('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  // Sincronizar el `value` controlado → web component (solo cuando cambia desde fuera).
  useEffect(() => {
    if (!sdkReady || !elementRef.current) return;
    // Sólo escribimos si el valor externo es distinto del último que emitimos,
    // para no romper la edición del usuario.
    if (value !== lastEmittedValueRef.current && value !== undefined && value !== null) {
      try {
        elementRef.current.value = value;
      } catch (_) {
        // Algunos navegadores no exponen setter público; ignorar.
      }
    }
  }, [value, sdkReady]);

  // Cargar SDK de Google y crear PlaceAutocompleteElement
  useEffect(() => {
    let cancelled = false;
    const apiKeyPresent = hasGoogleMapsApiKey();
    setHasKey(apiKeyPresent);

    if (!apiKeyPresent) return undefined;

    setLoading(true);

    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled) return;
        if (!google || !containerRef.current) return;

        // Importar la librería PlaceAutocompleteElement dinámicamente.
        const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
        if (!PlaceAutocompleteElement) {
          throw new Error('PlaceAutocompleteElement no está disponible en esta versión del SDK.');
        }

        // Crear el web component
        const element = new PlaceAutocompleteElement({
          // Restringir a Colombia
          includedRegionCodes: ['CO'],
          // Filtrar a direcciones (no a establecimientos)
          types: ['address'],
        });

        // Placeholder y atributos ARIA
        try {
          element.setAttribute('placeholder', placeholder);
        } catch (_) { /* ignore */ }

        if (id) element.id = id;

        // El web component `PlaceAutocompleteElement` emite `gmp-select`
        // cuando el usuario elige una opción del dropdown.
        element.addEventListener('gmp-select', async (event) => {
          try {
            const placePrediction = event.placePrediction;
            if (!placePrediction) return;

            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ['addressComponents', 'formattedAddress', 'location', 'id', 'displayName'],
            });

            const lat = place.location?.lat();
            const lng = place.location?.lng();

            // Extraer ciudad/departamento/país de los componentes
            let city = defaultCity;
            let country = '';
            if (Array.isArray(place.addressComponents)) {
              for (const c of place.addressComponents) {
                const types = c.types || [];
                const longName = c.longText || c.long_name || '';
                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  if (!city || city === defaultCity) city = longName;
                }
                if (types.includes('administrative_area_level_1')) {
                  if (city && city !== longName) {
                    city = `${city}, ${longName}`;
                  } else if (!city) {
                    city = longName;
                  }
                }
                if (types.includes('country')) {
                  country = longName;
                }
              }
            }

            const formatted = place.formattedAddress || (element.value || '');
            const payload = {
              direccion: place.displayName || formatted,
              direccion_formateada: formatted,
              latitud: lat ?? null,
              longitud: lng ?? null,
              place_id: place.id || null,
              ciudad: city || defaultCity,
              pais: country || 'Colombia',
            };

            // Mantener el último valor emitido para que el efecto de sincronización
            // no pise lo que el usuario acaba de seleccionar.
            lastEmittedValueRef.current = formatted;
            element.value = formatted;

            if (onPlaceSelected) onPlaceSelected(payload);
            if (onChange) onChange({ target: { value: formatted, name } });
          } catch (err) {
            console.error('[AddressAutocomplete] Error al procesar el lugar seleccionado:', err);
            setError('No se pudo obtener la información del lugar seleccionado.');
          }
        });

        // Re-emitir cambios de texto al padre (mientras escribe)
        element.addEventListener('input', (e) => {
          const newValue = element.value || '';
          lastEmittedValueRef.current = newValue;
          if (onChange) onChange({ target: { value: newValue, name } });
        });

        // Insertar el componente en el contenedor
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(element);
        elementRef.current = element;

        // Si ya teníamos un valor inicial (modo edición), reflejarlo en el web component.
        if (value) {
          try { element.value = value; } catch (_) { /* ignore */ }
        }

        setSdkReady(true);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AddressAutocomplete] No se pudo cargar Google Maps:', err);
        setError('No se pudo cargar Google Maps. Verifica la conexión o la API key.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
      elementRef.current = null;
      setSdkReady(false);
    };
    // Importante: NO ponemos `value` aquí para no reinicializar el SDK en cada tecleo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCity, name]);

  // Render de fallback (sin API key)
  if (!hasKey) {
    return (
      <div className={className}>
        <input
          ref={fallbackInputRef}
          id={id}
          name={name}
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder + ' (sin autocompletar)'}
          disabled={disabled}
          required={required}
          className={inputClassName}
        />
        <p className="mt-1 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <AlertCircle size={12} />
          Google Maps no configurado — escribe tu dirección manualmente.
        </p>
      </div>
    );
  }

  // Render con Places Autocomplete (PlaceAutocompleteElement)
  return (
    <div className={className}>
      <div className="relative">
        <MapPin
          className="absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none z-10"
          size={18}
        />
        {/* El web component se inyecta dentro de este div */}
        <div
          ref={containerRef}
          className={`autocomplete-wrapper ${inputClassName}`}
          style={{
            // El web component hereda estilos del contenedor; ajustamos padding
            // para alinear el icono y el spinner.
            paddingLeft: '2.5rem',
            paddingRight: loading ? '2.5rem' : '0.75rem',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin z-10 pointer-events-none"
            size={18}
          />
        )}
      </div>
      {error ? (
        <p
          className="mt-1 text-xs flex items-center gap-1"
          style={{ color: 'var(--danger-text)' }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <MapPin size={12} />
          Empieza a escribir y selecciona una opción para fijar el pin exacto.
        </p>
      )}
      {/* Estilos mínimos para que el input interno del web component se vea bien */}
      <style>{`
        .autocomplete-wrapper gmp-place-autocomplete {
          width: 100%;
        }
        .autocomplete-wrapper gmp-place-autocomplete input {
          width: 100% !important;
          border: none !important;
          outline: none !important;
          background: transparent !important;
          font-size: 1rem !important;
          padding: 0.625rem 0 !important;
          color: var(--text-primary, #111827) !important;
        }
        .autocomplete-wrapper gmp-place-autocomplete input::placeholder {
          color: var(--text-muted, #9ca3af) !important;
        }
      `}</style>
    </div>
  );
}
