# Plan — Bug loop de login en restaurantes suspendidos/reactivados

## Contexto

El usuario "El Saborr Giganteño" (restaurante) fue suspendido por el admin, luego reactivado. Reporta que **puede iniciar sesión una sola vez** y, en intentos posteriores, obtiene **"Credenciales inválidas" (401)** y queda en loop sin poder volver a entrar.

El síntoma exacto (401 tras un login exitoso previo) y la pista de que intervino el admin sugieren que entre el primer y segundo intento **el estado del usuario fue cambiado a algo que `getUserByEmailIgnoreStatus` no encuentra**, o que la contraseña quedó inconsistente. Pero al margen de la causa exacta en la DB, el código tiene **tres defectos latentes** que, combinados, reproducen este tipo de bug y otros similares. El fix es integral.

## Causa raíz confirmada en el código (lectura directa)

### Defecto 1 — `getUserById` oculta el estado real del usuario

**Archivo:** `server/src/models/User.js:115`

```js
const sql = 'SELECT id, ... FROM usuarios WHERE id = ? AND estado = "activo"';
```

Filtra por `estado = "activo"`. Si el admin pone al usuario en `inactivo` (un valor válido que el dropdown de admin expone en `adminController.js:259`), `getUserById` devuelve `null`. El middleware `verifyToken` (`authMiddleware.js:22`) interpreta `null` como "sesión expirada" y devuelve **403** — pero el interceptor de axios (`client/src/services/api.js:25-36`) **solo limpia localStorage en 401, no en 403**. Resultado: el token queda guardado, la app cree estar autenticada, y el usuario entra en `/dashboard` con sesión fantasma.

### Defecto 2 — Interceptor de axios no trata 403 como "no autenticado"

**Archivo:** `client/src/services/api.js:25-36`

Un 403 de `verifyToken` significa que la sesión ya no es válida (suspendido/inactivo), pero el interceptor solo maneja 401. El frontend se queda con un token muerto en localStorage y, como `ProtectedRoute.jsx:12` solo verifica `isAuthenticated` (que se basa en `!!token`), deja pasar al usuario al dashboard. La primera llamada protegida revienta con 403 y queda sin manejo centralizado.

### Defecto 3 — Admin "reactivar" no sincroniza `restaurantes.estado`

**Archivo:** `server/src/controllers/adminController.js:254-270`

`updateUserStatus` solo actualiza `usuarios.estado`. Si en algún momento el restaurante quedó con `restaurantes.estado='rechazado'` (por `Restaurant.js:338`), la reactivación del usuario no toca el restaurante. La página del dashboard y la de "mis pedidos" filtran por `r.estado = 'activo'` y ven un fantasma. (Esto no es el caso actual, pero es un bug latente del mismo tipo.)

### Defecto 4 (probable causa del 401 específico que reportas)

**Archivo:** `server/src/controllers/authController.js:104`

`getUserByEmailIgnoreStatus` busca por `email` exacto. Si el admin, al suspender/reactivar, **modificó el email** (cosa que el admin puede hacer en otros endpoints sin restricción) o si el email tiene mayúsculas/minúsculas distintas entre la fila en DB y lo que el usuario tipea, la búsqueda falla y devuelve 401 "Credenciales inválidas". El segundo intento falla porque entre login 1 y login 2 el email en DB cambió (o el admin reseteó la contraseña a un hash que el cliente no conoce y la respuesta es 401 — lo cual también encaja con "Credenciales inválidas" si `verifyPassword` falla).

**Independiente de cuál de las 4 causas sea la culpable exacta, el plan arregla todas**, porque comparten el mismo patrón: el backend no expone suficiente información al frontend para distinguir "email no existe" de "contraseña mal" de "cuenta suspendida", y el frontend no limpia credenciales cuando recibe señales de sesión inválida.

## Plan de implementación

### 1. Backend — `server/src/models/User.js`

- **Quitar el filtro `AND estado = "activo"` de `getUserById` (línea 115).** El middleware `verifyToken` ya chequea `estado === 'suspendido'` explícitamente. Filtrar en el modelo oculta el estado que el middleware necesita inspeccionar.
- Devolver la columna `estado` también (verificar que el `SELECT` la incluye; el actual ya la trae).

### 2. Backend — `server/src/middleware/authMiddleware.js`

- **Endurecer la condición de rechazo (línea 22)** para tratar `inactivo` igual que `suspendido`:
  ```js
  if (!usuario || ['suspendido', 'inactivo'].includes(usuario.estado)) {
    return res.status(401).json({ error: 'Tu sesión ha expirado o tu cuenta ha sido suspendida' });
  }
  ```
- Cambiar el código de 403 a **401** para que el interceptor del frontend (que ya limpia localStorage en 401) lo maneje de forma consistente. Es semánticamente correcto: un token cuyo usuario ya no puede autenticarse equivale a "no autenticado".

### 3. Backend — `server/src/controllers/authController.js`

