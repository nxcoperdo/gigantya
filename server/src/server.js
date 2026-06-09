import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import socketHandler from './socket/socketHandler.js';
import { startScheduler } from './jobs/scheduler.js';

// Cargar variables de entorno
dotenv.config();

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
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
