/**
 * Migración — Tabla `aceptaciones_legales` para el CMS de políticas legales.
 *
 * Almacena el LOG de cada aceptación de TyC / Privacidad / Cookies /
 * Merchant Agreement, conforme a los requisitos de:
 *   - Ley 527/1999 (comercio electrónico) art. 15 (constancia de aceptación)
 *   - Ley 1581/2012 (protección de datos) art. 9 (consentimiento expreso)
 *   - Ley 1480/2011 (Estatuto del Consumidor) art. 50 (trazabilidad PQR)
 *
 * Por cada aceptación guardamos:
 *   - Qué usuario/restaurante aceptó
 *   - Qué tipo de documento (tyc | privacidad | cookies | merchant)
 *   - Qué versión específica (ej. "v1.0-2026-07-10") — clave para
 *     defenderse ante un cambio retroactivo de políticas
 *   - Desde qué IP y user_agent se aceptó
 *   - Cuándo se aceptó
 *
 * Decisiones:
 *   - `tipo` se persiste como VARCHAR(20) en vez de ENUM porque agregar
 *     un nuevo tipo de documento requeriría una migración nueva si
 *     fuera ENUM. La validación contra whitelist vive en el modelo.
 *   - `version` VARCHAR(40) para dar margen a formatos como
 *     "v1.2-2026-07-10-r3" si en el futuro hay revisiones rápidas.
 *   - `usuario_id` y `restaurante_id` son NULL permitidos porque las
 *     aceptaciones públicas (visitantes anónimos en home que abren
 *     `/terminos` y aceptan cookies) NO tienen usuario asociado.
 *   - Índices sobre (usuario_id), (restaurante_id) y (tipo) para que
 *     las consultas de "qué aceptó este usuario" sean O(log n).
 *   - Sin FK a usuarios/restaurantes con ON DELETE CASCADE porque
 *     queremos conservar la auditoría incluso si se borra el usuario
 *     (Ley 1581/2012 art. 26 — responsabilidad demostrada).
 *   - `creado_en` con default NOW() (no ON UPDATE porque es log inmutable).
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable('aceptaciones_legales'))) {
    await knex.schema.createTable('aceptaciones_legales', (table) => {
      table.increments('id').primary();
      // Sujeto que acepta. Pueden ser NULL ambos (visitante anónimo) o
      // uno solo (cliente registrado o dueño de restaurante registrado).
      // ⚠️ usuarios.id es INT SIGNED en este proyecto (mismo gotcha que
      // en home_hero_settings y el resto del schema).
      table.integer('usuario_id').nullable();
      table.integer('restaurante_id').nullable();
      // Tipo de documento. Whitelist en el modelo. No usamos ENUM para
      // permitir agregar tipos sin migración.
      table.string('tipo', 20).notNullable();
      // Versión del documento aceptado, ej. "v1.0-2026-07-10". Clave
      // para auditoría: si un usuario dice "yo nunca acepté la v2.0",
      // consultamos esta columna.
      table.string('version', 40).notNullable();
      // Contexto técnico: IP, user-agent, método de aceptación.
      // IP se guarda como VARCHAR(45) para soportar IPv6 completo.
      table.string('ip', 45).nullable();
      table.text('user_agent').nullable();
      // Cuándo se aceptó. Inmutable, sin ON UPDATE.
      table.timestamp('creado_en').defaultTo(knex.fn.now());

      // Índices para las consultas más comunes.
      table.index(['usuario_id'], 'idx_aceptaciones_usuario');
      table.index(['restaurante_id'], 'idx_aceptaciones_restaurante');
      table.index(['tipo', 'version'], 'idx_aceptaciones_tipo_version');
      table.index(['creado_en'], 'idx_aceptaciones_fecha');
    });
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('aceptaciones_legales')) {
    await knex.schema.dropTable('aceptaciones_legales');
  }
}
