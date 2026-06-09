import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Escribir todos los errores en error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Escribir todo en combined.log
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Si no estamos en producción, imprimir logs en la consola con un formato más legible
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
