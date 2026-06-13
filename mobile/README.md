# 🍽️ GigantYa - App Móvil

Aplicación React Native para clientes de GigantYa.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Expo CLI (se instala automáticamente)
- Para Android: Android Studio con emulador O Expo Go en tu dispositivo
- Para iOS: Xcode (solo macOS) O Expo Go en tu dispositivo

### Instalación

```bash
cd mobile
npm install
```

### Ejecutar la App

**Opción 1: Expo Go (Recomendado para desarrollo)**

1. Instala la app **Expo Go** en tu celular (Android/iOS)
2. Ejecuta:
   ```bash
   npm start
   ```
3. Escanea el código QR con Expo Go

**Opción 2: Emulador Android**

```bash
npm run android
```

**Opción 3: Emulador iOS (solo macOS)**

```bash
npm run ios
```

**Opción 4: Web**

```bash
npm run web
```

## ⚙️ Configuración de la API

Edita `App.js` y cambia `API_URL` según tu entorno:

```javascript
// Android Emulador
const API_URL = 'http://10.0.2.2:5000/api';

// Web
const API_URL = 'http://localhost:5000/api';

// Dispositivo físico (reemplaza con tu IP local)
const API_URL = 'http://192.168.1.XXX:5000/api';
```

## 📱 Funcionalidades Actuales

- ✅ Inicio de sesión
- ✅ Ver lista de restaurantes
- ✅ Ver detalle de restaurante
- ✅ Navegación entre pantallas
- ✅ Persistencia de sesión

## 🔜 Próximamente

- Carrito de compras
- Crear pedidos
- Seguimiento de pedidos en tiempo real
- Notificaciones push
- Calificaciones
- Historial de pedidos
- Direcciones de entrega
- Pagos

## 📂 Estructura del Proyecto

```
mobile/
├── App.js              # Punto de entrada principal
├── app.json           # Configuración de Expo
├── package.json       # Dependencias
├── assets/            # Imágenes e íconos
└── README.md          # Este archivo
```

## 🛠️ Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor de desarrollo |
| `npm run android` | Abre en emulador Android |
| `npm run ios` | Abre en emulador iOS |
| `npm run web` | Abre en navegador web |

## 📝 Notas

- La app requiere que el servidor backend esté corriendo en el puerto 5000
- Para usar en dispositivo físico, ambos (celular y computadora) deben estar en la misma red WiFi
- El servidor debe permitir CORS desde la IP del dispositivo

---

**Desarrollado con Expo y React Native** 🚀
