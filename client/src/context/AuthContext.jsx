import { createContext, useContext, useEffect, useState } from 'react';
import { authService, userService } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar si hay token guardado al montar el componente
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authService.login(email, password);
      const { token, usuario } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usuario));

      setToken(token);
      setUser(usuario);

      return usuario;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al iniciar sesión';
      setError(errorMsg);
      throw err;
    }
  };

  // Login/registro con Google. Recibe el `credential` (ID token) que emite
  // Google Identity Services y lo canjea en el backend por nuestro JWT.
  // Guarda token+usuario igual que el login normal.
  const loginWithGoogle = async (credential) => {
    try {
      setError(null);
      const response = await authService.google(credential);
      const { token, usuario } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usuario));

      setToken(token);
      setUser(usuario);

      return usuario;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al iniciar sesión con Google';
      setError(errorMsg);
      throw err;
    }
  };

  // Completa el login con Google por REDIRECT: la página de callback
  // (GoogleOAuthCallbackPage) ya recibió token+refreshToken del backend
  // (flujo Authorization Code, usado cuando la PWA corre instalada). Acá
  // solo falta guardar las credenciales y traer el `usuario` con /me,
  // porque ese endpoint no devuelve el usuario en el redirect (solo los
  // tokens, para no exponer datos de perfil en la URL).
  const completeGoogleRedirectLogin = async (googleToken, googleRefreshToken) => {
    try {
      setError(null);
      localStorage.setItem('token', googleToken);
      if (googleRefreshToken) localStorage.setItem('refreshToken', googleRefreshToken);

      const { usuario } = await userService.getProfile();

      localStorage.setItem('user', JSON.stringify(usuario));
      setToken(googleToken);
      setUser(usuario);

      return usuario;
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      const errorMsg = err.response?.data?.error || 'Error al iniciar sesión con Google';
      setError(errorMsg);
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await authService.register(userData);
      const { token, usuario } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usuario));

      setToken(token);
      setUser(usuario);

      return usuario;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al registrarse';
      setError(errorMsg);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setError(null);
  };

  // Útil cuando el usuario sospecha que hay un token viejo/muerto en
  // localStorage que está bloqueando el login (p.ej. tras una suspensión
  // y reactivación). Limpia las credenciales locales sin recargar.
  const clearLocalSession = () => {
    logout();
  };

  /**
   * Refresca el user desde /api/users/profile y actualiza localStorage
   * y el state. Útil después de un PUT a /me/onboarding para que el
   * front vea los flags de `otros_datos.onboarding` actualizados sin
   * tener que recargar la página.
   *
   * Devuelve el `usuario` refrescado o `null` si falló (no crítico:
   * logueamos y seguimos para no romper el flujo del usuario).
   */
  const refreshUser = async () => {
    try {
      const { usuario } = await userService.getProfile();
      if (usuario) {
        localStorage.setItem('user', JSON.stringify(usuario));
        setUser(usuario);
      }
      return usuario || null;
    } catch (err) {
      // No crítico: la app sigue funcionando con el state viejo.
      // El próximo refresh (otro PUT, otro login) lo sincronizará.
      console.error('[auth] refreshUser falló:', err?.response?.data?.error || err.message);
      return null;
    }
  };

  /**
   * Actualiza el `user` en el state y localStorage a partir de un
   * `usuario` que ya tenemos en mano (ej. lo devolvió el server en
   * la respuesta de un PUT).
   *
   * Es la alternativa preferida a `refreshUser()` cuando el endpoint
   * ya nos devolvió el usuario actualizado: evita un round-trip extra
   * a /profile y no depende de la red. Mantener el state sincronizado
   * en el mismo tick del PUT es crítico para features de UI que
   * dependen de leer `user.otros_datos.onboarding.*` en el siguiente
   * render (ej. tips del manual contextual que reaparecen si el flag
   * se pierde al remontar).
   */
  const setUserFromResponse = (usuario) => {
    if (!usuario) return;
    localStorage.setItem('user', JSON.stringify(usuario));
    setUser((prev) => ({ ...prev, ...usuario }));
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    login,
    loginWithGoogle,
    completeGoogleRedirectLogin,
    register,
    logout,
    clearLocalSession,
    refreshUser,
    setUserFromResponse,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

