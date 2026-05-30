# 🔐 Sistema de Autenticación Modal

## ¿Cómo Funciona?

### Flujo de Usuario No Autenticado

1. **Usuario no autenticado intenta acceder a:**
   - `/restaurant/:id` (menú del restaurante)
   - `/cart` (carrito de compras)
   - `/checkout` (pago)
   - `/orders` (historial de pedidos)
   - `/profile` (perfil de usuario)

2. **Automáticamente aparece un Modal interactivo** con:
   - ✅ Título: "Acceso Requerido"
   - ✅ Mensaje explicativo
   - ✅ Botón "Iniciar Sesión" (color rojo primario)
   - ✅ Botón "Registrarse" (color blanco con borde rojo)
   - ✅ Botón cerrar (X) en la esquina
   - ✅ Opción para volver atrás

3. **Opciones del Usuario:**
   - Hacer clic en "Iniciar Sesión" → navega a `/login`
   - Hacer clic en "Registrarse" → navega a `/register`
   - Hacer clic en la X o fuera del modal → vuelve a la página anterior

4. **After login/register** → Usuario regresa automáticamente a la página protegida

---

## 📋 Componentes Creados/Modificados

### 1. **AuthModal.jsx** (NUEVO)
Componente de modal interactivo que muestra:
- Gradiente rojo en el header
- Animación de entrada (scaleIn, fadeIn)
- Botones con hover effects
- Click fuera del modal para cerrar
- Icono de candado indicando seguridad

**Props:**
- `isOpen` (boolean) - controla si el modal está visible
- `onClose` (function) - callback cuando el usuario cierra el modal

### 2. **ProtectedRoute.jsx** (MODIFICADO)
Cambios:
- Ahora muestra AuthModal en lugar de redirigir automáticamente
- Permite al usuario interactuar antes de navegar
- Al cerrar modal, vuelve a página anterior con `navigate(-1)`
- Mantiene la lógica de roles y autenticación

---

## 🎨 Características Visuales

✨ **Animaciones:**
- `fadeIn` - entrada suave del fondo oscuro
- `scaleIn` - modal crece desde el centro

🎯 **Interactividad:**
- Botones con efecto hover (elevación)
- Transiciones suaves (300ms)
- Click en backdrop cierra el modal

🔒 **Seguridad:**
- Mensaje de SSL en el footer del modal
- Candado en el icono del modal

---

## 📱 Responsive Design

- ✅ Modal adapta ancho a dispositivos móviles
- ✅ Botones apilan en pantallas pequeñas
- ✅ Texto se adapta al tamaño de pantalla

---

## 🧪 Casos de Prueba

1. **Caso 1: Usuario intenta acceder a restaurante sin iniciar sesión**
   - Ir a http://localhost:5173/
   - Hacer clic en un restaurante
   - Resultado: Modal aparece

2. **Caso 2: Usuario hace clic en "Iniciar Sesión" desde modal**
   - Hace clic en botón azul
   - Resultado: Navega a /login

3. **Caso 3: Usuario hace clic en "Registrarse" desde modal**
   - Hace clic en botón blanco
   - Resultado: Navega a /register

4. **Caso 4: Usuario cierra modal con X**
   - Hace clic en X o backgroundColor
   - Resultado: Vuelve a página anterior (/home)

5. **Caso 5: Usuario inicia sesión desde modal**
   - Desde modal → Iniciar Sesión → Login
   - Después de login: Debería poder acceder a restaurante directamente

---

## 📂 Archivos Modificados

```
client/src/
├── components/
│   ├── AuthModal.jsx          ✨ NUEVO
│   └── ProtectedRoute.jsx     🔄 MODIFICADO
└── pages/
```

---

## 🔗 Rutas Protegidas Afectadas

- `/restaurant/:id` - Menú del restaurante
- `/cart` - Carrito
- `/checkout` - Pago
- `/orders` - Historial
- `/profile` - Perfil

---

**Versión:** 1.0  
**Fecha:** 2026-05-20

