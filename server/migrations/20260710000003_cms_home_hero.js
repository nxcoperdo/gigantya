/**
 * Migración Fase 12d — CMS de configuración del Hero de la Home.
 *
 * Crea 2 tablas:
 *   - `home_hero_settings`: 1 fila (id=1) con la config global del hero
 *     (4 toggles de visibilidad + textos editables). Singleton forzado
 *     a nivel de aplicación.
 *   - `home_hero_buttons`: 0..N botones custom que aparecen sobre el
 *     banner (label, url, variant, icono, orden, activo, nueva_pestana).
 *
 * La home pública (`/`) consume `GET /api/home/hero` que une las dos
 * tablas (settings + solo botones activos) en una sola respuesta.
 *
 * Decisiones:
 *   - `home_hero_settings` es singleton (id=1) porque solo hay UN hero
 *     en toda la app. La invariante se garantiza con un INSERT inicial
 *     en esta migración + `upsert` defensivo en el modelo. MySQL no
 *     soporta `UNIQUE WHERE` así que no se puede usar `id=1 CHECK`.
 *   - Los textos del hero se persisten en columnas separadas (no en un
 *     JSON genérico) para que el cliente no tenga que conocer el shape
 *     y para que el admin pueda editarlos campo por campo en la UI.
 *   - Los textos de `home_hero_settings` están partidos en 2 o 3
 *     columnas (pre/post, pre/bold/post) para que el admin pueda
 *     controlar la palabra destacada ("Amas" en blanco, "Gigante" en
 *     bold) sin tener que escribir HTML ni markdown.
 *   - `icono` en `home_hero_buttons` es VARCHAR(40) y se valida contra
 *     una whitelist de 9 nombres de lucide-react (MessageCircle,
 *     MapPin, Store, Phone, ExternalLink, ShoppingBag, Coffee,
 *     ChevronRight, Send). Esto evita que el admin inyecte cualquier
 *     string y mantiene el bundle chico (no se importan todos los
 *     iconos de lucide).
 *   - `variant` es ENUM(3 valores) por la misma razón: previene
 *     inyección y limita el CSS que el cliente tiene que renderizar.
 *   - `orden` es INT no UNSIGNED (consistente con el resto del schema)
 *     y se inicializa con `id` en el INSERT para que el orden natural
 *     de creación sea estable.
 *   - Sin timestamps "creado_en/actualizado_en" en `home_hero_settings`
 *     excepto el `actualizado_en` (para auditoría). Los textos se
 *     editan in-place, no se "crean".
 *   - `actualizado_por` es FK opcional a `usuarios.id` (puede ser NULL
 *     si el sistema siembra la fila antes de que haya admins). ON
 *     DELETE SET NULL para no perder auditoría si se borra un admin.
 *
 * Idempotente: el patrón `hasTable` evita tirar error si la tabla ya
 * existe (útil para re-aplicar la migración tras un deploy fallido).
 */
export async function up(knex) {
  // ========== Tabla `home_hero_settings` (singleton) ==========
  if (!(await knex.schema.hasTable('home_hero_settings'))) {
    await knex.schema.createTable('home_hero_settings', (table) => {
      table.specificType('id', 'TINYINT UNSIGNED').notNullable().primary();
      // Bloque 1 — Título (h1): "Pide lo que <Amas>"
      table.boolean('mostrar_titulo').notNullable().defaultTo(true);
      table.string('titulo_pre', 100).notNullable().defaultTo('Pide lo que');
      table.string('titulo_post', 100).notNullable().defaultTo('Amas');
      // Bloque 2 — Subtítulo (p): "Descubre... de <Gigante> en tu dispositivo"
      table.boolean('mostrar_subtitulo').notNullable().defaultTo(true);
      table.string('subtitulo_pre', 200).notNullable().defaultTo('Descubre los mejores locales de');
      table.string('subtitulo_bold', 50).notNullable().defaultTo('Gigante');
      table.string('subtitulo_post', 200).notNullable().defaultTo('en tu dispositivo');
      // Bloque 3 — Buscador (input)
      table.boolean('mostrar_buscador').notNullable().defaultTo(true);
      table.string('buscador_placeholder', 200).notNullable().defaultTo('Buscar local, producto o categoría...');
      // Bloque 4 — Badge "Más de N locales disponibles"
      table.boolean('mostrar_badge_locales').notNullable().defaultTo(true);
      table.string('badge_locales_pre', 100).notNullable().defaultTo('Más de');
      table.string('badge_locales_sufijo', 50).notNullable().defaultTo('locales disponibles');
      // Auditoría
      table.timestamp('actualizado_en').defaultTo(knex.fn.now());
      table.integer('actualizado_por').unsigned().nullable();
      // FK opcional. ON DELETE SET NULL: si se borra el admin, no se
      // pierde la config (la auditoría queda como "borrado").
      table.foreign('actualizado_por', 'fk_home_hero_settings_user')
        .references('id').inTable('usuarios').onDelete('SET NULL');
    });

    // Siembra la fila singleton con todos los defaults.
    // Mismos strings que el JSX anterior (HomePage.jsx ~línea 602-633)
    // para que un deploy limpio muestre lo mismo que antes de Fase 12d.
    await knex('home_hero_settings').insert({
      id: 1,
    });
  }

  // ========== Tabla `home_hero_buttons` (CRUD libre) ==========
  if (!(await knex.schema.hasTable('home_hero_buttons'))) {
    await knex.schema.createTable('home_hero_buttons', (table) => {
      table.increments('id').primary();
      table.string('label', 80).notNullable();
      table.string('url', 500).notNullable();
      // ENUM coincide con los 3 styles de botón que renderiza el cliente.
      table.enum('variant', ['primary', 'secondary', 'outline'])
        .notNullable().defaultTo('primary');
      // Nombre de icono de lucide-react (validado por whitelist en el
      // controller). NULL permitido (botón sin icono).
      table.string('icono', 40).nullable();
      table.integer('orden').notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.boolean('nueva_pestana').notNullable().defaultTo(true);
      table.timestamp('creado_en').defaultTo(knex.fn.now());
      // MySQL no permite ON UPDATE CURRENT_TIMESTAMP para múltiples
      // columnas TIMESTAMP en algunas versiones; usamos DEFAULT NOW()
      // y manejamos la actualización en el modelo.
      table.timestamp('actualizado_en').defaultTo(knex.fn.now());
      // Índices para el orden y el filtrado de activos.
      table.index(['orden', 'id'], 'idx_home_hero_buttons_orden');
      table.index(['activo'], 'idx_home_hero_buttons_activo');
    });
  }
}

export async function down(knex) {
  // Orden inverso: primero la tabla con FKs (no hay FKs apuntando a
  // home_hero_buttons, pero por las dudas dropeamos primero la hija).
  if (await knex.schema.hasTable('home_hero_buttons')) {
    await knex.schema.dropTable('home_hero_buttons');
  }
  if (await knex.schema.hasTable('home_hero_settings')) {
    await knex.schema.dropTable('home_hero_settings');
  }
}
