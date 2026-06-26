// Generador del PDF "Guía de Ventas - GigantYA"
// Ejecutar: node docs/ventas/generar-pdf.js
// Genera: docs/ventas/Guia-de-Ventas-GigantYA.pdf

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outDir = path.join(__dirname);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'Guia-de-Ventas-GigantYA.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title: 'Guía de Ventas - GigantYA',
    Author: 'Equipo GigantYA',
    Subject: 'Documento informativo de la plataforma para el equipo de ventas',
    Keywords: 'gigantya, ventas, restaurantes, pedidos, plataforma',
  },
});

// Colores corporativos (basados en la paleta del proyecto)
const COLOR_PRIMARY = '#FF6B00';      // Electric Orange
const COLOR_DARK = '#1F2937';
const COLOR_GRAY = '#6B7280';
const COLOR_LIGHT_BG = '#FFF7ED';
const COLOR_ACCENT = '#3B82F6';
const COLOR_GREEN = '#10B981';
const COLOR_RED = '#EF4444';

doc.pipe(fs.createWriteStream(outPath));

// ============================================================
// PORTADA
// ============================================================
doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR_PRIMARY);

doc.fillColor('#FFFFFF')
  .fontSize(46).font('Helvetica-Bold')
  .text('GIGANTYA', 60, 200, { align: 'center' });

doc.fontSize(18).font('Helvetica')
  .text('Plataforma de Pedidos para Restaurantes', 60, 270, { align: 'center' });

doc.moveTo(200, 310).lineTo(395, 310).lineWidth(2).strokeColor('#FFFFFF').stroke();

doc.fontSize(22).font('Helvetica-Bold')
  .text('Guía de Ventas', 60, 340, { align: 'center' });

doc.fontSize(14).font('Helvetica')
  .text('Documento informativo para el equipo comercial', 60, 380, { align: 'center' });

doc.fontSize(12)
  .text('Giganta, Huila — Colombia', 60, 480, { align: 'center' });

doc.fontSize(10)
  .text('Versión 1.0  •  Junio 2026', 60, 510, { align: 'center' });

// Footer de portada
doc.fontSize(9)
  .text('Este documento está dirigido al equipo de ventas de GigantYA y describe, en lenguaje claro y sin tecnicismos, todas las funciones que ofrece la plataforma web a clientes, restaurantes y administradores.', 60, 720, { width: 480, align: 'center' });

doc.addPage();

// ============================================================
// FUNCIÓN HELPER PARA ENCABEZADOS DE SECCIÓN
// ============================================================
function sectionTitle(num, title) {
  doc.fillColor(COLOR_PRIMARY).fontSize(22).font('Helvetica-Bold');
  doc.text(`${num}. ${title}`, { underline: false });
  doc.moveDown(0.5);
  doc.fillColor(COLOR_DARK);
}

function subTitle(text) {
  doc.moveDown(0.3);
  doc.fillColor(COLOR_DARK).fontSize(15).font('Helvetica-Bold');
  doc.text(text);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(11);
}

function paragraph(text) {
  doc.fillColor(COLOR_DARK).fontSize(11).font('Helvetica');
  doc.text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.5);
}

function bullet(text) {
  doc.fillColor(COLOR_DARK).fontSize(11).font('Helvetica');
  doc.text(`•  ${text}`, { indent: 15, align: 'justify' });
}

function calloutBox(title, body) {
  const startY = doc.y;
  const boxWidth = 475;
  const padding = 10;
  doc.font('Helvetica-Bold').fontSize(11);
  const titleHeight = doc.heightOfString(title, { width: boxWidth - 2 * padding });
  doc.font('Helvetica').fontSize(10);
  const bodyHeight = doc.heightOfString(body, { width: boxWidth - 2 * padding });
  const totalHeight = titleHeight + bodyHeight + 3 * padding;

  if (startY + totalHeight > doc.page.height - 70) {
    doc.addPage();
  }
  const y = doc.y;
  doc.rect(60, y, boxWidth, totalHeight).fillAndStroke(COLOR_LIGHT_BG, COLOR_PRIMARY);
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11)
    .text(title, 60 + padding, y + padding, { width: boxWidth - 2 * padding });
  doc.fillColor(COLOR_DARK).font('Helvetica').fontSize(10)
    .text(body, 60 + padding, y + padding + titleHeight + padding, { width: boxWidth - 2 * padding });
  doc.y = y + totalHeight + 10;
}

