import { query } from '../src/config/database.js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrate() {
  console.log('🚀 Starting migration for Coupons System...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS cupones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurante_id INT NOT NULL,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        descuento DECIMAL(10, 2) NOT NULL,
        tipo_descuento ENUM('porcentaje', 'fijo') NOT NULL,
        fecha_expiracion DATE,
        min_compra DECIMAL(10, 2),
        usos_maximos INT,
        usos_actuales INT DEFAULT 0,
        activo BOOLEAN DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
        INDEX idx_restaurante_id (restaurante_id),
        INDEX idx_codigo (codigo)
      )
    `);
    console.log('✅ Coupons table created successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
