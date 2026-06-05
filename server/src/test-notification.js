import * as NotificationModel from './models/Notification.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar .env relativo a este archivo (server/.env). Esto hace que el test funcione
// sin importar desde qué directorio se ejecute el comando.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
console.log('Cargando .env desde:', envPath);
dotenv.config({ path: envPath });

async function sendTestNotification() {
  console.log('Cargando variables de entorno...');
  console.log('DB_USER:', process.env.DB_USER);

  try {
    const notificationId = await NotificationModel.createNotification({
      usuario_id: 4,
      tipo: 'info',
      titulo: 'Prueba de Notificación',
      mensaje: '¡Hola! Esta es una notificación de prueba para verificar que el sistema funciona correctamente.'
    });
    console.log(`✅ Notificación enviada con éxito. ID: ${notificationId}`);
  } catch (error) {
    console.error('❌ Error al enviar notificación:', error);
    process.exit(1);
  }
}

sendTestNotification();