// ============================================================
// ENCABEZADO Y PIE DE PÁGINA
// ============================================================
const pageRanges = [];
doc.on('pageAdded', () => {
  pageRanges.push(doc.bufferedPageRange().start + doc.bufferedPageRange().count);
});

// Header en cada página (excepto portada)
function addHeaderFooter(pageNum) {
  const range = doc.bufferedPageRange();
  // Re-aplicar a la página actual no es trivial; usamos un hack: en cada addPage pintamos
}

// ============================================================
// 1. ¿QUÉ ES GIGANTYA?
// ============================================================
sectionTitle('1', '¿Qué es GigantYA?');

paragraph('GigantYA es una plataforma web que conecta a los habitantes de Giganta (Huila) y sus alrededores con los restaurantes locales, permitiendo explorar menús, hacer pedidos en línea y recibirlos a domicilio o recogerlos en el local, todo desde el computador o el celular.');

paragraph('La plataforma está pensada para tres tipos de usuarios, y cada uno tiene su propio espacio y sus propias funciones:');

bullet('Clientes: personas que quieren pedir comida a domicilio o pasar a recogerla.');
bullet('Restaurantes: dueños y empleados de restaurantes que reciben y gestionan los pedidos.');
bullet('Administradores: el equipo de GigantYA que supervisa, aprueba y mantiene la plataforma.');

calloutBox('Slogan de la plataforma', '“GigantYA, tu comida favorita, a un clic.” — La plataforma busca darle visibilidad a los restaurantes locales de Giganta, Huila, y al mismo tiempo ofrecer a los clientes una forma rápida, segura y moderna de pedir.');

doc.addPage();

// ============================================================
// 2. ¿CÓMO FUNCIONA LA PLATAFORMA? (flujo general)
// ============================================================
sectionTitle('2', '¿Cómo funciona la plataforma? (paso a paso)');

paragraph('Aunque por dentro hay mucha tecnología, el flujo para el cliente es muy sencillo:');

subTitle('Para el cliente');
bullet('El cliente entra a la página principal de GigantYA desde su computador o celular.');
bullet('Ve la lista de restaurantes disponibles, con foto, calificación, horario y ciudad.');
bullet('Filtra por ciudad, busca por nombre o explora las categorías del menú.');
bullet('Abre el restaurante que le interesa, revisa el menú con precios, descripciones y disponibilidad de cada plato.');
bullet('Agrega los productos que quiere al carrito, eligiendo las cantidades.');
bullet('Aplica cupones de descuento si tiene uno.');
bullet('Confirma su pedido, elige método de pago y dirección de entrega.');
bullet('Sube el comprobante de pago (si el método lo requiere) y recibe confirmación.');
bullet('El restaurante prepara el pedido y le notifica cuando está listo o en camino.');
bullet('El cliente califica el servicio y el producto cuando lo recibe.');

subTitle('Para el restaurante');
bullet('Se registra en la plataforma, completa su información y carga su menú.');
bullet('Recibe los pedidos en tiempo real dentro de su panel.');
bullet('Confirma o rechaza el pedido, lo marca como “Preparando”, “Listo” o “Entregado”.');
bullet('Valida los comprobantes de pago que suben los clientes.');
bullet('Crea cupones de descuento y configura métodos de pago, impuestos y envíos.');

subTitle('Para el administrador');
bullet('Aprueba el registro de nuevos restaurantes antes de que salgan al público.');
bullet('Gestiona usuarios, zonas, categorías y configuración general.');
bullet('Supervisa pedidos, pagos y calificaciones.');
bullet('Genera reportes y exportaciones para el equipo.');

