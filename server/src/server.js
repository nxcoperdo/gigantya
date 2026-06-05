import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { UPLOADS_DIR } from './middleware/uploadMiddleware.js';

// Cargar variables de entorno
dotenv.config();

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

// Importar manejadores de Socket.IO
import socketHandler from './socket/socketHandler.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Middleware para parsear JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Aumentado de 100 a 500 para evitar bloqueos frecuentes
  message: 'Demasiadas solicitudes, intenta más tarde'
});
app.use('/api/', limiter);

// Servir archivos estáticos de subidas
app.use('/uploads', express.static(UPLOADS_DIR));

// Rutas API v1
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

// Ruta de bienvenida
app.get('/api', (req, res) => {
  res.json({
    message: 'API Sistema de Pedidos para Restaurantes',
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

// Manejador de Socket.IO
socketHandler(io);

// Middleware de errores personalizado
app.use((err, req, res, next) => {
  console.error('Error:', err);

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


// Iniciar servidor
const PORT = process.env.PORT || 5000;

// Al poner '0.0.0.0', le indicas al servidor que escuche
// en todas las interfaces de red disponibles.
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
    console.log(`[server] Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[server] CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;

