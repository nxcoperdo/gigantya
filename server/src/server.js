import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import socketHandler from './socket/socketHandler.js';
import { startScheduler } from './jobs/scheduler.js';

// Cargar variables de entorno
dotenv.config();

const httpServer = createServer(app);

// Configurar timeouts del servidor HTTP para mejor manejo de conexiones largas
httpServer.keepAliveTimeout = 65000; // 65 segundos (mayor al típico ALB de 60s)
httpServer.headersTimeout = 66000; // Debe ser mayor a keepAliveTimeout
// Timeout para requests lentas (10 min - útil para exports grandes)
httpServer.requestTimeout = 600000;
httpServer.timeout = 600000;

const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  // Configuración optimizada de Socket.IO
  pingTimeout: 60000, // 60s
  pingInterval: 25000, // 25s
  // Limitar tamaño de mensaje
  maxHttpBufferSize: 1e6, // 1MB
  // Transport preferido
  transports: ['websocket', 'polling'],
  // Habilitar compresión para eventos de Socket.IO
  perMessageDeflate: true,
});

// Manejador de Socket.IO
socketHandler(io);

// Jobs programados (verificación diaria de suscripciones)
startScheduler();

// Iniciar servidor
const PORT = process.env.PORT || 5000;

// Al poner '0.0.0.0', le indicas al servidor que escuche
// en todas las interfaces de red disponibles.
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
    console.log(`[server] Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[server] CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

// ========== GRACEFUL SHUTDOWN ==========
// Manejar señales de terminación para cerrar limpiamente
const gracefulShutdown = (signal) => {
  console.log(`\n[server] Señal ${signal} recibida. Cerrando servidor...`);

  // Dejar de aceptar nuevas conexiones
  httpServer.close(() => {
    console.log('[server] HTTP server cerrado');
    process.exit(0);
  });

  // Forzar cierre después de 30s si no se cierra limpiamente
  setTimeout(() => {
    console.error('[server] Forzando cierre tras 30s');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capturar errores no manejados
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught Exception:', error);
  // Dar tiempo a logger de escribir antes de morir
  setTimeout(() => process.exit(1), 1000);
});