doc.addPage();

// ============================================================
// 3. EXPERIENCIA DEL CLIENTE
// ============================================================
sectionTitle('3', 'Experiencia del Cliente (todo lo que puede hacer)');

subTitle('3.1. Registro e inicio de sesión');
paragraph('El cliente puede crear una cuenta gratuita con su nombre, correo electrónico, teléfono y contraseña. También puede recuperar su contraseña si la olvida, siguiendo un proceso seguro por correo electrónico.');

subTitle('3.2. Página de inicio (Home)');
paragraph('Es la pantalla principal. Muestra:');
bullet('Un banner con restaurantes destacados y promociones activas.');
bullet('Una barra de búsqueda para encontrar restaurantes o platos por palabra clave.');
bullet('Búsquedas recientes del cliente, para volver a pedir lo que ya pidió antes con un solo clic.');
bullet('Una lista de categorías populares (comida rápida, almuerzos, bebidas, postres, etc.).');
bullet('Una cuadrícula con todos los restaurantes disponibles, mostrando: foto, nombre, descripción corta, ciudad, horario de apertura/cierre, calificación con estrellas y un indicador visual de “Abierto” o “Cerrado”.');
bullet('Filtros para ordenar por nombre, calificación o por novedad.');

subTitle('3.3. Detalle del restaurante');
paragraph('Cuando el cliente hace clic en un restaurante, ve una página completa con:');
bullet('La foto principal del restaurante y la descripción completa.');
bullet('El horario de atención, dirección y teléfono de contacto.');
bullet('El estado (Abierto/Cerrado) en tiempo real, según la hora actual.');
bullet('Las categorías del menú (entradas, platos fuertes, bebidas, postres, etc.).');
bullet('La lista de productos, cada uno con foto, nombre, descripción, precio y disponibilidad.');
bullet('Botón para marcar el restaurante como favorito (corazón).');
bullet('Indicador de costo de envío y opciones de entrega.');

subTitle('3.4. Carrito de compras');
paragraph('El cliente puede agregar productos al carrito, cambiar cantidades, eliminar productos, ver el subtotal, el costo de envío, los impuestos y el total a pagar. Puede aplicar cupones de descuento antes de confirmar el pedido.');

subTitle('3.5. Proceso de pago (Checkout)');
paragraph('Al confirmar el pedido, el cliente:');
bullet('Revisa los productos del carrito y el total.');
bullet('Elige o agrega una dirección de entrega (puede tener varias guardadas).');
bullet('Elige el método de pago configurado por el restaurante (efectivo, transferencia, Nequi, Daviplata, etc.).');
bullet('Si el método requiere comprobante, sube la foto del comprobante antes de enviar el pedido.');
bullet('Recibe un número de pedido y una pantalla de confirmación.');

subTitle('3.6. Seguimiento del pedido');
paragraph('El cliente puede ver el estado actual de su pedido en cualquier momento desde “Mis pedidos”:');
bullet('Pendiente: el restaurante aún no ha confirmado.');
bullet('Preparando: el restaurante está preparando el pedido.');
bullet('Listo: el pedido está listo para entregar o recoger.');
bullet('Entregado: el pedido fue entregado al cliente.');
bullet('Cancelado: el pedido fue cancelado (con el motivo).');

subTitle('3.7. Notificaciones');
paragraph('El cliente recibe notificaciones en tiempo real dentro de la plataforma cada vez que:');
bullet('Su pedido cambia de estado.');
bullet('Su comprobante de pago es aprobado o rechazado.');
bullet('Llega un nuevo cupón o promoción de un restaurante favorito.');
bullet('El restaurante responde a su calificación.');

subTitle('3.8. Calificaciones y comentarios');
paragraph('Cuando el pedido se entrega, el cliente puede calificar el restaurante de 1 a 5 estrellas y dejar un comentario. Esa calificación se suma al promedio del restaurante, que es visible para todos los usuarios.');

