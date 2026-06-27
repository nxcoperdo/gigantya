import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Asegurar que la carpeta raíz exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Factory: crea un middleware `multer` que sube archivos a una subcarpeta
 * específica dentro de `uploads/`, con whitelist de tipos MIME/extensiones
 * y límite de tamaño configurables.
 *
 * Esto resuelve el problema de tener todos los archivos (productos,
 * comprobantes de pago, galería, etc.) mezclados en una sola carpeta con
 * nombres `upload-{randomId}.{ext}`. Ahora cada flujo va a su propia
 * subcarpeta, lo que facilita backups selectivos y limpieza de huérfanos.
 *
 * @param {Object} opts
 * @param {string} opts.subdir         - Subcarpeta dentro de `uploads/` (ej: 'products')
 * @param {RegExp}  [opts.allowedTypes] - Regex sobre MIME y extensión
 * @param {number}  [opts.maxSize]     - Tamaño máximo en bytes (default 5MB)
 * @returns {multer.Multer}
 */
export function createUploader({
  subdir,
  allowedTypes = /jpeg|jpg|png|webp|svg/,
  maxSize = 5 * 1024 * 1024,
} = {}) {
  if (!subdir) {
    throw new Error('createUploader requiere { subdir }');
  }

  // Sanitizar el subdir para evitar path traversal (../). Solo letras,
  // números, guiones y underscores.
  if (!/^[a-zA-Z0-9_-]+$/.test(subdir)) {
    throw new Error(`subdir inválido: ${subdir}`);
  }

  const targetDir = path.join(UPLOADS_DIR, subdir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `upload-${uniqueId}${ext}`);
    }
  });

  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      const isMimeTypeValid = allowedTypes.test(file.mimetype);
      const isExtValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

      if (isMimeTypeValid && isExtValid) {
        return cb(null, true);
      }
      cb(new Error(`Solo se permiten archivos: ${allowedTypes}`));
    },
    limits: {
      fileSize: maxSize,
      fields: 20,
      fieldSize: 1024 * 1024, // 1MB por field
    }
  });
}

/**
 * Storage legacy para compatibilidad con callers existentes.
 * Sube a la raíz `uploads/`. Se mantiene para endpoints que aún no se
 * migraron a `createUploader` (ej: avatar de usuario si lo agregás).
 */
const legacyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueId}${ext}`);
  }
});

/**
 * Multer legacy: misma configuración que antes (raíz de uploads/, 5MB,
 * whitelist de imágenes). Mantenido para no romper consumidores existentes
 * que importaban `upload` directamente.
 */
export const upload = multer({
  storage: legacyStorage,
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
    fields: 20,
    fieldSize: 1024 * 1024, // 1MB por field
  }
});
