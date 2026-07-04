-- ====================================================
-- Base de Datos: Sistema de Pedidos para Restaurantes
-- Localizacion: Giganta, Huila, Colombia
-- ====================================================

CREATE DATABASE IF NOT EXISTS restaurante_pedidos_gigantya;
USE restaurante_pedidos_gigantya;

-- ====================================================
-- Tabla: USUARIOS
-- ====================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  contrasena_hash VARCHAR(255) NOT NULL,
  tipo_usuario ENUM('cliente', 'restaurante', 'admin') NOT NULL,
  documento_identidad VARCHAR(50),
  otros_datos JSON,
  estado ENUM('activo', 'inactivo', 'suspendido') DEFAULT 'activo',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_tipo_usuario (tipo_usuario),
  INDEX idx_estado (estado),
  INDEX idx_creado_en (creado_en)
);

-- ====================================================
-- Tabla: RESTAURANTES
-- ====================================================
CREATE TABLE IF NOT EXISTS restaurantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  direccion VARCHAR(255),
  telefono VARCHAR(20),
  ciudad VARCHAR(100) DEFAULT 'Giganta, Huila',
  horario_apertura TIME,
  horario_cierre TIME,
  imagen_url VARCHAR(255),
  estado ENUM('activo', 'inactivo', 'rechazado') DEFAULT 'activo',
  aprobado BOOLEAN DEFAULT 0,
  calificacion DECIMAL(3, 2) DEFAULT 5.00,
  configuracion_pagos JSON,
  custom_config JSON,
  -- Configuración de impuestos y envíos
  configuracion_impuestos JSON DEFAULT NULL,
  configuracion_envios JSON DEFAULT NULL,
  -- Flags de nicho del local. Se controlan desde el dashboard admin
  -- y se usan para segmentar el feed del cliente.
  -- Migración: 20260629000002 (mercado) → 20260701000001 (comida rápida)
  --          → 20260702000001 (es_restaurante) → 20260703000001 (panadería/pastelería).
  -- Combinables entre sí excepto `es_mercado_abarrotes` (nicho único).
  es_mercado_abarrotes TINYINT(1) NOT NULL DEFAULT 0,
  es_comida_rapida TINYINT(1) NOT NULL DEFAULT 0,
  es_restaurante TINYINT(1) NOT NULL DEFAULT 1,
  es_panaderia_pasteleria TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_aprobado (aprobado),
  INDEX idx_estado (estado),
  INDEX idx_ciudad (ciudad)
);

-- ====================================================
-- Tabla: CATEGORIAS
-- ====================================================
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurante_id INT,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  orden INT DEFAULT 0,
  -- Namespace de la categoría. Define para qué nicho aplica la categoría.
  -- Migraciones: 20260630000002 (enum inicial) → 20260701000001
  -- (comida_rapida) → 20260703000001 (panaderia_pasteleria).
  tipo_negocio ENUM('restaurante', 'mercado', 'comida_rapida', 'panaderia_pasteleria') NOT NULL DEFAULT 'restaurante',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
  UNIQUE KEY uk_restaurante_categoria (restaurante_id, nombre),
  INDEX idx_restaurante_id (restaurante_id)
);

-- ====================================================
-- Tabla: PRODUCTOS
-- ====================================================
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurante_id INT NOT NULL,
  categoria_id INT,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10, 2) NOT NULL,
  imagen_url VARCHAR(255),
  disponible BOOLEAN DEFAULT 1,
  estado ENUM('activo', 'eliminado') DEFAULT 'activo',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  INDEX idx_restaurante_id (restaurante_id),
  INDEX idx_categoria_id (categoria_id),
  INDEX idx_disponible (disponible),
  INDEX idx_estado (estado),
  FULLTEXT INDEX ft_nombre_descripcion (nombre, descripcion)
);

-- ====================================================
-- Tabla: PEDIDOS
-- ====================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  restaurante_id INT NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  estado ENUM('Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado') DEFAULT 'Pendiente',
  metodo_pago VARCHAR(50),
  estado_validacion_pago ENUM('pendiente', 'aprobado', 'rechazado') DEFAULT 'pendiente',
  cupon_id INT,
  notas TEXT,
  direccion_entrega VARCHAR(255),
  telefono_contacto VARCHAR(20),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE RESTRICT,
  FOREIGN KEY (cupon_id) REFERENCES cupones(id) ON DELETE SET NULL,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_restaurante_id (restaurante_id),
  INDEX idx_estado (estado),
  INDEX idx_creado_en (creado_en),
  INDEX idx_actualizado_en (actualizado_en)
);

