ALTER TABLE restaurantes ADD COLUMN configuracion_pagos JSON;
ALTER TABLE pedidos ADD COLUMN metodo_pago VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN estado_validacion_pago ENUM('pendiente', 'aprobado', 'rechazado') DEFAULT 'pendiente';
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
CREATE TABLE IF NOT EXISTS cupones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurante_id INT NOT NULL,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  descuento DECIMAL(10, 2) NOT NULL,
  tipo_descuento ENUM('porcentaje', 'monto') NOT NULL,
  fecha_expiracion DATE,
  min_compra DECIMAL(10, 2),
  usos_maximos INT,
  usos_actuales INT DEFAULT 0,
  activo BOOLEAN DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
  INDEX idx_restaurante_id (restaurante_id),
  INDEX idx_codigo (codigo)
);
