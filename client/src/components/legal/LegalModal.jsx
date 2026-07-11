import { useEffect, useRef, useState } from 'react';
import { X, ScrollText, ShieldCheck, Store, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { legalService } from '../../services/api.js';

/**
 * `LegalModal` — modal bloqueante para aceptación de documentos legales.
 *
 * Características:
 *   - Pantalla completa con backdrop opaco (no se puede cerrar por fuera).
 *   - Scroll-to-bottom obligatorio: el botón "Acepto" permanece deshabilitado
 *     hasta que el usuario llega al final del documento.
 *   - Soporta uno o varios documentos en la misma sesión. Cuando hay más
 *     de uno, los presenta en orden y registra cada aceptación por separado.
 *   - Cerrar con Escape está deshabilitado mientras no haya aceptado.
 *   - Una vez aceptado, muestra un comprobante con la fecha/hora del
 *     registro.
 *
 * Props:
 *   - open: boolean                          → si está abierto
 *   - onClose: fn()                          → callback al cerrar (solo se
 *                                              invoca si ya aceptó todo)
 *   - docs: Array<{                          → documentos a aceptar en orden
 *       tipo: 'tyc' | 'privacidad' | 'merchant',
 *       version: string,
 *       restaurante_id?: number,             → solo merchant
 *     }>
 *   - onAccepted: fn(result)                 → callback opcional post-acept.
 *
 * Decisiones de UX:
 *   - Usamos un solo modal con scroll interno. Es texto legal largo pero
 *     cabe. El "scroll" se detecta sobre el `div` scrollable, no sobre
 *     la ventana.
 *   - El header del modal muestra el ícono + título del doc actual, y un
 *     stepper "1 de 2" si hay varios.
 *   - Si el modal se abre y la versión del doc que el usuario "no aceptó"
 *     cambió mientras leía, registramos la versión actual al aceptar.
 */
export default function LegalModal({ open, onClose, docs = [], onAccepted }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [allDone, setAllDone] = useState(false);
  const [acceptLog, setAcceptLog] = useState([]);
  const scrollRef = useRef(null);

  const current = docs[currentIndex] || null;

  // Reset state al cambiar de doc
  useEffect(() => {
    setScrolledToEnd(false);
    setError(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentIndex]);

  // Detectar scroll al final del contenedor
  useEffect(() => {
    if (!open || !current) return;
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable <= 0) {
        // Contenido entra en pantalla: se considera leído
        setScrolledToEnd(true);
        return;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
        setScrolledToEnd(true);
      }
    };
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [open, current, currentIndex]);

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape solo cierra si ya aceptó todo
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && allDone) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, allDone, onClose]);

  if (!open || !current) return null;

  const isLast = currentIndex === docs.length - 1;

  const handleAccept = async () => {
    if (!scrolledToEnd || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { tipo: current.tipo, version: current.version };
      if (current.restaurante_id) payload.restaurante_id = current.restaurante_id;
      const result = await legalService.aceptar(payload);
      setAcceptLog((prev) => [...prev, result]);
      onAccepted?.(result);

      if (isLast) {
        setAllDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch (err) {
      console.error('[Legal] Error aceptando:', err);
      setError(err.response?.data?.error || 'Error al registrar la aceptación. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (allDone) onClose?.();
  };

  const docMeta = {
    tyc:        { title: 'Términos y Condiciones',         icon: ScrollText, accent: 'indigo' },
    privacidad: { title: 'Política de Privacidad',         icon: ShieldCheck, accent: 'emerald' },
    merchant:   { title: 'Acuerdo Comercial',              icon: Store,       accent: 'amber' },
  }[current.tipo] || { title: 'Documento legal', icon: ScrollText, accent: 'indigo' };

  const Icon = docMeta.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="bg-white shadow-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-${docMeta.accent}-100`}>
              <Icon className={`w-5 h-5 text-${docMeta.accent}-700`} />
            </div>
            <div className="min-w-0">
              <h2 id="legal-modal-title" className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {allDone ? 'Aceptaciones registradas' : docMeta.title}
              </h2>
              <p className="text-xs text-gray-500">
                {allDone
                  ? '✓ Ya puedes usar la plataforma con normalidad'
                  : docs.length > 1
                    ? `Documento ${currentIndex + 1} de ${docs.length} • Versión ${current.version}`
                    : `Versión ${current.version}`}
              </p>
            </div>
          </div>
          {allDone && (
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        {allDone ? (
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Listo! Tus aceptaciones quedaron registradas.
            </h3>
            <p className="text-sm text-gray-600 mb-5 max-w-md">
              Guardamos constancia con la fecha, hora, dirección IP y la versión del documento
              aceptado. Esto nos sirve como evidencia de tu consentimiento.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 mb-6">
              {acceptLog.map((entry) => (
                <li key={entry.id} className="font-mono">
                  {entry.tipo} · {entry.creado_en}
                </li>
              ))}
            </ul>
            <button
              onClick={handleClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Continuar
            </button>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6 legal-prose max-w-none text-gray-800 text-sm leading-relaxed"
            >
              {current.tipo === 'tyc' && <TycText />}
              {current.tipo === 'privacidad' && <PrivacidadText />}
              {current.tipo === 'merchant' && <MerchantText />}
            </div>

            {/* Footer con aviso + botón */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                {scrolledToEnd
                  ? '✓ Leíste el documento completo. Ahora puedes aceptarlo.'
                  : 'Desplázate hasta el final del documento para habilitar el botón de aceptación.'}
              </p>
              {error && (
                <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Link
                  to={current.tipo === 'tyc' ? '/terminos' : current.tipo === 'privacidad' ? '/privacidad' : '/legal/restaurante'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Abrir en página completa
                </Link>
                <button
                  onClick={handleAccept}
                  disabled={!scrolledToEnd || submitting}
                  aria-disabled={!scrolledToEnd || submitting}
                  className={[
                    'w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors',
                    scrolledToEnd && !submitting
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed',
                  ].join(' ')}
                >
                  {submitting
                    ? 'Registrando…'
                    : isLast
                      ? 'Acepto'
                      : 'Aceptar y continuar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Textos legales embebidos.
   Son una copia "lite" del texto completo de las páginas
   /terminos, /privacidad y /legal/restaurante. La fuente de
   verdad sigue siendo el JSX de esas páginas; acá va una
   versión reducida que cabe bien en un modal con scroll.
   El abogado puede pedir ajustes a cualquiera de las dos.
   ============================================================ */

function TycText() {
  return (
    <>
      <h2>1. Información del responsable</h2>
      <ul>
        <li><strong>Razón social:</strong> Nicolas Perdomo Rodriguez</li>
        <li><strong>NIT:</strong> CC 1141116665</li>
        <li><strong>Domicilio:</strong> Calle 4 #7-79, Gigante, Huila</li>
        <li><strong>Teléfono:</strong> +57 311 532 0211</li>
        <li><strong>Email:</strong> coderepairtech@gmail.com</li>
      </ul>
      <h2>2. Aceptación</h2>
      <p>Al hacer clic en "Acepto" o usar la plataforma, declaras que leíste y aceptas estos Términos en su totalidad.</p>
      <h2>3. Naturaleza del servicio</h2>
      <p>GigantYA es una <strong>plataforma tecnológica de intermediación</strong> entre usuarios y restaurantes. <strong>NO procesa pagos</strong> entre el usuario y el restaurante, y <strong>NO opera el delivery</strong> (es 100% responsabilidad del local). Cobra a los restaurantes una suscripción mensual fija (sin comisión).</p>
      <h2>4. Relación contractual</h2>
      <p>La relación de compraventa se celebra entre el usuario y el restaurante. GigantYA responde por la información clara, los canales de PQR y la mediación. Reclamos de calidad, ingredientes, alérgenos, contenido o entrega deben dirigirse al restaurante en primer lugar.</p>
      <h2>5. Edad mínima</h2>
      <p>Mayor de 18 años (artículo 53 Ley 1480 de 2011).</p>
      <h2>6. Registro y cuenta</h2>
      <p>Información verdadera, contraseña confidencial, no compartir cuenta.</p>
      <h2>7. Pedidos, precios y pagos</h2>
      <p>Precios fijados por cada restaurante. Si hay diferencia, prevalece el menor. El pago se realiza directamente entre el usuario y el restaurante. <strong>GigantYA no interviene en la transacción.</strong></p>
      <h2>8. Derecho de retracto</h2>
      <p>Por excepción legal expresa (artículo 47 numeral 3 Ley 1480/2011), el retracto <strong>NO aplica a alimentos perecederos</strong>, que cubren la totalidad del catálogo. Procede sí la garantía de idoneidad y la reversión de pago.</p>
      <h2>9. Reversión de pago</h2>
      <p>Dentro de los 5 días hábiles. Procedimiento: el usuario notifica a GigantYA, se traslada al restaurante, que tiene 5 días hábiles para pronunciarse. La ejecución efectiva de la reversión corresponde al restaurante y al medio de pago utilizado, no a GigantYA.</p>
      <h2>10. Garantía sobre el producto</h2>
      <p>Calidad e idoneidad (artículo 7 Ley 1480). Cambio, devolución o solución acordada. Exigible al restaurante. GigantYA intermediará.</p>
      <h2>11. Plazos de entrega</h2>
      <p>Plazo pactado al comprar, o 30 días calendario. Plazo máximo del restaurante.</p>
      <h2>12. Cancelaciones</h2>
      <p>Antes de "Confirmado" sin cargo. Después, depende del estado de preparación. Errores del restaurante asumidos por el restaurante.</p>
      <h2>13. Comportamiento del usuario</h2>
      <p>Información falsa, suplantación, acoso, contenido ilegal o abuso del sistema están prohibidos.</p>
      <h2>14. Reseñas</h2>
      <p>Honestas y respetuosas. Moderadas. Licencia no exclusiva para mostrarlas en la plataforma.</p>
      <h2>15. Propiedad intelectual</h2>
      <p>Marcas, software y diseño son de GigantYA. Los locales otorgan licencia de su marca para mostrarla en la plataforma.</p>
      <h2>16. Limitación de responsabilidad</h2>
      <p>La entrega es 100% del restaurante. La calidad es del restaurante. Los pagos son del restaurante. Sin garantía de disponibilidad ininterrumpida. Sin responsabilidad por daños indirectos, lucro cesante o pérdida de datos.</p>
      <h2>17. Autoridad de protección al consumidor</h2>
      <p>SIC: <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer">sic.gov.co</a> · Línea 601 592 0400.</p>
      <h2>18. Indemnidad</h2>
      <p>Aceptas indemnizar a GigantYA por reclamos derivados de tu uso, incumplimiento o violación de derechos.</p>
      <h2>19. Modificaciones</h2>
      <p>15 días de anticipación por email o aviso.</p>
      <h2>20. Suspensión y terminación</h2>
      <p>Por violación de los TyC, fraude o requerimiento legal.</p>
      <h2>21. Ley aplicable</h2>
      <p>Leyes de Colombia. Tribunales de Bogotá D.C.</p>
      <h2>22. Notificaciones</h2>
      <p>De GigantYA al email registrado. De ti a coderepairtech@gmail.com.</p>
      <h2>23. Disposiciones finales</h2>
      <p>Cláusulas inválidas no afectan el resto. El no ejercicio de un derecho no implica renuncia.</p>
    </>
  );
}

function PrivacidadText() {
  return (
    <>
      <h2>1. Identificación del responsable</h2>
      <ul>
        <li><strong>Razón social:</strong> Nicolas Perdomo Rodriguez</li>
        <li><strong>NIT:</strong> CC 1141116665</li>
        <li><strong>Domicilio:</strong> Calle 4 #7-79, Gigante, Huila</li>
        <li><strong>Teléfono:</strong> +57 311 532 0211</li>
        <li><strong>Email:</strong> coderepairtech@gmail.com</li>
      </ul>
      <h2>2. Marco legal</h2>
      <p>Ley 1581 de 2012, Decreto 1377 de 2013, Sentencia C-748 de 2011.</p>
      <h2>3. Datos que recolectamos</h2>
      <p><strong>De clientes:</strong> nombre, documento, email, teléfono, dirección, barrio/sector/coordenadas (para delivery), historial de pedidos y búsquedas, IP, navegador.</p>
      <p><strong>No recolectamos datos de pago</strong> (los pagos se procesan directamente entre el usuario y el restaurante).</p>
      <p><strong>De restaurantes:</strong> NIT, razón social, representante legal, documento, contacto, dirección, permisos sanitarios, Registro Mercantil, catálogo y fotos, datos bancarios (para la suscripción).</p>
      <h2>4. Finalidades</h2>
      <p><strong>Clientes:</strong> administrar cuenta, procesar pedidos, enviar notificaciones, soporte y PQR, mediación, reseñas, antifraude, cumplir obligaciones legales, comunicaciones comerciales solo si autorizó.</p>
      <p><strong>Restaurantes:</strong> validar identidad, publicar catálogo, cobrar suscripción mensual, soporte, cumplir Ley 1480 art. 54, antifraude.</p>
      <h2>5. Autorización</h2>
      <p>Consentimiento previo, expreso e informado (artículo 9 Ley 1581). Se solicita al registrarse, al pedir y al reseñar.</p>
      <h2>6. Transferencias internacionales</h2>
      <p>Cloudinary (EE.UU., imágenes), Meta WhatsApp (EE.UU., teléfono y nombre), pasarela de suscripción (Colombia), hosting (EE.UU.). Con cláusulas contractuales tipo o garantías equivalentes.</p>
      <h2>7. Derechos del titular</h2>
      <p>Conocer, actualizar, rectificar, solicitar prueba de la autorización, ser informado, presentar quejas ante la SIC, revocar, suprimir, acceder gratuitamente.</p>
      <h2>8. Procedimiento</h2>
      <p>Email a coderepairtech@gmail.com. Consulta: 10 días hábiles. Reclamo: 15 días hábiles. Si la respuesta no satisface, queja ante la SIC.</p>
      <h2>9. Seguridad</h2>
      <p>Cifrado bcrypt en contraseñas, HTTPS, acceso por roles, logs de auditoría, backups cifrados.</p>
      <h2>10. Retención</h2>
      <p>Mientras la cuenta esté activa + 5 años post-cierre (legal/contables). Pedidos no completados: 30 días.</p>
      <h2>11. Cookies</h2>
      <p>Ver <a href="/cookies" target="_blank" rel="noopener noreferrer">Política de Cookies</a>.</p>
      <h2>12. Menores</h2>
      <p>Plataforma no dirigida a menores de 18. Si un padre/madre/tutor detecta datos de un menor, escribir a coderepairtech@gmail.com para supresión inmediata.</p>
      <h2>13. Modificaciones</h2>
      <p>15 días de anticipación por email o aviso.</p>
    </>
  );
}

function MerchantText() {
  return (
    <>
      <h2>1. Partes</h2>
      <ul>
        <li><strong>GigantYA:</strong> Nicolas Perdomo Rodriguez, CC 1141116665</li>
        <li><strong>El Restaurante:</strong> la persona natural o jurídica registrada como oferente</li>
      </ul>
      <h2>2. Objeto</h2>
      <p>El Restaurante ofrece sus productos a través de GigantYA, y GigantYA facilita visibilidad, conexión con usuarios y atención de PQR.</p>
      <h2>3. Declaraciones del Restaurante</h2>
      <p>Registro Mercantil vigente, permisos sanitarios, normas de manipulación de alimentos, obligaciones tributarias al día, información veraz del catálogo, autorización de uso de imágenes, productos lícitos, no venta de alcohol a menores, precios con impuestos incluidos, operación propia del delivery.</p>
      <h2>4. Responsabilidades del Restaurante</h2>
      <p><strong>Productos:</strong> calidad, frescura, preparación, alérgenos, normas sanitarias, trazabilidad, facturación al consumidor final.</p>
      <p><strong>Entrega:</strong> exclusiva responsabilidad del local, ya sea con personal propio o domiciliario contratado.</p>
      <p><strong>Pagos:</strong> cobrar al cliente, procesar el pago, expedir factura, reportar impuestos.</p>
      <p><strong>Reembolsos:</strong> si el error es del restaurante, asume el costo.</p>
      <h2>5. Responsabilidades de GigantYA</h2>
      <p>Plataforma operativa, gestión de PQR, traslado de pedidos, cobro de la suscripción, mantener TyC y Política de Privacidad actualizados.</p>
      <h2>6. Modelo de suscripción</h2>
      <p><strong>NO se cobra comisión por transacción.</strong> Solo suscripción mensual fija:</p>
      <ul>
        <li>Free: $0</li>
        <li>Básico: $30.000 + $5.700 IVA = $35.700</li>
        <li>Profesional: $50.000 + $9.500 IVA = $59.500</li>
        <li>Premium: $80.000 + $15.200 IVA = $95.200</li>
      </ul>
      <p><strong>Si el pago falla:</strong> 1er intento (5 días hábiles), 2do intento (pausado), 3er intento (baja). La suscripción NO es reembolsable salvo decisión de GigantYA.</p>
      <h2>7. Cláusula de indemnidad</h2>
      <p>El Restaurante <strong>indemnizará a GigantYA</strong> por reclamos, demandas, sanciones, multas o daños derivados de sus productos, incumplimiento legal, violación de derechos de terceros, daños a consumidores o repartidores, o cualquier acción que genere responsabilidad para GigantYA. Subsiste tras la terminación.</p>
      <h2>8. Prohibiciones</h2>
      <p>Venta de alcohol a menores, productos fuera de horario, precios distintos a los publicados, pagos por fuera de los medios acordados, difamación, manipulación de reseñas, productos ilícitos.</p>
      <h2>9. Reseñas</h2>
      <p>No se puede ofrecer beneficios por reseñas positivas. Las reseñas son moderadas. El local puede responderlas desde el panel admin.</p>
      <h2>10. Confidencialidad</h2>
      <p>2 años posteriores a la terminación sobre info comercial, técnica, financiera o estratégica.</p>
      <h2>11. Terminación</h2>
      <p><strong>Por GigantYA:</strong> incumplimiento grave, sanciones sanitarias, quejas reiteradas, fraude, falta de pago &gt; 30 días.</p>
      <p><strong>Por el Restaurante:</strong> en cualquier momento sin justificación.</p>
      <p><strong>Efectos:</strong> cesación inmediata, pago de suscripciones pendientes, conservación de datos por 5 años.</p>
      <h2>12. Limitación de responsabilidad de GigantYA</h2>
      <p>GigantYA <strong>NO es responsable</strong> por acciones del Restaurante, calidad de productos, daños en preparación, conflictos laborales, fallas técnicas, la entrega del pedido, ni el procesamiento de pagos.</p>
      <h2>13. Propiedad intelectual</h2>
      <p>El Restaurante otorga a GigantYA licencia no exclusiva, mundial y gratuita para mostrar su marca. La plataforma es propiedad exclusiva de GigantYA.</p>
      <h2>14. Tratamiento de datos</h2>
      <p>Las partes tratan datos personales solo para los fines del acuerdo, conforme a la Ley 1581 de 2012.</p>
      <h2>15. Modificaciones</h2>
      <p>15 días de anticipación. Uso continuo implica aceptación.</p>
      <h2>16. Ley aplicable</h2>
      <p>Leyes de Colombia. Tribunales de Bogotá D.C.</p>
      <h2>17. Aceptación</h2>
      <p>Al hacer clic en "Acepto el Acuerdo Comercial", el Restaurante declara que leyó y acepta la totalidad de las cláusulas. Se guarda registro con fecha, hora, IP, versión y firmante.</p>
    </>
  );
}
