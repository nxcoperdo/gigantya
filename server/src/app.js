import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { UPLOADS_DIR } from './middleware/uploadMiddleware.js';
import logger from './utils/logger.js';
import Sentry from './utils/sentry.js';

// Cargar variables de entorno
dotenv.config();

const app = express();

// Desactivar el header X-Powered-By por seguridad
app.disable('x-powered-by');

// Confiar en proxies. Con Cloudflare + nginx en frente del Node:
//   cliente → Cloudflare (edge) → nginx (VPS) → Node
// son 2 hops de proxy. Subimos trust proxy a 2 para que req.ip y
// express-rate-limit tomen la IP del cliente real (la que viene en
// cf-connecting-ip / X-Forwarded-For), no la del proxy intermedio.
// CUIDADO: no subir a `true` (sin número) porque Express pasaría a
// confiar en TODOS los headers X-Forwarded-For que mande cualquier
// cliente, y un atacante podría inyectar una IP falsa para evadir
// rate-limit. Con un número fijo (2) solo se confía en los proxies
// que efectivamente están adelante.
app.set('trust proxy', 2);

// Sentry request handler debe ir antes de cualquier otro middleware
Sentry.setupExpressErrorHandler(app);

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import preferenceRoutes from './routes/preferenceRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import zonaRoutes from './routes/zonaRoutes.js';
// POS (Fase 1+)
import posStaffRoutes from './routes/posStaffRoutes.js';
import posTableRoutes from './routes/posTableRoutes.js';


// ========== MIDDLEWARES DE SEGURIDAD ==========

// Helmet con configuración optimizada para API
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // CSP deshabilitado para API (no se renderiza HTML aquí)
  contentSecurityPolicy: false,
  // HSTS habilitado en producción
  strictTransportSecurity: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
}));

// CORS
// Assert temprano: CORS_ORIGIN debe ser un único origin (no '*' ni lista
// separada por comas). Express solo permite un origin cuando se usa
// `credentials: true`; cualquier otro valor hace que el navegador ignore
// la respuesta CORS y termina rompiendo auth en silencio. Si la validación
// falla, NO arrancamos el server (fail-fast en vez de inseguro-por-defecto).
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
if (CORS_ORIGIN === '*' || CORS_ORIGIN.trim() === '') {
  throw new Error('CORS_ORIGIN no puede ser "*" ni estar vacío. Definí un único origin (ej: https://gigantya.com)');
}
if (CORS_ORIGIN.includes(',')) {
  throw new Error(`CORS_ORIGIN debe ser un único origin, no una lista separada por comas. Recibido: "${CORS_ORIGIN}"`);
}
// Validar que parezca una URL http(s) — defensa contra typos en .env
try {
  const parsed = new URL(CORS_ORIGIN);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('protocol no es http/https');
  }
} catch (e) {
  throw new Error(`CORS_ORIGIN no es una URL válida: "${CORS_ORIGIN}" (${e.message})`);
}

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  // Reducir overhead de CORS preflight
  maxAge: 86400 // Cache preflight 24h
}));

// Compresión Gzip/Deflate para todas las respuestas
// Reduce hasta 70% el tamaño de las respuestas JSON
app.use(compression({
  level: 6, // Balance entre velocidad y ratio de compresión
  threshold: 1024, // Solo comprimir respuestas > 1KB
  filter: (req, res) => {
    // No comprimir respuestas de streaming (exports PDF/Excel)
    if (req.path.includes('/exports/')) return false;
    return compression.filter(req, res);
  }
}));

// Middleware para parsear JSON y datos de formularios
// Limitar tamaño del body para prevenir ataques de memoria
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== RATE LIMITING DIFERENCIADO ==========

// Rate limit estricto para autenticación (previene fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos por IP
  message: { error: 'Demasiados intentos de autenticación, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Rate limit general para API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ========== ARCHIVOS ESTÁTICOS CON CACHE ==========

// Servir archivos estáticos de uploads con cache agresivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache de 7 días para imágenes, 1 día para otros archivos
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d', // Cache en navegador por 7 días
  etag: true,
  lastModified: true,
  immutable: false,
  setHeaders: (res, filePath) => {
    // Headers específicos por tipo de archivo
    if (/\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate');
    } else if (/\.(pdf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    // Defensa contra XSS via SVG subido maliciosamente: el browser no
    // debe poder ejecutar scripts aunque la extensión sea .svg.
    // SVG puede contener <script> por diseño, así que lo servimos
    // como image/svg+xml sin permisos de script.
    if (/\.svg$/i.test(filePath)) {
      res.setHeader('Content-Security-Policy', "script-src 'none'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// ========== RUTAS API v1 ==========

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/zonas', zonaRoutes);
app.use('/api/pos/staff', posStaffRoutes);
app.use('/api/pos/tables', posTableRoutes);

// Ruta de bienvenida
app.get('/api', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
  res.json({
    message: 'API Sistema de Pedidos para Locales',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      restaurants: '/api/restaurants',
      products: '/api/products',
      orders: '/api/orders',
      admin: '/api/admin'
    }
  });
});

// Health check endpoint (para load balancers / monitoring)
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ========== MIDDLEWARE DE ERRORES ==========

app.use((err, req, res, next) => {
  // Loggear solo en desarrollo para no llenar logs en producción
  if (process.env.NODE_ENV !== 'production') {
    logger.error(`${err.stack || err}`);
  } else {
    logger.error(`${err.name}: ${err.message}`);
  }

  // Reportar a Sentry
  Sentry.captureException(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validacion',
      details: err.message
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token invalido'
    });
  }

  if (err.name === 'MulterError' || err.message?.startsWith('Solo se permiten')) {
    return res.status(400).json({
      error: err.message
    });
  }

  res.status(err.statusCode || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.path,
    method: req.method
  });
});

export default app;