-- ====================================================
-- Tabla: ITEMS DEL PEDIDO
-- ====================================================
CREATE TABLE IF NOT EXISTS items_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
  INDEX idx_pedido_id (pedido_id),
  INDEX idx_producto_id (producto_id)
);

-- ====================================================
-- Tabla: COMPROBANTES DE PAGO
-- ====================================================
CREATE TABLE IF NOT EXISTS comprobantes_pago (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  url_imagen VARCHAR(255) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado_validacion ENUM('pendiente', 'aprobado', 'rechazado') DEFAULT 'pendiente',
  validado_por INT,
  fecha_validacion TIMESTAMP,
  motivo_rechazo TEXT,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_pedido_id (pedido_id),
  INDEX idx_estado_validacion (estado_validacion)
);

-- ====================================================
-- Tabla: CUPONES
-- ====================================================
CREATE TABLE IF NOT EXISTS cupones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- restaurante_id es NULL para cupones globales (es_global = 1).
  -- La FK a restaurantes(id) se eliminó en la migración Knex
  -- 20260701000005_add_es_global_to_cupones; al borrar un local
  -- hay que limpiar manualmente los cupones en Restaurant.deleteRestaurant.
  restaurante_id INT NULL,
  codigo VARCHAR(50) NOT NULL,
  descuento DECIMAL(10, 2) NOT NULL,
  tipo_descuento ENUM('porcentaje', 'monto') NOT NULL,
  fecha_expiracion DATE,
  min_compra DECIMAL(10, 2),
  max_compra DECIMAL(10, 2),
  usos_maximos INT,
  usos_actuales INT DEFAULT 0,
  activo BOOLEAN DEFAULT 1,
  es_global TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- El UNIQUE(restaurante_id, codigo) lo define la migración Knex
  -- 20260609000001_subscriptions_and_plans (no se replica acá porque
  -- MySQL permite múltiples NULLs en UNIQUE y eso es justo lo que
  -- queremos: N locales + 1 global pueden compartir el mismo código).
  INDEX idx_restaurante_id (restaurante_id),
  INDEX idx_codigo (codigo),
  INDEX idx_es_global (es_global)
);

-- ====================================================
-- Tabla: CALIFICACIONES
-- ====================================================
CREATE TABLE IF NOT EXISTS calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL UNIQUE,
  usuario_id INT NOT NULL,
  restaurante_id INT NOT NULL,
  calificacion INT NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
  comentario TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_restaurante_id (restaurante_id)
);

-- ====================================================
-- Tabla: NOTIFICACIONES
-- ====================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(50),
  titulo VARCHAR(200),
  mensaje TEXT,
  leida BOOLEAN DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_leida (leida),
  INDEX idx_creado_en (creado_en)
);

-- ====================================================
-- Tabla: HISTORIAL_PEDIDOS
-- ====================================================
CREATE TABLE IF NOT EXISTS historial_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  estado_anterior VARCHAR(50),
  estado_nuevo VARCHAR(50) NOT NULL,
  cambiado_por INT,
  cambio_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (cambiado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_pedido_id (pedido_id),
  INDEX idx_cambio_en (cambio_en)
);

-- ====================================================
-- Tabla: PASSWORD_RESET_TOKENS
-- ====================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  token VARCHAR(255) NOT NULL,
  expira_en TIMESTAMP NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expira_en (expira_en)
);

-- ====================================================
-- Vistas Utiles
-- ====================================================

CREATE OR REPLACE VIEW vw_restaurantes_resumen AS
SELECT
  r.id,
  r.nombre,
  r.ciudad,
  r.estado,
  r.aprobado,
  COUNT(DISTINCT p.id) as total_productos,
  COUNT(DISTINCT pd.id) as total_pedidos,
  COALESCE(AVG(c.calificacion), 0) as calificacion_promedio,
  r.creado_en
FROM restaurantes r
LEFT JOIN productos p ON r.id = p.restaurante_id AND p.estado = 'activo'
LEFT JOIN pedidos pd ON r.id = pd.restaurante_id
LEFT JOIN calificaciones c ON pd.id = c.pedido_id
WHERE r.estado = 'activo'
GROUP BY r.id;

CREATE OR REPLACE VIEW vw_estadisticas_general AS
SELECT
  (SELECT COUNT(*) FROM usuarios WHERE estado = 'activo') as usuarios_activos,
  (SELECT COUNT(*) FROM restaurantes WHERE aprobado = 1 AND estado = 'activo') as restaurantes_aprobados,
  (SELECT COUNT(*) FROM pedidos) as total_pedidos,
  (SELECT SUM(total) FROM pedidos WHERE estado = 'Entregado') as ingresos_totales,
  (SELECT AVG(total) FROM pedidos) as promedio_pedido;

-- ====================================================
-- Fin del Script
-- ====================================================