subTitle('3.9. Favoritos');
paragraph('El cliente puede marcar restaurantes como favoritos. Los favoritos aparecen destacados y el cliente puede filtrar la página principal para ver solo sus favoritos.');

subTitle('3.10. Perfil y direcciones');
paragraph('Desde su perfil, el cliente puede:');
bullet('Actualizar su nombre, teléfono y otros datos personales.');
bullet('Cambiar su contraseña.');
bullet('Gestionar varias direcciones de entrega (casa, oficina, etc.) con sus respectivas referencias.');
bullet('Ver el historial completo de pedidos realizados.');
bullet('Ver y descargar los comprobantes de pago de pedidos anteriores.');

doc.addPage();

// ============================================================
// 4. EXPERIENCIA DEL RESTAURANTE
// ============================================================
sectionTitle('4', 'Experiencia del Restaurante (todo lo que puede hacer)');

subTitle('4.1. Registro del restaurante');
paragraph('El dueño del restaurante se registra con los datos del local: nombre, descripción, dirección, teléfono, ciudad, horario de apertura y cierre, foto principal y banner. Toda la información puede ser editada después desde el panel del restaurante.');

calloutBox('Aprobación del administrador', 'Por seguridad y calidad, todos los restaurantes nuevos deben ser aprobados por un administrador de GigantYA antes de aparecer visibles al público. Mientras tanto, el restaurante puede ir configurando su menú, sus categorías y sus métodos de pago.');

subTitle('4.2. Panel principal del restaurante');
paragraph('Es la pantalla de control del negocio. Muestra:');
bullet('Resumen de pedidos del día y de la semana.');
bullet('Total de ventas del día.');
bullet('Pedidos pendientes de confirmar.');
bullet('Pedidos actualmente en preparación.');
bullet('Notificaciones recientes.');

subTitle('4.3. Gestión del menú');
paragraph('El restaurante puede:');
bullet('Crear, editar y eliminar categorías (Entradas, Platos fuertes, Bebidas, Postres, etc.).');
bullet('Crear, editar y eliminar productos con su nombre, descripción, precio, foto y disponibilidad.');
bullet('Marcar productos como “no disponibles” temporalmente sin eliminarlos.');
bullet('Reordenar las categorías y productos para que se vean en el orden deseado.');

subTitle('4.4. Gestión de pedidos');
paragraph('El restaurante recibe los pedidos en tiempo real. Para cada pedido puede:');
bullet('Ver el detalle completo: productos, cantidades, subtotal, total, dirección de entrega y teléfono del cliente.');
bullet('Confirmar o rechazar el pedido.');
bullet('Cambiar el estado a “Preparando”, “Listo” o “Entregado”.');
bullet('Ver el comprobante de pago subido por el cliente y validarlo (aprobar o rechazar).');
bullet('Escribir el motivo de rechazo de un pago o de un pedido.');
bullet('Ver el historial completo de pedidos filtrando por fecha, estado o cliente.');

subTitle('4.5. Métodos de pago');
paragraph('Cada restaurante configura sus propios métodos de pago. Puede elegir entre:');
bullet('Efectivo contra entrega.');
bullet('Transferencia bancaria.');
bullet('Nequi, Daviplata u otros pagos por aplicativo.');
bullet('Cualquier otro método personalizado, agregando los datos necesarios (número de cuenta, titular, etc.).');

subTitle('4.6. Configuración de impuestos y envíos');
paragraph('El restaurante puede definir:');
bullet('Si cobra o no impuestos (IVA u otros) y el porcentaje.');
bullet('Si cobra envío y bajo qué reglas: monto fijo, envío gratis sobre cierto valor, o tarifas por zona.');
bullet('El tiempo estimado de preparación del pedido, que se muestra al cliente.');

