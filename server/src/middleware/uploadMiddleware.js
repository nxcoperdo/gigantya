import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Asegurar que la carpeta exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Storage optimizado:
 * - Usa crypto.randomBytes en lugar de Math.random para nombres únicos
 * - Más rápido y mejor para colisiones
 * - Sanitiza extensiones
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generar ID único más eficiente con crypto
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueId}${ext}`);
  }
});

/**
 * Multer optimizado:
 * - Límite de tamaño 5MB (suficiente para imágenes optimizadas)
 * - Whitelist de tipos MIME y extensiones
 */
export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypesWithSvg = /jpeg|jpg|png|webp|svg/;
    const isMimeTypeValid = allowedTypesWithSvg.test(file.mimetype);
    const isExtValid = allowedTypesWithSvg.test(path.extname(file.originalname).toLowerCase());

    if (isMimeTypeValid && isExtValid) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp, svg)'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    // Limitar número de campos en form data (DoS prevention)
    fields: 20,
    fieldSize: 1024 * 1024, // 1MB por field
  }
});
