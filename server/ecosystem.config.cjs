/**
 * PM2 Ecosystem Configuration
 *
 * Modos de inicio:
 *   - production: pm2 start ecosystem.config.cjs --env production
 *   - development: pm2 start ecosystem.config.cjs
 *
 * Comandos útiles:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 logs gigantya-api
 *   pm2 monit
 *   pm2 restart gigantya-api
 *   pm2 stop gigantya-api
 *   pm2 delete gigantya-api
 *   pm2 save  (guarda el estado actual)
 *   pm2 startup  (configura inicio automático)
 */
module.exports = {
  apps: [
    {
      name: 'gigantya-api',
      script: './src/server.js',
      cwd: __dirname,
      // Modo cluster para usar todos los cores (mejor performance)
      // Usar 'fork' si hay problemas de memoria
      exec_mode: 'fork',
      // Número de instancias
      // En VPS pequeños (1-2GB RAM) usar 1
      // En VPS medianos (4GB+) usar 'max' para cluster
      // IMPORTANTE: cluster mode rompería Socket.IO porque las notificaciones
      // en tiempo real (pedidos nuevos, cambios de estado) viven en memoria
      // del proceso y con 2 instancias un evento emitido desde el proceso A
      // nunca llega a un cliente conectado al proceso B. Para activar cluster
      // hay que sumar @socket.io/redis-adapter y mantener Redis en el VPS.
      // Con el volumen actual de GigantYA, fork + 1 instancia sobra.
      instances: 1,
      // Auto-restart en caso de crash
      autorestart: true,
      // Watch desactivado en producción (mejor performance)
      watch: false,
      // Memoria máxima antes de reiniciar (en MB)
      max_memory_restart: '512M',
      // Limitar número de reinicios
      max_restarts: 10,
      // Tiempo mínimo entre reinicios (ms)
      min_uptime: '10s',
      // Variables de entorno
      // TZ: forzar la zona horaria de Colombia para que mysql2, Intl y
      // `new Date()` del servidor queden alineados con la hora que ven
      // los usuarios en la web.
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        TZ: 'America/Bogota',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        TZ: 'America/Bogota',
      },
      // Configuración de logs
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      // Combinar logs de múltiples instancias
      merge_logs: true,
      // Tamaño máximo de log antes de rotar (10MB)
      log_size: '10M',
      // Mantener logs antiguos
      retain: 7,
      // Timestamp en logs
      time: true,
      // Logs adicionales para debugging
      pmx: true,
      // Argumentos node (opcional)
      // node_args: ['--max-old-space-size=512'],
    },
  ],
};