subTitle('4.7. Cupones y descuentos');
paragraph('El restaurante puede crear cupones para sus clientes, definiendo:');
bullet('Un código único (por ejemplo, BIENVENIDO20).');
bullet('El tipo de descuento: porcentaje (20%) o monto fijo ($5.000).');
bullet('La fecha de expiración.');
bullet('Una compra mínima (opcional).');
bullet('El número máximo de usos.');
bullet('Activar o desactivar el cupón en cualquier momento.');

subTitle('4.8. Calificaciones recibidas');
paragraph('El restaurante puede ver todas las calificaciones y comentarios que han dejado sus clientes, junto con el pedido asociado. Esto le permite conocer la opinión de los clientes y mejorar su servicio.');

subTitle('4.9. Notificaciones');
paragraph('El restaurante recibe notificaciones instantáneas cada vez que:');
bullet('Llega un nuevo pedido.');
bullet('Un cliente sube un comprobante de pago.');
bullet('Un pedido es cancelado por el cliente.');
bullet('Recibe una nueva calificación.');

doc.addPage();

// ============================================================
// 5. EXPERIENCIA DEL ADMINISTRADOR
// ============================================================
sectionTitle('5', 'Experiencia del Administrador (todo lo que puede hacer)');

subTitle('5.1. Aprobación de restaurantes');
paragraph('El administrador revisa cada nuevo registro de restaurante. Puede:');
bullet('Ver la información completa del local.');
bullet('Aprobarlo para que sea visible al público.');
bullet('Rechazarlo, indicando el motivo, para que el dueño pueda corregirlo.');

subTitle('5.2. Gestión de usuarios');
paragraph('El administrador puede:');
bullet('Ver la lista completa de clientes, restaurantes y otros administradores.');
bullet('Activar, suspender o desactivar cuentas.');
bullet('Editar los datos básicos de un usuario si es necesario.');
bullet('Cambiar el rol de un usuario (por ejemplo, ascender un cliente a administrador).');

subTitle('5.3. Gestión de zonas y ciudades');
paragraph('El sistema maneja zonas geográficas (barrios, veredas, sectores) que el administrador puede crear, editar y asignar a restaurantes. Esto permite calcular envíos por zona y orientar las búsquedas de los clientes.');

subTitle('5.4. Supervisión de pedidos');
paragraph('El administrador puede ver todos los pedidos de la plataforma, filtrar por estado, por restaurante, por cliente o por fecha. En caso de disputa, puede intervenir para cancelar pedidos, cambiar estados o mediar entre cliente y restaurante.');

subTitle('5.5. Supervisión de pagos');
paragraph('El administrador puede ver todos los comprobantes de pago, su estado (pendiente, aprobado, rechazado) y los motivos de rechazo. Esto le da control financiero sobre la plataforma.');

subTitle('5.6. Reportes y exportaciones');
paragraph('El administrador puede generar reportes de:');
bullet('Ventas por restaurante, por día, por semana o por mes.');
bullet('Pedidos cancelados y sus motivos.');
bullet('Usuarios nuevos registrados.');
bullet('Cupones más usados.');
bullet('Los reportes se pueden exportar a Excel o CSV para enviarlos al equipo administrativo.');

subTitle('5.7. Configuración general');
paragraph('El administrador puede ajustar parámetros globales de la plataforma, como mensajes predeterminados, tiempos máximos de pedido, requisitos de aprobación y demás opciones que aplican a todos los usuarios.');

doc.addPage();

// ============================================================
// 6. CARACTERÍSTICAS DESTACADAS (venta)
// ============================================================
sectionTitle('6', 'Características destacadas (argumentos de venta)');

paragraph('Estos son los puntos fuertes que el equipo de ventas puede resaltar al presentar GigantYA a potenciales restaurantes aliados o a clientes finales:');

