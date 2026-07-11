import { useEffect, useState } from 'react';
import LegalLayout from '../../components/legal/LegalLayout.jsx';
import { legalService } from '../../services/api.js';

const TOC = [
  { id: 's1', label: '1. Información del responsable' },
  { id: 's2', label: '2. Aceptación de los términos' },
  { id: 's3', label: '3. Naturaleza del servicio' },
  { id: 's4', label: '4. Relación contractual' },
  { id: 's5', label: '5. Edad mínima' },
  { id: 's6', label: '6. Registro y cuenta' },
  { id: 's7', label: '7. Pedidos, precios y pagos' },
  { id: 's8', label: '8. Derecho de retracto' },
  { id: 's9', label: '9. Reversión de pago' },
  { id: 's10', label: '10. Garantía sobre el producto' },
  { id: 's11', label: '11. Plazos de entrega' },
  { id: 's12', label: '12. Cancelaciones' },
  { id: 's13', label: '13. Comportamiento del usuario' },
  { id: 's14', label: '14. Reseñas y contenido generado' },
  { id: 's15', label: '15. Propiedad intelectual' },
  { id: 's16', label: '16. Limitación de responsabilidad' },
  { id: 's17', label: '17. Autoridad de protección al consumidor' },
  { id: 's18', label: '18. Indemnidad' },
  { id: 's19', label: '19. Modificaciones' },
  { id: 's20', label: '20. Suspensión y terminación' },
  { id: 's21', label: '21. Ley aplicable y jurisdicción' },
  { id: 's22', label: '22. Notificaciones' },
  { id: 's23', label: '23. Disposiciones finales' },
];

