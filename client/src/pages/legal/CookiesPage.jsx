import { useEffect, useState } from 'react';
import LegalLayout from '../../components/legal/LegalLayout.jsx';
import { legalService } from '../../services/api.js';

const TOC = [
  { id: 's1', label: '1. ¿Qué son las cookies?' },
  { id: 's2', label: '2. Cookies que usamos' },
  { id: 's3', label: '3. Cómo gestionar las cookies' },
  { id: 's4', label: '4. Terceros' },
  { id: 's5', label: '5. Más información' },
];

export default function CookiesPage() {
  const [version, setVersion] = useState('v1.0-2026-07-10');

  useEffect(() => {
    legalService.getVersion()
      .then((d) => { if (d?.versions?.cookies) setVersion(d.versions.cookies); })
      .catch(() => {});
  }, []);

  return (
    <LegalLayout
      title="Política de Cookies"
      subtitle="Qué cookies usamos, para qué, y cómo puedes gestionarlas."
      version={version}
      updatedAt="10 de julio de 2026"
      toc={TOC}
    >
      <h2 id="s1">1. ¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos de texto que un sitio web almacena en tu dispositivo
        cuando lo visitas. Sirven para que el sitio funcione correctamente, recuerde tus
        preferencias y, en algunos casos, para fines de análisis y marketing.
      </p>

      <h2 id="s2">2. Cookies que usamos</h2>

      <h3>2.1. Cookies esenciales (no requieren consentimiento)</h3>
      <p>Son necesarias para que la plataforma funcione. No se pueden desactivar.</p>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Finalidad</th><th>Duración</th></tr>
        </thead>
        <tbody>
          <tr><td><code>session</code></td><td>Mantener tu sesión iniciada</td><td>Sesión</td></tr>
          <tr><td><code>auth_token</code></td><td>Autenticación JWT</td><td>7 días</td></tr>
          <tr><td><code>cart</code></td><td>Guardar el carrito de compras</td><td>7 días</td></tr>
          <tr><td><code>csrf_token</code></td><td>Protección contra CSRF</td><td>Sesión</td></tr>
        </tbody>
      </table>

      <h3>2.2. Cookies de preferencia (opcional)</h3>
      <p>Recuerdan tus preferencias para mejorar la experiencia.</p>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Finalidad</th><th>Duración</th></tr>
        </thead>
        <tbody>
          <tr><td><code>theme</code></td><td>Modo claro/oscuro</td><td>1 año</td></tr>
          <tr><td><code>recent_searches</code></td><td>Búsquedas recientes en la home</td><td>30 días</td></tr>
          <tr><td><code>recent_addresses</code></td><td>Direcciones recientes de entrega</td><td>30 días</td></tr>
        </tbody>
      </table>

      <h3>2.3. Cookies de análisis (opcional)</h3>
      <p>Nos permiten entender cómo usas la plataforma para mejorarla.</p>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Finalidad</th><th>Duración</th></tr>
        </thead>
        <tbody>
          <tr><td><code>_ga</code> (Google Analytics)</td><td>Análisis de uso</td><td>2 años</td></tr>
          <tr><td><code>_gid</code></td><td>Análisis de uso</td><td>24 horas</td></tr>
        </tbody>
      </table>

      <h3>2.4. Cookies de marketing (opcional)</h3>
      <p>Se usan para mostrar publicidad relevante.</p>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Finalidad</th><th>Duración</th></tr>
        </thead>
        <tbody>
          <tr><td><code>_fbp</code> (Meta Pixel)</td><td>Conversiones y remarketing</td><td>90 días</td></tr>
        </tbody>
      </table>

      <h2 id="s3">3. Cómo gestionar las cookies</h2>
      <p>
        Puedes aceptar, rechazar o configurar las cookies mediante el <strong>banner de
        consentimiento</strong> que aparece al ingresar a la plataforma. Tus preferencias se
        guardan por 12 meses y puedes cambiarlas en cualquier momento desde{' '}
        <em>Configuración de cuenta &gt; Privacidad &gt; Cookies</em>.
      </p>
      <p>
        También puedes desactivar las cookies directamente en tu navegador. Si lo haces, algunas
        funciones de la plataforma pueden no estar disponibles.
      </p>

      <h2 id="s4">4. Terceros</h2>
      <p>
        Algunos terceros (Google, Meta) pueden usar cookies cuando interactúas con sus
        servicios embebidos. Estos terceros tienen sus propias políticas:
      </p>
      <ul>
        <li><a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google — Política de cookies</a></li>
        <li><a href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer">Meta — Política de cookies</a></li>
      </ul>

      <h2 id="s5">5. Más información</h2>
      <p>
        Para cualquier duda sobre cookies, contactanos a{' '}
        <a href="mailto:coderepairtech@gmail.com">coderepairtech@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