bullet('🟠  Diseño moderno, rápido y pensado para celulares — la plataforma se adapta a cualquier dispositivo y carga velozmente.');
bullet('🟠  Pedidos en tiempo real — el restaurante ve cada pedido al instante, sin llamadas ni confusiones.');
bullet('🟠  Catálogo propio para cada restaurante — menús con fotos, descripciones, precios, disponibilidad y categorías.');
bullet('🟠  Múltiples métodos de pago — el restaurante configura los suyos: efectivo, transferencia, Nequi, Daviplata, etc.');
bullet('🟠  Cupones y descuentos personalizados — el restaurante puede crear promociones a la medida.');
bullet('🟠  Calificaciones y comentarios — el restaurante recibe retroalimentación real de sus clientes.');
bullet('🟠  Configuración flexible de impuestos y envíos — el restaurante decide cómo cobrar.');
bullet('🟠  Notificaciones automáticas — el cliente y el restaurante siempre saben en qué estado va el pedido.');
bullet('🟠  Favoritos — el cliente puede guardar sus restaurantes preferidos y la plataforma se los muestra primero.');
bullet('🟠  Búsquedas recientes — volver a pedir lo de la semana pasada es cuestión de un toque.');
bullet('🟠  Soporte para múltiples direcciones de entrega — el cliente puede tener casa, oficina y la finca de la abuela, todas guardadas.');
bullet('🟠  Aprobación de restaurantes — control de calidad: en GigantYA solo aparecen restaurantes verificados.');
bullet('🟠  Reportes y exportaciones para el equipo administrativo — toda la operación medida y exportable.');
bullet('🟠  Pensada para Giganta, Huila — la plataforma se enfoca en un mercado local con identidad propia.');

doc.addPage();

// ============================================================
// 7. CASOS DE USO HABITUALES
// ============================================================
sectionTitle('7', 'Casos de uso habituales');

subTitle('7.1. Familia que quiere pedir almuerzo el domingo');
paragraph('Una familia de Giganta abre GigantYA en el celular, busca “almuerzo”, ve los restaurantes disponibles, elige el de su preferencia, agrega al carrito dos platos fuertes, dos bebidas y un postre, aplica un cupón, paga por transferencia, sube el comprobante y en 40 minutos recibe su pedido en casa.');

subTitle('7.2. Cliente nuevo que no conoce los restaurantes');
paragraph('Un visitante nuevo en el pueblo abre la plataforma, ve el listado de restaurantes con calificaciones y reseñas, revisa el más recomendado, ve su menú con fotos, y hace su primer pedido en menos de 5 minutos.');

subTitle('7.3. Restaurante pequeño que quiere vender más');
paragraph('El dueño de un restaurante local se registra, carga su menú con fotos, configura su número de Nequi como método de pago, publica un cupón de “BIENVENIDO10” para nuevos clientes y empieza a recibir pedidos a través de la plataforma sin tener que invertir en publicidad.');

subTitle('7.4. Restaurante que ya tiene clientela y quiere organizarse');
paragraph('Un restaurante con clientela propia se suma a GigantYA para digitalizar los pedidos por WhatsApp. En lugar de tomar pedidos por chat, los recibe directamente en su panel, con el detalle, el pago y la dirección del cliente ya organizados.');

subTitle('7.5. Administrador revisando la operación del día');
paragraph('Cada mañana, el administrador de GigantYA revisa los pedidos del día anterior, los comprobantes pendientes de validar, los restaurantes por aprobar y los reportes de ventas, y exporta el reporte semanal para la gerencia.');

doc.addPage();

// ============================================================
// 8. TIPOS DE USUARIO Y SUS BENEFICIOS
// ============================================================
sectionTitle('8', 'Tipos de usuario y sus beneficios');

subTitle('8.1. Para el cliente');
bullet('Comida de los mejores restaurantes de Giganta, en un solo lugar.');
bullet('Pedidos sin llamadas, sin enredos, con confirmación inmediata.');
bullet('Pago flexible, según el método que ofrezca cada restaurante.');
bullet('Cupones de descuento exclusivos en cada restaurante.');
bullet('Historial completo de sus pedidos y descargas de comprobantes.');
bullet('Calificaciones y reseñas que le ayudan a elegir.');

