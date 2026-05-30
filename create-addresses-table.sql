CREATE TABLE IF NOT EXISTS direcciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'residencia',
  direccion VARCHAR(255) NOT NULL,
  ciudad VARCHAR(100) DEFAULT 'Giganta, Huila',
  telefono VARCHAR(20),
  notas TEXT,
  es_default BOOLEAN DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_es_default (es_default)
);

INSERT INTO direcciones (usuario_id, tipo, direccion, ciudad, telefono, es_default) VALUES
(1, 'residencia', 'Calle 5 #12-45, Apto 301', 'Giganta, Huila', '+57 3001234567', 1);

SELECT * FROM direcciones;

