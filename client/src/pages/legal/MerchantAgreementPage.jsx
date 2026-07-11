import { useEffect, useState, useRef } from 'react';
import LegalLayout from '../../components/legal/LegalLayout.jsx';
import { legalService } from '../../services/api.js';

const TOC = [
  { id: 's1', label: '1. Partes' },
  { id: 's2', label: '2. Objeto' },
  { id: 's3', label: '3. Declaraciones del Restaurante' },
  { id: 's4', label: '4. Responsabilidades del Restaurante' },
  { id: 's5', label: '5. Responsabilidades de GigantYA' },
  { id: 's6', label: '6. Modelo de suscripción' },
  { id: 's7', label: '7. Cláusula de indemnidad' },
  { id: 's8', label: '8. Prohibiciones' },
  { id: 's9', label: '9. Reseñas y calificaciones' },
  { id: 's10', label: '10. Reserva de información' },
  { id: 's11', label: '11. Causales de terminación' },
  { id: 's12', label: '12. Limitación de responsabilidad' },
  { id: 's13', label: '13. Propiedad intelectual' },
  { id: 's14', label: '14. Tratamiento de datos' },
  { id: 's15', label: '15. Modificaciones' },
  { id: 's16', label: '16. Ley aplicable y jurisdicción' },
  { id: 's17', label: '17. Aceptación' },
];

