export async function up(knex) {
    // Usuarios
    await knex.schema.createTable('usuarios', (table) => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('email').unique().notNullable();
        table.string('telefono');
        table.string('contrasena_hash').notNullable();
        table.enum('tipo_usuario', ['cliente', 'restaurante', 'admin']).notNullable();
        table.string('documento_identidad');
        table.json('otros_datos');
        table.enum('estado', ['activo', 'inactivo', 'suspendido']).defaultTo('activo');

        // Cambiado para forzar los nombres en español idénticos a tu BD real:
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.timestamp('actualizado_en').defaultTo(knex.fn.now());

        table.index('email');
        table.index('tipo_usuario');
        table.index('estado');
    });

    // Restaurantes
    await knex.schema.createTable('restaurantes', (table) => {
        table.increments('id').primary();
        table.integer('usuario_id').unsigned().notNullable().unique().references('id').inTable('usuarios').onDelete('CASCADE');
        table.string('nombre', 150).notNullable();
        table.text('descripcion');
        table.string('direccion', 255);
        table.string('telefono', 20);
        table.string('ciudad', 100).defaultTo('GigantYA, Huila');
        table.time('horario_apertura');
        table.time('horario_cierre');
        table.string('imagen_url', 255);
        table.enum('estado', ['activo', 'inactivo', 'rechazado']).defaultTo('activo');
        table.boolean('aprobado').defaultTo(false);
        table.decimal('calificacion', 3, 2).defaultTo(5.00);

        // Cambiado para consistencia en español
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.timestamp('actualizado_en').defaultTo(knex.fn.now());

        table.index('usuario_id');
        table.index('aprobado');
        table.index('estado');
    });

    // Categorias
    await knex.schema.createTable('categorias', (table) => {
        table.increments('id').primary();
        table.integer('restaurante_id').unsigned().notNullable().references('id').inTable('restaurantes').onDelete('CASCADE');
        table.string('nombre', 100).notNullable();
        table.text('descripcion');
        table.integer('orden').defaultTo(0);
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.unique(['restaurante_id', 'nombre']);
        table.index('restaurante_id');
    });

    // Productos
    await knex.schema.createTable('productos', (table) => {
        table.increments('id').primary();
        table.integer('restaurante_id').unsigned().notNullable().references('id').inTable('restaurantes').onDelete('CASCADE');
        table.integer('categoria_id').unsigned().references('id').inTable('categorias').onDelete('SET NULL');
        table.string('nombre', 150).notNullable();
        table.text('descripcion');
        table.decimal('precio', 10, 2).notNullable();
        table.string('imagen_url', 255);
        table.boolean('disponible').defaultTo(true);
        table.enum('estado', ['activo', 'eliminado']).defaultTo('activo');

        // Cambiado para consistencia en español
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.timestamp('actualizado_en').defaultTo(knex.fn.now());

        table.index('restaurante_id');
        table.index('categoria_id');
        table.index('disponible');
        table.index('estado');
    });

    // Pedidos
    await knex.schema.createTable('pedidos', (table) => {
        table.increments('id').primary();
        table.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
        table.integer('restaurante_id').unsigned().notNullable().references('id').inTable('restaurantes').onDelete('RESTRICT');
        table.decimal('total', 10, 2).notNullable();
        table.enum('estado', ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado']).defaultTo('Pendiente');
        table.text('notas');
        table.string('direccion_entrega', 255);
        table.string('telefono_contacto', 20);

        // Cambiado para consistencia en español
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.timestamp('actualizado_en').defaultTo(knex.fn.now());

        table.index('usuario_id');
        table.index('restaurante_id');
        table.index('estado');
    });

    // Items Pedido
    await knex.schema.createTable('items_pedido', (table) => {
        table.increments('id').primary();
        table.integer('pedido_id').unsigned().notNullable().references('id').inTable('pedidos').onDelete('CASCADE');
        table.integer('producto_id').unsigned().notNullable().references('id').inTable('productos').onDelete('RESTRICT');
        table.integer('cantidad').notNullable().defaultTo(1);
        table.decimal('precio_unitario', 10, 2).notNullable();
        table.decimal('subtotal', 10, 2).notNullable();
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.index('pedido_id');
        table.index('producto_id');
    });

    // Calificaciones
    await knex.schema.createTable('calificaciones', (table) => {
        table.increments('id').primary();
        table.integer('pedido_id').unsigned().notNullable().unique().references('id').inTable('pedidos').onDelete('CASCADE');
        table.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
        table.integer('restaurante_id').unsigned().notNullable().references('id').inTable('restaurantes').onDelete('CASCADE');
        table.integer('calificacion').notNullable();
        table.text('comentario');
        table.timestamp('creado_en').defaultTo(knex.fn.now());

        table.check('calificacion >= 1 AND calificacion <= 5', [], 'chk_calificaciones_rango');
        table.index('usuario_id');
        table.index('restaurante_id');
    });

    // Notificaciones
    await knex.schema.createTable('notificaciones', (table) => {
        table.increments('id').primary();
        table.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
        table.string('tipo', 50);
        table.string('titulo', 200);
        table.text('mensaje');
        table.boolean('leida').defaultTo(false);
        table.timestamp('creado_en').defaultTo(knex.fn.now());
        table.index('usuario_id');
        table.index('leida');
    });

    // Historial Pedidos
    await knex.schema.createTable('historial_pedidos', (table) => {
        table.increments('id').primary();
        table.integer('pedido_id').unsigned().notNullable().references('id').inTable('pedidos').onDelete('CASCADE');
        table.string('estado_anterior', 50);
        table.string('estado_nuevo', 50).notNullable();
        table.integer('cambiado_por').unsigned().references('id').inTable('usuarios').onDelete('SET NULL');
        table.timestamp('cambio_en').defaultTo(knex.fn.now());
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('historial_pedidos');
    await knex.schema.dropTableIfExists('notificaciones');
    await knex.schema.dropTableIfExists('calificaciones');
    await knex.schema.dropTableIfExists('items_pedido');
    await knex.schema.dropTableIfExists('pedidos');
    await knex.schema.dropTableIfExists('productos');
    await knex.schema.dropTableIfExists('categorias');
    await knex.schema.dropTableIfExists('restaurantes');
    await knex.schema.dropTableIfExists('usuarios');
}
