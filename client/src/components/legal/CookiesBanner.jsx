import { useEffect, useState } from 'react';
import { Cookie, X, Settings2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { legalService } from '../../services/api.js';

/**
 * `CookiesBanner` — banner de consentimiento de cookies.
 *
 * Aparece SOLO si el usuario nunca aceptó/rechazó cookies o si pasaron
 * más de 12 meses desde la última elección (recomendación de la SIC).
 * Se muestra fijo en la parte inferior de la pantalla, en mobile arriba
 * del bottom-nav si existe.
 *
 * Tres opciones:
 *   1. "Aceptar todas"  → guarda { analytics: true, marketing: true }
 *   2. "Solo esenciales" → guarda { analytics: false, marketing: false }
 *   3. "Configurar"    → abre el panel de detalle con switches
 *
 * Persistencia: localStorage con key 'gigantya.cookieConsent' y timestamp.
 * Plus: se hace un POST a /api/legal/aceptar para tener el log legal.
 *
 * El gating real de scripts opcionales (analytics, pixel) debe estar en
 * un componente separado <CookieGatedScripts /> que lea este state y
 * monte los scripts solo si el usuario aceptó. No se monta nada por
 * defecto aquí — el componente es solo el banner de UI.
 */
const STORAGE_KEY = 'gigantya.cookieConsent';
const MAX_AGE_DAYS = 365; // recomendación SIC: re-preguntar cada 12 meses

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Verificar si venció
    const ageMs = Date.now() - (parsed.timestamp || 0);
    if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(prefs) {
  const value = { ...prefs, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  // Log legal asíncrono, fire-and-forget. Si falla, no rompemos UX.
  legalService.aceptar({
    tipo: 'cookies',
    version: 'v1.0-2026-07-10',
  }).catch(() => {});
  // Disparar evento para que <CookieGatedScripts /> monte/desmonte
  window.dispatchEvent(new CustomEvent('gigantya:cookieConsentChange', { detail: value }));
}

export default function CookiesBanner() {
  const [visible, setVisible] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });

  // Mostrar solo si no hay consentimiento vigente
  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      // Pequeño delay para que no aparezca antes de que la home termine
      // de montar (mejor UX: el usuario ve primero la home, después el banner)
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const acceptAll = () => {
    writeConsent({ analytics: true, marketing: true });
    setVisible(false);
  };

  const rejectAll = () => {
    writeConsent({ analytics: false, marketing: false });
    setVisible(false);
  };

  const saveConfig = () => {
    writeConsent(prefs);
    setShowConfig(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop sutil cuando el panel de config está abierto */}
      {showConfig && (
        <div
          className="fixed inset-0 bg-black/40 z-40 animate-fadeIn"
          onClick={() => setShowConfig(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel de configuración detallada (modal) */}
      {showConfig && (
        <div
          className="fixed inset-x-4 bottom-4 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-50 animate-slideUp"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookies-config-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 id="cookies-config-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-indigo-600" />
                  Configurar cookies
                </h3>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Elige qué tipo de cookies aceptas. Puedes cambiar tu elección en cualquier
                momento desde <em>Configuración &gt; Privacidad &gt; Cookies</em>.
              </p>

              <div className="space-y-3">
                {/* Esenciales — siempre ON, no se puede desactivar */}
                <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Esenciales</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Necesarias para que la plataforma funcione (sesión, carrito, autenticación).
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-400 mt-1">Siempre activas</span>
                </div>

                {/* Analíticas */}
                <label className="flex items-start justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Analíticas</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Nos ayudan a entender cómo usas la plataforma para mejorarla.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.analytics}
                    onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {/* Marketing */}
                <label className="flex items-start justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Marketing</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Usadas para mostrar publicidad relevante y medir campañas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.marketing}
                    onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>

              <button
                onClick={saveConfig}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Guardar preferencias
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner principal — solo visible si NO está en modo config */}
      {!showConfig && (
        <div
          className="fixed inset-x-3 bottom-3 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px] sm:max-w-[calc(100vw-2rem)] z-40 animate-slideUp"
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="hidden sm:flex flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full items-center justify-center">
                <Cookie className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  Usamos cookies
                </p>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                  Usamos cookies propias y de terceros para que la plataforma funcione, recordar
                  tus preferencias y mejorar el servicio. Puedes aceptar todas, rechazar las
                  opcionales o configurar tu elección. Consultá nuestra{' '}
                  <Link to="/cookies" className="text-indigo-600 underline">
                    Política de Cookies
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={acceptAll}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                Aceptar todas
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                Solo esenciales
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex-1 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Settings2 className="w-4 h-4" />
                Configurar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
