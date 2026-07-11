import { useEffect, useState } from 'react';
import LegalLayout from '../../components/legal/LegalLayout.jsx';
import { legalService } from '../../services/api.js';

const TOC = [
  { id: 's1', label: '1. Identificación del responsable' },
  { id: 's2', label: '2. Marco legal' },
  { id: 's3', label: '3. Definiciones' },
  { id: 's4', label: '4. Datos que recolectamos' },
  { id: 's5', label: '5. Finalidades del tratamiento' },
  { id: 's6', label: '6. Autorización del titular' },
  { id: 's7', label: '7. Transferencias internacionales' },
  { id: 's8', label: '8. Derechos del titular' },
  { id: 's9', label: '9. Procedimiento para ejercer tus derechos' },
  { id: 's10', label: '10. Seguridad de los datos' },
  { id: 's11', label: '11. Retención de datos' },
  { id: 's12', label: '12. Cookies' },
  { id: 's13', label: '13. Menores de edad' },
  { id: 's14', label: '14. Modificaciones' },
];

export default function PrivacidadPage() {
  const [version, setVersion] = useState('v1.0-2026-07-10');

  useEffect(() => {
    legalService.getVersion()
      .then((d) => { if (d?.versions?.privacidad) setVersion(d.versions.privacidad); })
      .catch(() => {});
  }, []);

  return (
    <LegalLayout
      title="Política de Privacidad"
      subtitle="Cómo tratamos tus datos personales. Cumplimos la Ley 1581 de 2012 (Habeas Data)."
      version={version}
      updatedAt="10 de julio de 2026"
      toc={TOC}
    >
      <h2 id="s1">1. Identificación del responsable del tratamiento</h2>
      <ul>
        <li><strong>Razón social:</strong> Nicolas Perdomo Rodriguez</li>
        <li><strong>NIT:</strong> CC 1141116665</li>
        <li><strong>Domicilio:</strong> Calle 4 #7-79, Gigante, Huila</li>
        <li><strong>Correo electrónico:</strong> coderepairtech@gmail.com</li>
        <li><strong>Teléfono:</strong> +57 311 532 0211</li>
      </ul>

      <h2 id="s2">2. Marco legal</h2>
      <p>
        Esta política se expide en cumplimiento de los artículos 17 y 18 de la <strong>Ley 1581
        de 2012</strong>, del artículo 13 del <strong>Decreto 1377 de 2013</strong> y de la
        <strong>Sentencia C-748 de 2011</strong> de la Corte Constitucional, que desarrollan el
        derecho constitucional de habeas data (artículo 15 de la Constitución Política de
        Colombia).
      </p>

      <h2 id="s3">3. Definiciones</h2>
      <ul>
        <li><strong>Titular:</strong> persona natural cuyos datos personales son objeto de tratamiento.</li>
        <li><strong>Dato personal:</strong> cualquier información vinculada o que pueda asociarse a una persona natural.</li>
        <li><strong>Tratamiento:</strong> toda operación sobre datos personales (recolección, almacenamiento, uso, circulación, supresión).</li>
        <li><strong>Autorización:</strong> consentimiento previo, expreso e informado del titular para el tratamiento.</li>
        <li><strong>Responsable del tratamiento:</strong> persona natural o jurídica que decide sobre el tratamiento (en este caso, GigantYA).</li>
        <li><strong>Encargado del tratamiento:</strong> persona natural o jurídica que realiza el tratamiento por cuenta del responsable.</li>
      </ul>

      <h2 id="s4">4. Datos personales que recolectamos</h2>
      <h3>4.1. De usuarios (clientes)</h3>
      <ul>
        <li><strong>De identificación:</strong> nombre, apellido, tipo y número de documento</li>
        <li><strong>De contacto:</strong> email, teléfono, dirección de entrega</li>
        <li><strong>De ubicación:</strong> barrio, sector, ciudad, coordenadas (para delivery)</li>
        <li><strong>No recolectamos datos de pago</strong> (los pagos se procesan directamente entre el usuario y el restaurante)</li>
        <li><strong>De uso:</strong> historial de pedidos, reseñas, calificaciones, búsquedas</li>
        <li><strong>Técnicos:</strong> dirección IP, tipo de dispositivo, navegador, cookies</li>
      </ul>
      <h3>4.2. De restaurantes</h3>
      <ul>
        <li><strong>De la persona natural o jurídica:</strong> NIT, razón social, nombre del representante legal, documento de identidad</li>
        <li><strong>De contacto:</strong> email, teléfono, dirección del local</li>
        <li><strong>Sanitarios y legales:</strong> permisos sanitarios, Registro Mercantil</li>
        <li><strong>De uso:</strong> catálogo, precios, fotos, calificaciones</li>
        <li><strong>Bancarios:</strong> para cobro de la suscripción mensual</li>
      </ul>

      <h2 id="s5">5. Finalidades del tratamiento</h2>
      <h3>5.1. Para usuarios (clientes)</h3>
      <ol>
        <li>Crear y administrar la cuenta de usuario</li>
        <li>Procesar pedidos y enviar la información al restaurante</li>
        <li>Facilitar la comunicación entre el usuario y el restaurante para la entrega del pedido</li>
        <li>Enviar notificaciones sobre el estado del pedido (SMS, email, WhatsApp)</li>
        <li>Brindar soporte al cliente y atención de PQR</li>
        <li>Mediar ante reclamos entre usuarios y restaurantes</li>
        <li>Mostrar y permitir publicar reseñas</li>
        <li>Prevenir fraude y garantizar la seguridad de la plataforma</li>
        <li>Cumplir obligaciones legales y regulatorias</li>
        <li>Enviar comunicaciones comerciales <strong>solo si el usuario autorizó expresamente</strong></li>
      </ol>
      <h3>5.2. Para restaurantes</h3>
      <ol>
        <li>Validar la identidad y legalidad del local</li>
        <li>Publicar el catálogo y gestionar pedidos</li>
        <li>Cobrar la <strong>suscripción mensual</strong> por el uso de la plataforma</li>
        <li>Brindar soporte y atención de PQR</li>
        <li>Cumplir obligaciones legales (Ley 1480/2011 artículo 54)</li>
        <li>Prevenir fraude</li>
      </ol>

      <h2 id="s6">6. Autorización del titular</h2>
      <p>
        De conformidad con el artículo 9 de la Ley 1581 de 2012, el tratamiento de datos
        personales requiere el <strong>consentimiento previo, expreso e informado</strong> del
        titular. GigantYA solicita la autorización:
      </p>
      <ul>
        <li>Al momento del registro (checkbox obligatorio + log de aceptación)</li>
        <li>Al momento de completar un pedido (para los datos de entrega)</li>
        <li>Al momento de publicar una reseña</li>
      </ul>
      <p><strong>Excepciones</strong> (artículo 10 Ley 1581 de 2012): no requieren autorización los datos de naturaleza pública, los necesarios para la ejecución de una relación contractual, o los requeridos por una autoridad competente.</p>

      <h2 id="s7">7. Transferencias y transmisiones internacionales</h2>
      <p>Para prestar el servicio, compartimos algunos datos con proveedores ubicados fuera de Colombia:</p>
      <table>
        <thead>
          <tr><th>Proveedor</th><th>Ubicación</th><th>Datos compartidos</th><th>Finalidad</th></tr>
        </thead>
        <tbody>
          <tr><td>Cloudinary</td><td>Estados Unidos</td><td>Imágenes de perfil, fotos de productos y locales</td><td>Almacenamiento y optimización de imágenes</td></tr>
          <tr><td>Meta (WhatsApp Business)</td><td>Estados Unidos</td><td>Teléfono, nombre</td><td>Envío de notificaciones del pedido</td></tr>
          <tr><td>Pasarela de suscripción</td><td>Colombia (procesador local)</td><td>Datos de pago de la suscripción</td><td>Cobro de la suscripción mensual</td></tr>
          <tr><td>Servidores de hosting</td><td>Estados Unidos</td><td>Datos del usuario</td><td>Hospedaje de la plataforma</td></tr>
        </tbody>
      </table>
      <p>
        Estas transmisiones se realizan con base en <strong>cláusulas contractuales tipo</strong>
        o mediante proveedores que ofrecen garantías de cumplimiento de estándares equivalentes
        a los exigidos por la Ley 1581 de 2012.
      </p>

      <h2 id="s8">8. Derechos del titular (Art. 17 Ley 1581/2012)</h2>
      <p>Como titular de los datos personales, tienes los siguientes derechos:</p>
      <ol>
        <li><strong>Conocer, actualizar y rectificar</strong> tus datos personales</li>
        <li><strong>Solicitar prueba de la autorización</strong> otorgada</li>
        <li><strong>Ser informado</strong> sobre el uso dado a tus datos</li>
        <li><strong>Presentar quejas</strong> ante la SIC por infracciones a la ley</li>
        <li><strong>Revocar la autorización</strong> y/o <strong>solicitar la supresión</strong> de tus datos</li>
        <li><strong>Acceder gratuitamente</strong> a tus datos personales</li>
      </ol>

      <h2 id="s9">9. Procedimiento para ejercer tus derechos</h2>
      <p>Para conocer, actualizar, rectificar, suprimir o revocar, puedes:</p>
      <ul>
        <li><strong>Email:</strong> coderepairtech@gmail.com</li>
        <li><strong>Formulario en la plataforma:</strong> Configuración de cuenta &gt; Privacidad</li>
      </ul>
      <p><strong>Plazos de respuesta (Art. 15 Ley 1581/2012):</strong></p>
      <ul>
        <li><strong>Consulta:</strong> máximo 10 días hábiles</li>
        <li><strong>Reclamo:</strong> máximo 15 días hábiles</li>
      </ul>
      <p>Si la respuesta es insatisfactoria o no se responde en plazo, puedes elevar una queja ante la <strong>Superintendencia de Industria y Comercio (SIC)</strong>.</p>

      <h2 id="s10">10. Seguridad de los datos</h2>
      <p>Implementamos medidas técnicas, humanas y administrativas razonables para proteger tus datos, conforme al principio de <strong>responsabilidad demostrada</strong> (artículo 26 Ley 1581/2012):</p>
      <ul>
        <li>Cifrado de contraseñas (bcrypt)</li>
        <li>HTTPS en todas las comunicaciones</li>
        <li>Acceso a datos personales limitado por roles</li>
        <li>Logs de auditoría</li>
        <li>Backups cifrados</li>
      </ul>

      <h2 id="s11">11. Retención de datos</h2>
      <p>Conservamos tus datos personales durante:</p>
      <ul>
        <li><strong>Mientras tu cuenta esté activa</strong> y exista relación contractual</li>
        <li><strong>5 años adicionales</strong> después del cierre de la cuenta, para cumplir obligaciones legales y contables</li>
        <li><strong>30 días</strong> para datos de pedidos no completados</li>
      </ul>
      <p>Al cumplirse estos plazos, los datos se eliminan de forma segura o se anonimizan.</p>

      <h2 id="s12">12. Cookies y tecnologías similares</h2>
      <p>Usamos cookies y tecnologías similares. Para más información, consulta nuestra <a href="/cookies">Política de Cookies</a>.</p>

      <h2 id="s13">13. Menores de edad</h2>
      <p>
        GigantYA no está dirigida a menores de 18 años. No recolectamos intencionalmente datos de
        menores. Si un padre/madre/tutor detecta que un menor proporcionó datos, puede
        contactarnos a coderepairtech@gmail.com para proceder a la supresión inmediata.
      </p>

      <h2 id="s14">14. Modificaciones a esta política</h2>
      <p>
        Puedes modificar esta política. Te avisaremos por email o mediante aviso en la
        plataforma con al menos <strong>15 días de anticipación</strong>.
      </p>
    </LegalLayout>
  );
}
