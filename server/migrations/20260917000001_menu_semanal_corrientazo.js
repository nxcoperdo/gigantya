// Menú del día (corrientazo): plantilla semanal rotativa por local.
//
//  - productos.es_menu_dia: marca un producto como "combo del día". Estos NO
//    se muestran en el menú normal del cliente; solo aparecen en la sección
//    "Menú de hoy", resueltos vía la plantilla semanal.
//  - menu_semanal: mapea (restaurante, tipo_comida, día de la semana) → el
//    producto-combo de ese día. Un combo por celda (UNIQUE). La app muestra
//    solo el del día actual (calculado en America/Bogota).
//
// Las franjas horarias (desayuno AM / almuerzo mediodía) NO van acá: viven en
// restaurantes.custom_config.menu_dia_horarios (JSON), sin costo de esquema.
export async function up(knex) {
  await knex.schema.alterTable('productos', (t) => {
    t.boolean('es_menu_dia').notNullable().defaultTo(false).index();
  });

  await knex.schema.createTable('menu_semanal', (t) => {
    t.increments('id').primary();
    // Sin .unsigned(): restaurantes.id y productos.id son `int` signed, y el
    // FK exige que el tipo (incl. signo) coincida (si no, errno 150).
    t.integer('restaurante_id').notNullable()
      .references('id').inTable('restaurantes').onDelete('CASCADE');
    t.enu('tipo_comida', ['desayuno', 'almuerzo']).notNullable();
    t.tinyint('dia_semana').notNullable(); // 1=Lunes ... 7=Domingo (ISO)
    t.integer('producto_id').notNullable()
      .references('id').inTable('productos').onDelete('CASCADE');
    t.boolean('activo').notNullable().defaultTo(true);
    t.timestamp('creado_en').defaultTo(knex.fn.now());
    t.timestamp('actualizado_en').defaultTo(knex.fn.now());
    t.unique(['restaurante_id', 'tipo_comida', 'dia_semana'], { indexName: 'uq_menu_semanal_celda' });
    t.index('restaurante_id');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('menu_semanal');
  await knex.schema.alterTable('productos', (t) => {
    t.dropColumn('es_menu_dia');
  });
}