subTitle('8.2. Para el restaurante');
bullet('Canal de ventas adicional, sin necesidad de pagar publicidad.');
bullet('Pedidos organizados: el detalle, el pago y la dirección del cliente llegan listos.');
bullet('Herramientas de fidelización: cupones, favoritos, calificaciones.');
bullet('Configuración a la medida: métodos de pago, impuestos y envíos propios.');
bullet('Visibilidad: aparece en la página principal para todos los clientes de la plataforma.');
bullet('Reportes de ventas integrados.');

subTitle('8.3. Para GigantYA (administración)');
bullet('Supervisión centralizada de toda la operación.');
bullet('Control de calidad: solo restaurantes aprobados salen al público.');
bullet('Reportes y exportaciones para tomar decisiones informadas.');
bullet('Gestión de usuarios, zonas y configuración general.');

doc.addPage();

// ============================================================
// 9. PREGUNTAS FRECUENTES
// ============================================================
sectionTitle('9', 'Preguntas frecuentes (para el equipo de ventas)');

paragraph('A continuación, una lista de preguntas que los clientes y los restaurantes suelen hacer, con la respuesta lista para usar en la conversación comercial.');

subTitle('¿Cuánto cuesta usar GigantYA para el cliente?');
paragraph('Registrarse y navegar por la plataforma es totalmente gratis. El cliente solo paga el valor de los productos que pide, el envío (si aplica) y los impuestos configurados por cada restaurante.');

subTitle('¿Cuánto cuesta usar GigantYA para el restaurante?');
paragraph('Esta información la maneja directamente el equipo comercial según el plan acordado. Lo que se puede decir con certeza es que la plataforma le da al restaurante visibilidad, herramientas y un canal de ventas adicional.');

subTitle('¿Cómo se cobra el envío?');
paragraph('El envío lo configura cada restaurante de forma independiente. Puede ser gratis, tener un costo fijo o variar según la zona. El cliente siempre ve el costo total antes de confirmar el pedido.');

subTitle('¿Cómo sé que mi pedido fue recibido por el restaurante?');
paragraph('Apenas el cliente confirma el pedido, recibe un número de pedido y un mensaje de confirmación. El restaurante también recibe una notificación en tiempo real y debe confirmar el pedido para que cambie de estado.');

subTitle('¿Qué pasa si el restaurante no acepta mi pedido?');
paragraph('Si el restaurante rechaza el pedido, el cliente es notificado con el motivo y, si ya hizo un pago, el equipo de GigantYA se encarga de hacer la devolución según el método de pago usado.');

subTitle('¿Puedo pedir a varios restaurantes al mismo tiempo?');
paragraph('No. Cada pedido se hace a un solo restaurante. Si el cliente quiere productos de varios restaurantes, debe hacer pedidos separados, uno por cada local.');

subTitle('¿Puedo recoger mi pedido en el local?');
paragraph('Sí. En la dirección de entrega el cliente puede elegir “Recoger en el local” y pasar a recogerlo cuando el restaurante marque el pedido como “Listo”.');

subTitle('¿Cómo funciona la calificación?');
paragraph('Una vez el pedido se entrega, al cliente le aparece la opción de calificar el restaurante de 1 a 5 estrellas y dejar un comentario. Esa calificación se promedia con las demás y se muestra en la ficha del restaurante.');

subTitle('¿Necesito tarjeta de crédito?');
paragraph('No es obligatorio. Cada restaurante configura sus propios métodos de pago. Puede ser efectivo contra entrega, transferencia, Nequi, Daviplata u otro. El cliente ve las opciones disponibles antes de confirmar.');

subTitle('¿En qué zonas opera GigantYA por ahora?');
paragraph('La plataforma está pensada principalmente para Giganta, Huila, y zonas cercanas configuradas por el administrador. Los clientes pueden filtrar por ciudad para ver solo los restaurantes disponibles en su zona.');

doc.addPage();

// ============================================================
// 10. RESUMEN PARA LA PRESENTACIÓN COMERCIAL
// ============================================================
sectionTitle('10', 'Resumen para la presentación comercial');

