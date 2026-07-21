// Forzar zona horaria de Colombia para TODO el proceso Node.
// Tiene que ser la PRIMERA línea ejecutable (antes de imports que puedan
// cachear fechas, abrir el pool de MySQL o registrar crons) para que
// mysql2, Intl, y `new Date()` del servidor trabajen alineados con la
// hora que ven los usuarios en Colombia.
process.env.TZ = 'America/Bogota';

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
// Timeout para requests lentas. 5 min es suficiente para exports grandes
// (PDFs/Excel de hasta ~1000 pedidos) y reduce la ventana de ataques
// Slowloris vs el default anterior de 10 min. Si en el futuro algún
// endpoint necesita más, usar streaming con chunked transfer en vez
// de inflar este número.
httpServer.requestTimeout = 300000;
httpServer.timeout = 300000;

// CORS_ORIGIN admite un único origin o lista separada por comas (ver
// la validación completa en app.js). Aquí solo la parseamos para que el
// handshake de Socket.IO refleje el origin del request cuando hay
// varios permitidos.
const RAW_CORS_ORIGIN_SOCK = process.env.CORS_ORIGIN || 'http://localhost:5173';
const CORS_ORIGIN_LIST_SOCK = RAW_CORS_ORIGIN_SOCK.split(',').map((o) => o.trim()).filter(Boolean);

const io = new SocketServer(httpServer, {
  cors: {
    // Función para reflejar el origin del handshake (mismo criterio que
    // en app.js, así un origin válido en HTTP también es válido en WS).
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      if (CORS_ORIGIN_LIST_SOCK.includes(requestOrigin)) return callback(null, true);
      return callback(new Error(`Origin "${requestOrigin}" no está en CORS_ORIGIN whitelist`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
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
    console.log(`[server] CORS habilitado para: ${CORS_ORIGIN_LIST_SOCK.join(', ')}`);
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
