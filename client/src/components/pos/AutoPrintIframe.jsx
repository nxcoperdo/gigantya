/**
 * AutoPrintIframe (Fase 4).
 *
 * Wrapper invisible que monta un `<iframe>` apuntando a una URL de PDF
 * (`/api/print/...`) y dispara `window.print()` cuando el PDF carga.
 *
 * Por qué iframe y no `window.open` + `window.print`:
 *   - `window.open` muestra la barra de URL, dependés de que el usuario
 *     cierre la ventana, y en algunos browsers el `print` se bloquea
 *     como popup.
 *   - Con un iframe off-screen, el PDF se carga con el `Authorization`
 *     header (axios -> blob -> object URL), el iframe lo embebe y el
 *     `print()` del iframe es silencioso.
 *
 * Limitaciones:
 *   - El padre NO espera al diálogo. Consideramos "impresión disparada"
 *     al `onLoad` del iframe (= el PDF ya está en memoria del browser).
 *   - Si el usuario cancela el diálogo, el iframe queda montado. No
 *     lo removemos (la próxima vez el KDS querrá reimprimir el mismo
 *     PDF y ya está cacheado por el browser).
 */
import { useEffect, useRef } from 'react';

export default function AutoPrintIframe({ url, onPrinted, onError }) {
  const iframeRef = useRef(null);
  const lastUrlRef = useRef(null);

  useEffect(() => {
    if (!url || url === lastUrlRef.current) return;
    lastUrlRef.current = url;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        // El contentWindow puede no estar listo aún en algunos browsers.
        // Timeout 0 fuerza a salir del stack actual.
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            onPrinted && onPrinted();
          } catch (e) {
            // Algunos browsers bloquean print() si el iframe no tuvo
            // user-gesture. Si pasa, igual dejamos el PDF visible: el
            // usuario puede hacer click derecho > Imprimir.
            console.warn('[AutoPrintIframe] no se pudo disparar print():', e);
            onError && onError(e);
          }
        }, 0);
      } catch (_) { /* noop */ }
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [url, onPrinted, onError]);

  if (!url) return null;
  return (
    <iframe
      ref={iframeRef}
      src={url}
      title="print-frame"
      style={{ position: 'absolute', width: 0, height: 0, border: 0, opacity: 0 }}
      aria-hidden="true"
    />
  );
}