- **Devolver 401 específico cuando el email no existe vs. 401 cuando la contraseña es incorrecta** (mantener 403 cuando `estado='suspendido'`). Esto no es estrictamente necesario pero ayuda a depurar.
- En la línea 111, **loggear siempre** qué `estado` tiene el usuario que intentó login (con su id, sin la contraseña). Esto le da al admin visibilidad si vuelve a pasar.

### 4. Backend — `server/src/controllers/adminController.js`

- En `updateUserStatus` (línea 254): cuando se reactiva un usuario (`estado='activo'`) y el usuario es de tipo `restaurante`, también poner `restaurantes.estado = 'activo'` para la fila vinculada por `usuario_id`. Una sola query con un `UPDATE ... WHERE usuario_id IN (SELECT id FROM usuarios WHERE ...)` o un `UPDATE restaurantes r JOIN usuarios u ...`.

### 5. Frontend — `client/src/services/api.js`

- **Extender el interceptor de respuesta (líneas 25-36)** para que también limpie localStorage y redirija a `/login` ante 401, conservando el comportamiento actual. (El cambio de 403→401 en el middleware hace que la rama ya existente aplique.)

### 6. Frontend — `client/src/context/AuthContext.jsx`

- En la función `login` (línea 25), cuando el servidor responda con un 401 o 403 de **este mismo endpoint de login** (no del flujo de "sesión muerta" en otras llamadas), **mostrar el mensaje exacto del backend** sin lanzar a `/login` automáticamente. Hoy cualquier `err.response?.data?.error` se muestra bien, pero conviene confirmar que el `setError` se propaga al `LoginPage` (ya lo hace, línea 22 de `LoginPage.jsx`).
- Añadir un **botón "Limpiar sesión y reintentar"** en el `LoginPage` (esquina, opcional, oculto por defecto) que limpie localStorage sin recargar — útil si el usuario sospecha que el token viejo está bloqueando el login. Implementación: 5 líneas en `LoginPage.jsx` + handler en `AuthContext.jsx`.

### 7. Diagnóstico en producción (no se codifica, se documenta)

- En el README o en un comentario del modelo `User.js`, dejar documentado: si vuelve a pasar, ejecutar `SELECT id, email, estado, contrasena_hash IS NOT NULL AS tiene_hash FROM usuarios WHERE email = 'saborr@...'`. Si `estado != 'activo'`, la causa es suspensión residual. Si `contrasena_hash` es `NULL`, la causa es un reset que no se aplicó al hash.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `server/src/models/User.js` | Quitar `AND estado = "activo"` de `getUserById` (línea 115) |
| `server/src/middleware/authMiddleware.js` | Tratar `inactivo` como suspendido, cambiar 403 → 401 (línea 22) |
| `server/src/controllers/authController.js` | Loggear `usuario.estado` y `id` en cada login (línea 110, antes del check) |
| `server/src/controllers/adminController.js` | Sincronizar `restaurantes.estado='activo'` al reactivar un usuario restaurante (línea 263) |
| `client/src/services/api.js` | Confirmar que el interceptor cubre 401 (ya lo hace) — sin cambios si el backend ya devuelve 401 |
| `client/src/context/AuthContext.jsx` | Añadir helper `clearLocalSession()` (≤5 líneas) |
| `client/src/pages/LoginPage.jsx` | Botón "Limpiar sesión y reintentar" que llame al helper |

## Verificación

1. **Resetear el estado del usuario problemático** en DB:
   ```sql
   UPDATE usuarios SET estado = 'activo' WHERE email = '<email del saborr>';
   UPDATE restaurantes SET estado = 'activo' WHERE usuario_id = (SELECT id FROM usuarios WHERE email = '<email>');
   ```
2. **Probar login OK**: el restaurante inicia sesión, ve el dashboard, navega a otras páginas. Verificar que el token está en localStorage.
3. **Probar el camino del bug original**:
   - Poner `usuarios.estado='suspendido'` desde la consola.
   - Llamar a cualquier endpoint protegido desde el frontend. Debe limpiar localStorage y redirigir a `/login` con un mensaje claro.
   - Hacer login de nuevo. **Antes del fix** el token viejo en localStorage interfería; **con el fix** se limpia y el login funciona si el estado lo permite.
4. **Probar login tras reactivación**: cambiar a `estado='activo'` y verificar que el login responde 200.
5. **Probar la sincronización admin→restaurante**: rechazar un restaurante (`restaurantes.estado='rechazado'`), luego cambiar el usuario a `activo`. Verificar que `restaurantes.estado` también volvió a `activo`.

## Lo que NO se hace en este plan

- No se introduce refresh token rotation (el JWT actual es de 7 días, suficiente para este fix).
- No se cambia el dropdown del admin para quitar "Inactivo" (es un valor válido del enum, solo que el código no lo trataba bien).
- No se cambia el hash de contraseñas (no es la causa).