export default function TerminosPage() {
  const [version, setVersion] = useState('v1.0-2026-07-10');

  useEffect(() => {
    legalService.getVersion()
      .then((d) => { if (d?.versions?.tyc) setVersion(d.versions.tyc); })
      .catch(() => { /* fallback al default */ });
  }, []);

  return (
    <LegalLayout
      title="Términos y Condiciones"
      subtitle="Reglas que rigen tu uso de GigantYA. Al usar la plataforma, las aceptas."
      version={version}
      updatedAt="10 de julio de 2026"
      toc={TOC}
    >
      <h2 id="s1">1. Información del responsable</h2>
      <p>
        De conformidad con la Ley 1480 de 2011 (Estatuto del Consumidor) y la Ley 527 de 1999
        (Comercio Electrónico), se identifica al responsable de la plataforma:
      </p>
      <ul>
        <li><strong>Razón social:</strong> Nicolas Perdomo Rodriguez</li>
        <li><strong>NIT:</strong> CC 1141116665</li>
        <li><strong>Domicilio:</strong> Calle 4 #7-79, Gigante, Huila</li>
        <li><strong>Correo electrónico de contacto / PQR:</strong> contacto@gigantya.com</li>
        <li><strong>Teléfono:</strong> +57 311 532 0211</li>
        <li><strong>Sitio web:</strong> https://gigantya.com</li>
      </ul>

      <h2 id="s2">2. Aceptación de los términos</h2>
      <p>
        Al crear una cuenta en GigantYA, hacer clic en "Acepto" o utilizar nuestros servicios,
        declaras que leíste, entendiste y aceptas estos Términos y Condiciones en su totalidad.
        Si no estás de acuerdo, debes abstenerte de usar la plataforma.
      </p>
      <p>
        Guardamos <strong>constancia de la aceptación</strong> (fecha, hora, dirección IP y
        versión del TyC aceptado) en nuestros sistemas, conforme al artículo 15 de la Ley 527
        de 1999.
      </p>

      <h2 id="s3">3. Naturaleza del servicio</h2>
      <p>GigantYA es una <strong>plataforma tecnológica de intermediación</strong> que pone en contacto a usuarios con restaurantes y locales de comida, permitiéndoles:</p>
      <ul>
        <li>Ver el catálogo de productos ofrecidos por los restaurantes</li>
        <li>Realizar pedidos de comida</li>
        <li>Recibir notificaciones sobre el estado del pedido</li>
        <li>Calificar y dejar reseñas</li>
      </ul>
      <p>
        <strong>GigantYA NO es un restaurante</strong>, no prepara, almacena ni vende productos,
        y <strong>NO procesa los pagos</strong> entre el usuario y el restaurante. La venta y el
        cobro se realizan <strong>directamente entre el usuario y el restaurante</strong> (en el
        local, con datafono del local, Nequi, Daviplata, transferencia o efectivo).
      </p>
      <p>
        <strong>GigantYA NO opera el servicio de entrega (delivery)</strong>. La entrega es
        responsabilidad exclusiva de cada restaurante, ya sea con su propio personal o con un
        domiciliario contratado por el local.
      </p>
      <p>
        GigantYA cobra a los restaurantes una <strong>suscripción mensual fija</strong> por el
        uso de la plataforma. No se cobra comisión, porcentaje ni cargo variable sobre las
        ventas.
      </p>

      <h2 id="s4">4. Relación contractual</h2>
      <p>
        La <strong>relación de compraventa se celebra entre el usuario y el restaurante</strong>.
        GigantYA participa como intermediario tecnológico que facilita el contacto, la
        comunicación y la visibilidad de los locales.
      </p>
      <p>Conforme al artículo 50 de la Ley 1480 de 2011, GigantYA responde por:</p>
      <ul>
        <li>Brindar información clara y veraz sobre los locales y sus productos</li>
        <li>Disponer de canales de atención de PQR con trazabilidad</li>
        <li>Mediar entre el usuario y el restaurante ante reclamos sobre productos o entregas</li>
      </ul>
      <p>
        <strong>GigantYA NO procesa pagos</strong> entre el usuario y el restaurante. La
        ejecución de cobros, reembolsos o cualquier transacción económica es responsabilidad del
        restaurante, de acuerdo con el medio de pago que el local haya definido.
      </p>
      <p>
        Los reclamos sobre calidad, ingredientes, alérgenos, contenido, sabor, temperatura o
        idoneidad del producto, o sobre la entrega, <strong>deberán dirigirse en primer lugar
        al restaurante</strong>, sin perjuicio del derecho del usuario de acudir a GigantYA para
        mediar y/o a la Superintendencia de Industria y Comercio (SIC).
      </p>

      <h2 id="s5">5. Edad mínima</h2>
      <p>
        Para usar GigantYA debes tener <strong>al menos 18 años</strong>. Los menores de edad
        no pueden registrarse ni realizar pedidos, en cumplimiento del artículo 53 de la Ley
        1480 de 2011.
      </p>

      <h2 id="s6">6. Registro y cuenta</h2>
      <p>Para usar ciertas funciones debes crear una cuenta. Te comprometes a:</p>
      <ul>
        <li>Brindar información <strong>verdadera, exacta y actualizada</strong></li>
        <li>Mantener la confidencialidad de tu contraseña</li>
        <li>No compartir tu cuenta con terceros</li>
        <li>Notificarnos inmediatamente ante uso no autorizado</li>
      </ul>
      <p>Puedes cerrar tu cuenta en cualquier momento desde tu perfil.</p>

      <h2 id="s7">7. Pedidos, precios y pagos</h2>
      <ul>
        <li>Los precios, impuestos y cargos adicionales los fija <strong>cada restaurante</strong>.</li>
        <li>Si un producto aparece con precios diferentes, conforme al Estatuto del Consumidor, <strong>prevalecerá el precio menor</strong>.</li>
        <li>Una vez confirmada la orden de compra, <strong>el precio no puede ser modificado</strong> unilateralmente por el restaurante.</li>
        <li><strong>El pago del pedido se realiza directamente entre el usuario y el restaurante</strong>, en el momento de la entrega, por el medio de pago que el local haya definido.</li>
        <li><strong>GigantYA no interviene en la transacción económica.</strong></li>
      </ul>

      <h2 id="s8">8. Derecho de retracto (Art. 47 Ley 1480 de 2011)</h2>
      <p>
        La Ley 1480 de 2011 reconoce el derecho de retracto dentro de los <strong>5 días
        hábiles</strong> siguientes a la entrega del producto.
      </p>
      <p>
        <strong>Excepción aplicable:</strong> en cumplimiento del artículo 47 numeral 3,
        <strong> el derecho de retracto NO aplica a productos de consumo inmediato, alimentos
        perecederos o bebidas</strong>. Esta excepción cubre la totalidad del catálogo de
        GigantYA. Por lo tanto, una vez entregado el pedido, <strong>no procede retracto</strong>.
        Lo que sí aplica es la <strong>reversión de pago</strong> y la <strong>garantía sobre
        idoneidad y calidad</strong> del producto.
      </p>

      <h2 id="s9">9. Reversión de pago (Art. 51 Ley 1480 de 2011)</h2>
      <p>El usuario podrá solicitar la <strong>reversión del pago</strong> dentro de los <strong>5 días hábiles</strong> siguientes a la transacción cuando:</p>
      <ul>
        <li>Haya sido víctima de fraude o suplantación</li>
        <li>La operación no haya sido solicitada por el usuario</li>
        <li>El producto no haya sido recibido</li>
        <li>El producto entregado sea defectuoso, esté en mal estado o no corresponda a lo solicitado</li>
      </ul>
      <p><strong>Procedimiento:</strong></p>
      <ol>
        <li><strong>Recepción:</strong> el usuario notifica a GigantYA por el canal de PQR, indicando el motivo y, cuando aplique, adjuntando evidencia fotográfica.</li>
        <li><strong>Mediación:</strong> GigantYA traslada el reclamo al restaurante, quien tiene 5 días hábiles para pronunciarse. La ejecución efectiva de la reversión corresponde al restaurante y al medio de pago utilizado, no a GigantYA.</li>
        <li><strong>Resolución:</strong> si el restaurante confirma el error, procede con la devolución/reverso por su cuenta y medio de pago. Si no responde en el plazo, el usuario conserva su derecho de acudir a la SIC o a la jurisdicción ordinaria.</li>
        <li><strong>Plazo total:</strong> máximo 15 días hábiles desde la recepción del reclamo (artículo 58 Ley 1480).</li>
      </ol>
      <p>
        <strong>Nota:</strong> GigantYA facilitará la comunicación entre las partes y conservará
        evidencia del reclamo. La ejecución efectiva de la reversión corresponde al restaurante
        que cobró al usuario, no a GigantYA.
      </p>

      <h2 id="s10">10. Garantía sobre el producto (Art. 7 Ley 1480)</h2>
      <p>
        Los productos ofrecidos por los restaurantes gozan de <strong>garantía legal de
        idoneidad y calidad</strong>. Si el producto presenta defectos, está en mal estado, no
        corresponde a lo solicitado o no cumple con las condiciones informadas al consumidor, el
        usuario tiene derecho a:
      </p>
      <ul>
        <li>Cambio del producto</li>
        <li>Devolución del dinero</li>
        <li>Solución diferente acordada entre las partes</li>
      </ul>
      <p>Esta garantía es exigible al restaurante. GigantYA intermediará para facilitar la solución.</p>

      <h2 id="s11">11. Plazos de entrega</h2>
      <p>
        Conforme al artículo 50 de la Ley 1480 de 2011, el producto se entregará en el plazo
        <strong>pactado al momento de la compra</strong>. Si no se hubiera pactado plazo, la
        entrega se realizará dentro de los <strong>30 días calendario</strong> siguientes a la
        confirmación del pedido. Como la entrega es operada por el restaurante, este plazo se
        entiende como el plazo máximo de cumplimiento de la obligación de entregar por parte del
        restaurante.
      </p>

      <h2 id="s12">12. Cancelaciones</h2>
      <ul>
        <li><strong>Antes de "Confirmado por el local":</strong> puedes cancelar sin cargo.</li>
        <li><strong>Después de "Confirmado":</strong> el restaurante puede aceptar o rechazar la cancelación según el estado de la preparación.</li>
        <li><strong>Errores del restaurante:</strong> el restaurante asume el costo del reembolso.</li>
        <li><strong>Errores de la plataforma:</strong> GigantYA intermedia la cancelación.</li>
      </ul>
      <p><strong>Plazo para reclamos:</strong> 24 horas desde la entrega.</p>

      <h2 id="s13">13. Comportamiento del usuario</h2>
      <p>Está prohibido:</p>
      <ul>
        <li>Brindar información falsa</li>
        <li>Suplantar la identidad de terceros</li>
        <li>Acosar, amenazar o insultar a restaurantes o repartidores</li>
        <li>Publicar contenido obsceno, difamatorio, discriminatorio o ilegal</li>
        <li>Usar la plataforma para actividades ilícitas</li>
        <li>Intentar vulnerar la seguridad del sistema</li>
      </ul>
      <p>El incumplimiento puede resultar en la suspensión o baja de la cuenta.</p>

      <h2 id="s14">14. Reseñas y contenido generado</h2>
      <ul>
        <li>Puedes dejar reseñas honestas y respetuosas.</li>
        <li>Las reseñas son <strong>moderadas</strong>. GigantYA puede eliminar las que violen estas reglas o sean manifiestamente falsas.</li>
        <li>Está prohibido manipular reseñas o pedir reseñas falsas a cambio de beneficios.</li>
        <li>Al publicar una reseña, otorgas a GigantYA una licencia no exclusiva, mundial y gratuita para reproducirla y mostrarla en la plataforma.</li>
      </ul>

      <h2 id="s15">15. Propiedad intelectual</h2>
      <ul>
        <li>"GigantYA", el logo, los colores, el software, el diseño y el contenido de la plataforma son <strong>propiedad de GigantYA</strong> o de sus licenciantes.</li>
        <li>Está prohibido usar nuestras marcas, logos o contenido sin autorización escrita.</li>
        <li>Los restaurantes nos otorgan una licencia no exclusiva para mostrar su marca, fotos y descripciones dentro de la plataforma.</li>
      </ul>

      <h2 id="s16">16. Limitación de responsabilidad</h2>
      <p>En la máxima medida permitida por la ley colombiana aplicable:</p>
      <ul>
        <li><strong>La entrega de los productos es operada por cada restaurante</strong> o por el domiciliario que este contrate. En consecuencia, GigantYA <strong>NO se hace responsable</strong> por la demora, pérdida, daño, temperatura, empaque o cualquier issue relacionado con la entrega.</li>
        <li>GigantYA <strong>NO se hace responsable</strong> por la calidad, ingredientes, alérgenos, sabor, contenido, legalidad o idoneidad de los productos vendidos por los restaurantes, sin perjuicio de las garantías legales del artículo 7 de la Ley 1480 de 2011.</li>
        <li><strong>GigantYA NO procesa pagos</strong> entre usuarios y restaurantes. Cualquier issue con el cobro, el reembolso o la reversión de pago es responsabilidad del restaurante que recibió el pago.</li>
        <li>GigantYA <strong>NO garantiza</strong> la disponibilidad ininterrumpida del servicio. El servicio puede interrumpirse por mantenimiento, fallas técnicas, caso fortuito o fuerza mayor.</li>
        <li>En ningún caso GigantYA será responsable por <strong>daños indirectos, lucro cesante, pérdida de datos o daño emergente</strong>.</li>
      </ul>

      <h2 id="s17">17. Autoridad de protección al consumidor</h2>
      <p>
        En cumplimiento del artículo 50 de la Ley 1480 de 2011, informamos al usuario que la
        <strong>Superintendencia de Industria y Comercio (SIC)</strong> es la autoridad nacional
        de protección al consumidor en Colombia:
      </p>
      <ul>
        <li><strong>Sede electrónica:</strong> <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer">https://www.sic.gov.co</a></li>
        <li><strong>SIC Facilita:</strong> <a href="https://sicfacilita.sic.gov.co" target="_blank" rel="noopener noreferrer">https://sicfacilita.sic.gov.co</a></li>
        <li><strong>Línea de atención:</strong> 601 592 0400 / 601 587 0001</li>
      </ul>

      <h2 id="s18">18. Indemnidad</h2>
      <p>
        Aceptas <strong>indemnizar y mantener indemne</strong> a GigantYA frente a cualquier
        reclamo, daño, pérdida, multa o gasto (incluidos honorarios legales) que surja de:
      </p>
      <ul>
        <li>Tu uso de la plataforma</li>
        <li>Tu incumplimiento de estos TyC</li>
        <li>Tu violación de derechos de terceros</li>
      </ul>

      <h2 id="s19">19. Modificaciones</h2>
      <p>
        Puedes modificar estos TyC en cualquier momento. Te avisaremos por email o mediante
        aviso visible en la plataforma con al menos <strong>15 días de anticipación</strong> a
        la entrada en vigencia. Si sigues usando la plataforma después de esa fecha, se
        considerará que aceptas los nuevos términos.
      </p>

      <h2 id="s20">20. Suspensión y terminación</h2>
      <p>
        Puedes cerrar tu cuenta en cualquier momento. GigantYA puede suspender o cerrar tu cuenta,
        con o sin aviso, si violas estos TyC, sospechamos fraude o actividad ilícita, o por
        requerimientos legales o de autoridades.
      </p>

      <h2 id="s21">21. Ley aplicable y jurisdicción</h2>
      <p>
        Estos TyC se rigen por las leyes de la <strong>República de Colombia</strong>. Cualquier
        disputa se resolverá en los tribunales de la ciudad de <strong>Bogotá D.C.</strong>, salvo
        que la ley establezca fuero imperativo distinto (como normas de protección al consumidor).
      </p>

      <h2 id="s22">22. Notificaciones</h2>
      <ul>
        <li>De GigantYA hacia ti: al email registrado en tu cuenta, o mediante aviso en la plataforma</li>
        <li>De ti hacia GigantYA: al email de PQR indicado en la sección 1</li>
      </ul>

      <h2 id="s23">23. Disposiciones finales</h2>
      <ul>
        <li>Si alguna cláusula es declarada inválida por un tribunal, las demás siguen vigentes.</li>
        <li>El hecho de que GigantYA no ejerza un derecho no implica renuncia al mismo.</li>
        <li>Estos TyC constituyen el acuerdo completo entre tú y GigantYA respecto del uso de la plataforma.</li>
      </ul>
    </LegalLayout>
  );
}
