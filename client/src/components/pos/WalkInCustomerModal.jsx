/**
 * Modal de cliente walk-in POS (Fase 3).
 *
 * Cuando un pedido se hace sin cliente registrado, el POS necesita al menos
 * nombre y teléfono (para avisar cuando el pedido esté listo o entregado).
 * El backend crea un `usuarios` con `tipo_usuario='cliente'` y email fake
 * `walkin_<ts>@local.gigantya` (helper `getOrCreateWalkIn`).
 *
 * Estrategia:
 *   1) Buscar por teléfono (los walk-in suelen ser recurrentes, no
 *      necesariamente clientes registrados — pero si ya están en la BD,
 *      los reusamos para no duplicar usuarios).
 *   2) Si no hay match, crear nuevo walk-in con nombre + teléfono.
 *
 * El endpoint `POST /api/pos/customers/search-or-create` se ocupa de la
 * lógica. Si no existe aún, se hace fallback a `GET /users?telefono=...` +
 * `POST /users` con `tipo_usuario='cliente'`.
 */
import { useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default function WalkInCustomerModal({ onClose, onPicked }) {
  const [tab, setTab] = useState('buscar'); // 'buscar' | 'crear'
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);

  const buscar = async () => {
    if (!telefono.trim()) return;
    setBuscando(true);
    setError(null);
    try {
      const r = await API.get(`/users?telefono=${encodeURIComponent(telefono.trim())}`);
      const list = r.data.usuarios || r.data.users || r.data || [];
      setResultados(Array.isArray(list) ? list : []);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[color:var(--bg-elevated)] rounded-lg w-full max-w-md border border-[color:var(--border)] shadow-xl">
        <header className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Cliente walk-in</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex border-b border-[color:var(--border)]">
          <button
            onClick={() => setTab('buscar')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${tab === 'buscar' ? 'border-b-2 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`}
            type="button"
          >
            <Search className="w-4 h-4 inline mr-1" /> Buscar
          </button>
          <button
            onClick={() => setTab('crear')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${tab === 'crear' ? 'border-b-2 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]' : 'text-[color:var(--text-muted)]'}`}
            type="button"
          >
            <UserPlus className="w-4 h-4 inline mr-1" /> Nuevo
          </button>
        </div>

        <div className="p-4 space-y-3 min-h-[200px]">
          {error && <p className="text-sm text-rose-300">{error}</p>}

          {tab === 'buscar' && (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                  placeholder="3001234567"
                  className="flex-1 px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
                />
                <button
                  onClick={buscar}
                  disabled={buscando}
                  className="px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm disabled:opacity-50"
                  type="button"
                >
                  {buscando ? '…' : 'Buscar'}
                </button>
              </div>

              {resultados.length > 0 && (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {resultados.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => onPicked({ id: u.id, nombre: u.nombre, telefono: u.telefono })}
                        className="w-full text-left p-2 rounded border border-[color:var(--border)] hover:border-[color:var(--primary,#3b82f6)]"
                        type="button"
                      >
                        <div className="text-sm font-medium">{u.nombre}</div>
                        <div className="text-xs text-[color:var(--text-muted)]">{u.telefono}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {resultados.length === 0 && telefono && !buscando && (
                <p className="text-sm text-[color:var(--text-muted)]">
                  Sin resultados. Probá crearlo nuevo.
                </p>
              )}
            </>
          )}

          {tab === 'crear' && (
            <>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              />
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="3001234567"
                className="w-full px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] text-sm"
              />
              <button
                onClick={crear}
                disabled={creando}
                className="w-full px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm disabled:opacity-50"
                type="button"
              >
                {creando ? 'Creando…' : 'Crear cliente'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
