/**
 * Modal de cliente walk-in POS (Fase 3).
 *
 * Cuando un pedido se hace sin cliente registrado, el POS necesita al menos
 * nombre y teléfono (para avisar cuando el pedido esté listo o entregado).
 * El backend crea un `usuarios` con `tipo_usuario='cliente'` y email fake
 * `walkin_<ts>@local.gigantya`.
 *
 * Estrategia:
 *   1) Buscar por teléfono via `GET /api/pos/customers?telefono=...`
 *      (los walk-in suelen ser recurrentes, no necesariamente clientes
 *      registrados — pero si ya están en la BD, los reusamos para no
 *      duplicar usuarios).
 *   2) Si no hay match, crear nuevo walk-in con nombre + teléfono
 *      via `POST /api/pos/customers` (idempotente: si el teléfono ya
 *      existe, devuelve el existente con reused=true).
 *
 * Antes había un fallback a `GET /api/users?telefono=...` que NO existe
 * en el backend → 404. Lo sacamos y usamos siempre el endpoint POS.
 */
import { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Phone, User, Loader2, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const inputCls = 'w-full pl-10 pr-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function WalkInCustomerModal({ onClose, onPicked }) {
  const [tab, setTab] = useState('buscar'); // 'buscar' | 'crear'
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const telInputRef = useRef(null);

  useEffect(() => {
    telInputRef.current?.focus();
  }, []);

  const buscar = async () => {
    const tel = telefono.trim();
    if (!tel) return;
    setBuscando(true);
    setError(null);
    setBusquedaHecha(true);
    try {
      const r = await API.get('/pos/customers', { params: { telefono: tel } });
      setResultados(Array.isArray(r.data?.clientes) ? r.data.clientes : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBuscando(false);
    }
  };

  const crear = async () => {
    if (!nombre.trim() || !telefono.trim()) {
      setError('Nombre y teléfono son obligatorios');
      return;
    }
    setCreando(true);
    setError(null);
    try {
      const r = await API.post('/pos/customers', {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
      });
      onPicked(r.data.cliente);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkin-title"
    >
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md border border-[color:var(--border)] shadow-2xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
              aria-hidden="true"
            >
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h2 id="walkin-title" className="text-lg font-bold">Cliente walk-in</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[color:var(--bg)] transition-colors"
            type="button"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-[color:var(--border)] px-2" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'buscar'}
            onClick={() => { setTab('buscar'); setError(null); }}
            className={[
              'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === 'buscar'
                ? 'border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
            ].join(' ')}
            type="button"
          >
            <Search className="w-4 h-4" /> Buscar
          </button>
          <button
            role="tab"
            aria-selected={tab === 'crear'}
            onClick={() => { setTab('crear'); setError(null); }}
            className={[
              'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === 'crear'
                ? 'border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
            ].join(' ')}
            type="button"
          >
            <UserPlus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        <div className="p-5 space-y-3 min-h-[260px]">
          {error && (
            <div
              role="alert"
              className="text-sm px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300"
            >
              {error}
            </div>
          )}

          {tab === 'buscar' && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1.5">
                  Teléfono del cliente
                </span>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] pointer-events-none" aria-hidden="true" />
                  <input
                    ref={telInputRef}
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscar()}
                    placeholder="3001234567"
                    className={inputCls}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </label>

              <button
                onClick={buscar}
                disabled={buscando || !telefono.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                type="button"
              >
                {buscando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</>
                ) : (
                  <><Search className="w-4 h-4" /> Buscar</>
                )}
              </button>

              <div className="border-t border-[color:var(--border)] pt-3">
                {resultados.length > 0 && (
                  <>
                    <p className="text-xs text-[color:var(--text-muted)] mb-2 font-medium">
                      {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
                    </p>
                    <ul className="space-y-1.5 max-h-60 overflow-y-auto" role="listbox">
                      {resultados.map((u) => (
                        <li key={u.id} role="option">
                          <button
                            onClick={() => onPicked({ id: u.id, nombre: u.nombre, telefono: u.telefono })}
                            className="w-full text-left p-2.5 rounded-lg border border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)] hover:bg-[color:var(--primary,#3b82f6)]/5 transition-all"
                            type="button"
                          >
                            <div className="text-sm font-semibold">{u.nombre}</div>
                            <div className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" aria-hidden="true" />
                              {u.telefono}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {resultados.length === 0 && busquedaHecha && !buscando && (
                  <div className="text-center py-4">
                    <p className="text-sm text-[color:var(--text-muted)]">
                      Sin resultados para ese teléfono.
                    </p>
                    <button
                      onClick={() => { setTab('crear'); setError(null); }}
                      className="mt-2 text-sm font-semibold text-[color:var(--primary,#3b82f6)] hover:underline"
                      type="button"
                    >
                      Crear cliente nuevo →
                    </button>
                  </div>
                )}

                {!busquedaHecha && (
                  <p className="text-xs text-[color:var(--text-muted)] text-center py-2">
                    Buscá por teléfono para reusar un cliente existente.
                  </p>
                )}
              </div>
            </>
          )}

          {tab === 'crear' && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1.5">
                  Nombre del cliente <span className="text-rose-400">*</span>
                </span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] pointer-events-none" aria-hidden="true" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className={inputCls}
                    autoComplete="name"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1.5">
                  Teléfono <span className="text-rose-400">*</span>
                </span>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] pointer-events-none" aria-hidden="true" />
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="3001234567"
                    className={inputCls}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </label>
              <button
                onClick={crear}
                disabled={creando || !nombre.trim() || !telefono.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all mt-1"
                type="button"
              >
                {creando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Crear cliente</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