paragraph('Si el equipo de ventas tiene pocos minutos para presentar la plataforma, este es el discurso de elevador:');

calloutBox('Discurso sugerido (30 segundos)',
  'GigantYA es la plataforma que conecta a los habitantes de Giganta, Huila, con los restaurantes locales. El cliente entra desde el celular o el computador, elige el restaurante, arma su pedido, paga con el método que prefiera y lo recibe en su casa. El restaurante, por su parte, recibe los pedidos organizados, valida los pagos y maneja su propio menú, sus cupones y sus tarifas de envío. Todo en tiempo real, con notificaciones automáticas, calificaciones y reportes. Es, en esencia, una vitrina digital y un sistema de pedidos en línea diseñado para los restaurantes del pueblo.');

subTitle('Planes y precios para el restaurante aliado');

paragraph('GigantYA ofrece tres planes para que cada restaurante elija el que mejor se ajusta a su tamaño y a sus necesidades:');

bullet('🥉 Básico — $70.000 / mes. Ideal para restaurantes que están empezando en el mundo digital. Incluye perfil del restaurante, menú con hasta 30 productos, 1 categoría, pedidos ilimitados y soporte por correo.');

bullet('🥈 Profesional ⭐ — $120.000 / mes. Es el plan más vendido. Incluye todo lo del Básico más menú ilimitado, categorías ilimitadas, cupones de descuento, configuración de impuestos y envíos, soporte por WhatsApp y banner destacado en la página principal.');

bullet('🥇 Premium — $200.000 / mes. Máximo alcance y soporte dedicado. Incluye todo lo del Profesional más reportes avanzados de ventas, exportación a Excel, capacitación personalizada, gestor de cuenta dedicado y posición prioritaria en búsquedas.');

calloutBox('Para el equipo de ventas', 'El plan Profesional es el más vendido porque ofrece el equilibrio perfecto entre precio y herramientas. Al cerrar una venta, siempre recomienda este plan como punto de partida.');

subTitle('Beneficios clave para el restaurante aliado');
bullet('Más ventas: nuevos clientes descubren su local por la plataforma.');
bullet('Menos trabajo administrativo: pedidos y pagos llegan organizados.');
bullet('Imagen profesional: menú digital con fotos, categorías y reseñas.');
bullet('Fidelización: cupones, favoritos y calificaciones.');
bullet('Control: el restaurante define su menú, sus precios, sus horarios y sus reglas de envío.');

subTitle('Beneficios clave para el cliente final');
bullet('Comida local, rápida y sin llamadas.');
bullet('Pago flexible, según el método del restaurante.');
bullet('Cupones y descuentos exclusivos.');
bullet('Calificaciones reales de otros comensales.');
bullet('Historial de pedidos, favoritos y direcciones guardadas.');

doc.addPage();

// ============================================================
// 11. CIERRE
// ============================================================
sectionTitle('11', 'Cierre');

paragraph('Este documento es la guía oficial de referencia para que el equipo de ventas de GigantYA conozca, en su totalidad, las funciones de la plataforma web.');

paragraph('Cualquier actualización importante de la plataforma —nuevas funciones, cambios de políticas o ajustes de precio— debe venir acompañada de una nueva versión de esta guía, de modo que el equipo de ventas siempre tenga a la mano la información más reciente.');

calloutBox('Soporte interno', 'Si durante una venta o atención al cliente surge una duda técnica que no esté cubierta en este documento, el equipo de ventas debe escalar el caso al equipo de tecnología de GigantYA a través de los canales internos definidos por la empresa.');

doc.moveDown(2);
doc.fontSize(10).fillColor(COLOR_GRAY).font('Helvetica-Oblique')
  .text('© 2026 GigantYA — Giganta, Huila, Colombia. Todos los derechos reservados.', { align: 'center' });

doc.end();

doc.on('end', () => {
  // El evento 'end' se dispara al cerrar el stream; el archivo ya se escribió.
});