export default function MerchantAgreementPage() {
  const [version, setVersion] = useState('v1.0-2026-07-10');
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const articleRef = useRef(null);

  useEffect(() => {
    legalService.getVersion()
      .then((d) => { if (d?.versions?.merchant) setVersion(d.versions.merchant); })
      .catch(() => {});
  }, []);

  // Detectar scroll al final del artículo para habilitar el checkbox.
  // Si el artículo es corto y entra todo en pantalla, se considera leído
  // desde el inicio (no hay nada que scrollear).
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const checkScroll = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      // Si no hay scroll (contenido entra en pantalla), se considera leído
      if (scrollable <= 0) {
        setScrolledToEnd(true);
        return;
      }
      // Si el usuario está a 100px del final, se considera leído
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        setScrolledToEnd(true);
      }
    };
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const data = await legalService.aceptar({
        tipo: 'merchant',
        version,
      });
      setConfirmation(data);
      setAccepted(true);
    } catch (err) {
      alert('Error al registrar la aceptación. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalLayout
      title="Acuerdo Comercial con Restaurantes"
      subtitle="El contrato que firmas al activar tu local en GigantYA. Por favor, léelo completo antes de aceptar."
      version={version}
      updatedAt="10 de julio de 2026"
      toc={TOC}
    >
      <div
        ref={articleRef}
        className="max-h-[60vh] overflow-y-auto pr-2 sm:pr-4 border border-gray-200 rounded-lg p-4 sm:p-6 bg-white"
      >
        <h2 id="s1">1. Partes</h2>
        <ul>
          <li><strong>GigantYA:</strong> Nicolas Perdomo Rodriguez, CC 1141116665</li>
          <li><strong>El Restaurante:</strong> la persona natural o jurídica que se registra como oferente en la plataforma</li>
        </ul>

        <h2 id="s2">2. Objeto</h2>
        <p>
          El presente acuerdo regula la relación comercial mediante la cual <strong>el
          Restaurante ofrece sus productos a través de la plataforma GigantYA</strong>, y
          <strong> GigantYA facilita la visibilidad del local, la conexión con usuarios y la
          atención de PQR</strong>.
        </p>

        <h2 id="s3">3. Declaraciones del Restaurante</h2>
        <p>Al aceptar este acuerdo, el Restaurante declara y garantiza que:</p>
        <ol>
          <li>Está legalmente constituido y cuenta con <strong>Registro Mercantil vigente</strong>.</li>
          <li>Cuenta con todos los <strong>permisos sanitarios</strong> exigidos por la autoridad competente (INVIMA y/o secretaría de salud local).</li>
          <li>Cumple con las normas de <strong>manipulación de alimentos, higiene y seguridad alimentaria</strong>.</li>
          <li>Está al día con sus <strong>obligaciones tributarias</strong> y puede expedir factura electrónica al consumidor final.</li>
          <li>La información de su catálogo (precios, descripciones, fotos) es <strong>veraz y corresponde a la realidad</strong>.</li>
          <li>Tiene <strong>autorización para usar las imágenes</strong> y marcas que publique en la plataforma.</li>
          <li><strong>No ofrece productos ilícitos</strong>, vencidos, adulterados o que requieran receta médica.</li>
          <li><strong>No vende alcohol a menores de edad</strong> ni incumple las restricciones legales aplicables.</li>
          <li>Sus <strong>precios incluyen todos los impuestos</strong> y son los mismos que ofrece en su local físico (cuando aplique).</li>
          <li>Operará su propio servicio de entrega (delivery) o contratará a un domiciliario por su cuenta.</li>
        </ol>

        <h2 id="s4">4. Responsabilidades del Restaurante</h2>
        <h3>4.1. Sobre los productos</h3>
        <p>El Restaurante es el <strong>único responsable</strong> por:</p>
        <ul>
          <li>La calidad, frescura, preparación e idoneidad de los productos</li>
          <li>La correcta declaración de <strong>alérgenos e ingredientes</strong></li>
          <li>El cumplimiento de las <strong>normas sanitarias</strong> aplicables</li>
          <li>La <strong>trazabilidad de los productos</strong> en caso de incidente sanitario</li>
          <li>La <strong>facturación al consumidor final</strong> (conforme al Estatuto Tributario)</li>
        </ul>
        <h3>4.2. Sobre la entrega</h3>
        <ul>
          <li>El Restaurante es <strong>exclusivamente responsable</strong> de la entrega de los pedidos que reciba a través de la plataforma.</li>
          <li>El Restaurante puede operar su propio delivery o contratar a un domiciliario por su cuenta.</li>
          <li>El Restaurante responde por la <strong>demora, empaque, temperatura y entrega correcta</strong> del pedido al usuario.</li>
          <li>El domicilio cobrado al cliente pertenece en su totalidad al Restaurante.</li>
        </ul>
        <h3>4.3. Sobre el precio</h3>
        <ul>
          <li>El precio publicado en GigantYA <strong>no puede ser superior</strong> al precio del local físico (cuando exista).</li>
          <li>El precio confirmado al usuario <strong>no puede ser modificado</strong> unilateralmente.</li>
          <li>Las promociones deben cumplir las <strong>normas de publicidad</strong> de la SIC.</li>
        </ul>
        <h3>4.4. Sobre los pagos del cliente final</h3>
        <p>El Restaurante es el <strong>único responsable</strong> de:</p>
        <ul>
          <li>Cobrar al consumidor final por los productos y el domicilio</li>
          <li>Procesar el pago (efectivo, datafono, Nequi, Daviplata, transferencia, etc.)</li>
          <li>Expedir factura electrónica al consumidor final</li>
          <li>Reportar y pagar los impuestos derivados de la venta</li>
        </ul>
        <h3>4.5. Sobre los reembolsos</h3>
        <ul>
          <li>En caso de error del Restaurante (producto equivocado, mal estado, no recibido), <strong>el Restaurante asume el costo del reembolso</strong>.</li>
          <li>El Restaurante acepta el procedimiento de reversión de pago de GigantYA.</li>
        </ul>

        <h2 id="s5">5. Responsabilidades de GigantYA</h2>
        <ul>
          <li>Brindar la plataforma tecnológica operativa</li>
          <li>Gestionar la atención de PQR y mediar entre el usuario y el Restaurante</li>
          <li>Trasladar al Restaurante los pedidos confirmados por los usuarios</li>
          <li>Cobrar al Restaurante la suscripción mensual acordada</li>
          <li>Mantener la Política de Privacidad y los TyC actualizados</li>
        </ul>

        <h2 id="s6">6. Modelo de suscripción</h2>
        <p>
          GigantYA cobra al Restaurante una <strong>suscripción mensual fija</strong> por el uso
          de la plataforma. <strong>NO se cobra comisión por transacción, porcentaje sobre
          ventas, ni ningún otro cargo variable.</strong>
        </p>
        <h3>6.1. Planes vigentes</h3>
        <table>
          <thead>
            <tr><th>Plan</th><th>Precio mensual</th><th>IVA (19%)</th><th>Total mensual</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Free</strong></td><td>$0</td><td>N/A</td><td>$0</td></tr>
            <tr><td><strong>Básico</strong></td><td>$30.000 COP</td><td>+$5.700</td><td>$35.700 COP</td></tr>
            <tr><td><strong>Profesional</strong></td><td>$50.000 COP</td><td>+$9.500</td><td>$59.500 COP</td></tr>
            <tr><td><strong>Premium</strong></td><td>$80.000 COP</td><td>+$15.200</td><td>$95.200 COP</td></tr>
          </tbody>
        </table>
        <p>El plan Free permite al Restaurante publicar su local y recibir pedidos, con funcionalidades limitadas según el plan.</p>
        <h3>6.2. Cobro</h3>
        <p>El cargo se realiza de forma automática el <strong>día 1 de cada mes</strong>, al medio de pago registrado por el Restaurante.</p>
        <h3>6.3. Si el pago falla</h3>
        <ul>
          <li><strong>1er intento fallido:</strong> se notifica al Restaurante y tiene 5 días hábiles para regularizar.</li>
          <li><strong>2do intento fallido:</strong> el local pasa a <strong>modo "pausado"</strong> (visible pero no recibe pedidos).</li>
          <li><strong>3er intento fallido:</strong> el local se da de <strong>baja automática</strong>.</li>
        </ul>
        <h3>6.4. Reembolso</h3>
        <p>La suscripción NO es reembolsable una vez cobrada, salvo decisión expresa de GigantYA.</p>
        <h3>6.5. IVA y facturación</h3>
        <p>GigantYA expedirá factura electrónica por la suscripción, según la normatividad tributaria colombiana.</p>

        <h2 id="s7">7. Cláusula de indemnidad</h2>
        <p>
          El Restaurante <strong>indemnizará y mantendrá indemne</strong> a GigantYA, sus socios,
          empleados y representantes, frente a cualquier reclamo, demanda, sanción, multa o
          daño causado por:
        </p>
        <ul>
          <li>Productos del Restaurante (intoxicaciones, alérgenos no declarados, contaminación, defectos sanitarios)</li>
          <li>Incumplimiento del Restaurante de cualquier ley aplicable</li>
          <li>Violación de derechos de propiedad intelectual de terceros</li>
          <li>Daños a consumidores o repartidores dentro del local o durante la entrega</li>
          <li>Cualquier acción u omisión del Restaurante que genere responsabilidad para GigantYA</li>
        </ul>
        <p>Esta obligación de indemnidad <strong>subsiste aún después de la terminación</strong> del presente acuerdo.</p>

        <h2 id="s8">8. Prohibiciones</h2>
        <p>El Restaurante <strong>NO puede</strong>:</p>
        <ul>
          <li>Vender alcohol a menores de 18 años</li>
          <li>Ofrecer productos fuera del horario de funcionamiento declarado</li>
          <li>Cobrar al cliente un precio distinto al publicado en GigantYA</li>
          <li>Solicitar pagos por fuera de los medios acordados con el cliente</li>
          <li>Difamar, competir deslealmente o actuar en contra de GigantYA</li>
          <li>Manipular reseñas o solicitar reseñas falsas</li>
          <li>Ofrecer productos ilícitos o restringidos</li>
        </ul>

        <h2 id="s9">9. Reseñas y calificaciones</h2>
        <ul>
          <li>El Restaurante <strong>no puede ofrecer beneficios</strong> a cambio de reseñas positivas.</li>
          <li>Las reseñas son moderadas por GigantYA.</li>
          <li>El Restaurante puede <strong>responder a reseñas</strong> a través del panel de administración.</li>
        </ul>

        <h2 id="s10">10. Reserva de información</h2>
        <p>
          Las partes se obligan a mantener la <strong>confidencialidad</strong> sobre la
          información comercial, técnica, financiera o estratégica de la otra parte a la que
          tengan acceso en virtud del presente acuerdo. Esta obligación subsiste por 2 años
          posteriores a la terminación.
        </p>

        <h2 id="s11">11. Causales de terminación</h2>
        <h3>11.1. Por GigantYA</h3>
        <ul>
          <li>Incumplimiento grave o reiterado del Restaurante</li>
          <li>Sanciones sanitarias al local</li>
          <li>Quejas reiteradas de consumidores</li>
          <li>Fraude, suplantación o actividad ilícita</li>
          <li>Falta de pago de la suscripción por más de 30 días</li>
        </ul>
        <h3>11.2. Por el Restaurante</h3>
        <p>El Restaurante puede dar de baja su cuenta en cualquier momento, sin necesidad de justificar.</p>
        <h3>11.3. Efectos de la terminación</h3>
        <ul>
          <li>Cesación inmediata de la publicación del local</li>
          <li>Pago de las suscripciones pendientes hasta la fecha</li>
          <li>Conservación de datos por 5 años para fines legales y contables</li>
        </ul>

        <h2 id="s12">12. Limitación de responsabilidad de GigantYA</h2>
        <p>GigantYA es una <strong>plataforma de intermediación tecnológica</strong>. Su responsabilidad se limita a:</p>
        <ul>
          <li>Operar correctamente la plataforma tecnológica</li>
          <li>Gestionar PQR y mediar entre el usuario y el Restaurante</li>
          <li>Proporcionar información veraz</li>
        </ul>
        <p><strong>GigantYA NO es responsable</strong> por:</p>
        <ul>
          <li>Acciones u omisiones del Restaurante o sus dependientes</li>
          <li>Calidad de los productos vendidos por el Restaurante</li>
          <li>Daños causados durante la preparación o por defectos del producto</li>
          <li>Conflictos laborales del Restaurante con su personal</li>
          <li>Fallas técnicas del Restaurante (internet, equipos, etc.)</li>
          <li>La entrega del pedido (es 100% responsabilidad del Restaurante)</li>
          <li>El procesamiento de pagos entre usuario y Restaurante (GigantYA no participa)</li>
        </ul>

        <h2 id="s13">13. Propiedad intelectual</h2>
        <ul>
          <li>El Restaurante <strong>otorga a GigantYA</strong> una licencia <strong>no exclusiva, mundial y gratuita</strong> para mostrar su marca, logo, fotos y descripciones en la plataforma.</li>
          <li>El Restaurante garantiza que tiene derecho sobre todo el contenido que publique.</li>
          <li>La marca, software y diseño de GigantYA son de <strong>propiedad exclusiva de GigantYA</strong>.</li>
        </ul>

        <h2 id="s14">14. Tratamiento de datos</h2>
        <p>
          Las partes se obligan a tratar los datos personales de los usuarios <strong>exclusivamente
          para los fines del presente acuerdo</strong> y en cumplimiento de la <strong>Ley 1581 de
          2012</strong>.
        </p>

        <h2 id="s15">15. Modificaciones</h2>
        <p>
          GigantYA puede modificar el presente acuerdo. Las modificaciones se notificarán al
          Restaurante con al menos <strong>15 días de anticipación</strong>. Si el Restaurante
          continúa operando en la plataforma después de esa fecha, se considerará que acepta los
          nuevos términos.
        </p>

        <h2 id="s16">16. Ley aplicable y jurisdicción</h2>
        <p>
          Este acuerdo se rige por las leyes de la <strong>República de Colombia</strong>.
          Cualquier disputa se resolverá en los tribunales de <strong>Bogotá D.C.</strong>
        </p>

        <h2 id="s17">17. Aceptación</h2>
        <p>
          Al hacer clic en <strong>"Acepto el Acuerdo Comercial"</strong>, el Restaurante declara
          que leyó, entendió y acepta la totalidad de las cláusulas de este acuerdo.
          <strong>Se guarda registro</strong> de la aceptación con fecha, hora, dirección IP,
          versión del acuerdo y nombre del firmante.
        </p>
      </div>

      {/* Aviso + botón de aceptación con scroll-to-bottom obligatorio */}
      <div className="mt-6 p-4 sm:p-6 bg-indigo-50 border border-indigo-200 rounded-xl">
        {accepted ? (
          <div className="text-center" role="status" aria-live="polite">
            <p className="text-base sm:text-lg font-semibold text-green-700">
              ✓ Acuerdo firmado
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Se registró tu aceptación con fecha {new Date(confirmation?.creado_en || Date.now()).toLocaleString('es-CO')}.
              Guarda este comprobante para tus archivos.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">
              {scrolledToEnd
                ? '✓ Leíste el acuerdo completo. Ahora puedes aceptarlo.'
                : 'Desplázate hasta el final del documento para habilitar el botón de aceptación.'}
            </p>
            <button
              onClick={handleAccept}
              disabled={!scrolledToEnd || submitting}
              className={[
                'w-full sm:w-auto px-6 py-3 rounded-lg font-semibold text-sm transition-colors',
                scrolledToEnd && !submitting
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed',
              ].join(' ')}
              aria-disabled={!scrolledToEnd || submitting}
            >
              {submitting ? 'Registrando…' : 'Acepto el Acuerdo Comercial'}
            </button>
          </>
        )}
      </div>
    </LegalLayout>
  );
}
