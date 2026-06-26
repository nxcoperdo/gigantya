 import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function createTestCredentials() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'gigantya_user',
    password: 'gigantya123456',
    database: 'restaurante_pedidos_gigantya'
  });

  try {
    // Hash de contraseñas
    const passwordCliente = await bcrypt.hash('cliente123', 10);
    const passwordRestaurante = await bcrypt.hash('restaurante123', 10);
    const passwordAdmin = await bcrypt.hash('admin123', 10);

    console.log('🔐 Hasheando contraseñas...');
    console.log('Hash cliente:', passwordCliente);
    console.log('Hash restaurante:', passwordRestaurante);
    console.log('Hash admin:', passwordAdmin);

    // 1. Crear usuario cliente de prueba
    await connection.execute(
      'INSERT INTO usuarios (nombre, email, telefono, contrasena_hash, tipo_usuario, documento_identidad, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Juan Perez', 'cliente@test.com', '3001234567', passwordCliente, 'cliente', '12345678', 'activo']
    );
    console.log('✅ Usuario cliente creado: cliente@test.com / cliente123');

    // 2. Crear usuario restaurante de prueba
    const [restauranteUser] = await connection.execute(
      'INSERT INTO usuarios (nombre, email, telefono, contrasena_hash, tipo_usuario, documento_identidad, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Restaurante El Sabor', 'restaurante@test.com', '3009876543', passwordRestaurante, 'restaurante', '87654321', 'activo']
    );
    const restauranteUserId = restauranteUser.insertId;
    console.log('✅ Usuario restaurante creado: restaurante@test.com / restaurante123');

    // 3. Crear perfil de restaurante
    await connection.execute(
      'INSERT INTO restaurantes (usuario_id, nombre, descripcion, direccion, telefono, ciudad, horario_apertura, horario_cierre, estado, aprobado, calificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        restauranteUserId,
        'El Sabor Giganteno',
        'Deliciosa comida tradicional de Gigante con los mejores ingredientes locales',
        'Calle Principal 123, Gigante',
        '3009876543',
        'Gigante, Huila',
        '10:00:00',
        '22:00:00',
        'activo',
        1,
        4.8
      ]
    );
    console.log('✅ Restaurante creado: El Sabor Giganteno');

    // 4. Crear categorías
    const [categoryResult] = await connection.execute(
      'INSERT INTO categorias (restaurante_id, nombre, descripcion, orden) VALUES (?, ?, ?, ?)',
      [1, 'Comidas Principales', 'Platos principal típicos de la región', 1]
    );
    const category1 = categoryResult.insertId;

    await connection.execute(
      'INSERT INTO categorias (restaurante_id, nombre, descripcion, orden) VALUES (?, ?, ?, ?)',
      [1, 'Bebidas', 'Bebidas frías y calientes variadas', 2]
    );

    await connection.execute(
      'INSERT INTO categorias (restaurante_id, nombre, descripcion, orden) VALUES (?, ?, ?, ?)',
      [1, 'Postres', 'Postres y dulces artesanales', 3]
    );
    console.log('✅ Categorías creadas');

    // 5. Crear productos de prueba
    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        category1,
        'Ajiaco Tolimense',
        'Sopa tradicional con papas, pollo y maiz tierno. Delicioso y reconfortante',
        25000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        category1,
        'Bandeja Paisa Adaptada',
        'Huevos, queso, arepa, carme y frijoles. La mejor combinación',
        28000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        category1,
        'Lechona',
        'Cerdo relleno de arroz, papas y especias. Una delicia sin igual',
        35000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        2,
        'Jugo de Lulo',
        'Jugo natural de lulo fresco, refrescante y nutritivo',
        6000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        2,
        'Limonada Casera',
        'Limonada hecha con jugo natural de limón y agua fresca',
        5000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        3,
        'Conserva de Guayaba',
        'Dulce casero hecho con guayabas frescas del Valle',
        8000,
        1,
        'activo'
      ]
    );

    await connection.execute(
      'INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, disponible, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        3,
        'Flan Casero',
        'Flan casero con caramelo tostado. Suave y delicioso',
        7000,
        1,
        'activo'
      ]
    );

    console.log('✅ Productos creados (8 total)');

    // 3. Crear usuario admin (opcional)
    await connection.execute(
      'INSERT INTO usuarios (nombre, email, telefono, contrasena_hash, tipo_usuario, documento_identidad, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Admin Sistema', 'admin@test.com', '3000000000', passwordAdmin, 'admin', '00000000', 'activo']
    );
    console.log('✅ Usuario admin creado: admin@test.com / admin123');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ¡CREDENCIALES DE PRUEBA CREADAS EXITOSAMENTE!');
    console.log('='.repeat(60));
    console.log('\n📱 CLIENTE:');
    console.log('   Email: cliente@test.com');
    console.log('   Contraseña: cliente123');
    console.log('\n🏪 RESTAURANTE:');
    console.log('   Email: restaurante@test.com');
    console.log('   Contraseña: restaurante123');
    console.log('\n👨‍💼 ADMIN:');
    console.log('   Email: admin@test.com');
    console.log('   Contraseña: admin123');
    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error al crear credenciales:', error.message);
  } finally {
    await connection.end();
  }
}

createTestCredentials();

