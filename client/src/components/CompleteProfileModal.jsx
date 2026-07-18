import { useEffect, useMemo, useState } from 'react';
import { MapPin, ChevronDown, X, Phone } from 'lucide-react';
import { zonaService, addressService, authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Modal para completar el perfil de un usuario que se registró con Google.
 *
 * Google nos da nombre, email y foto, pero NO el teléfono ni la dirección,
 * que son obligatorios para pedir. Este modal los pide una sola vez, apenas
 * el usuario entra (después de aceptar los documentos legales — ver
 * `CompleteProfileGate`). Al guardar:
 *   1. Actualiza el teléfono del usuario (PUT /auth/profile).
 *   2. Crea su dirección por defecto (POST /addresses) con sector+barrio.
 *   3. Refresca el usuario en el AuthContext.
 *
 * Reutiliza los mismos endpoints que el registro normal, así que no hay
 * cambios de backend.
 *
 * Props:
 *  - onComplete(): se llama al guardar con éxito.
 *  - onSkip(): se llama si el usuario elige completar más tarde.
 */
export default function CompleteProfileModal({ onComplete, onSkip }) {
  const { user, refreshUser } = useAuth();

  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [barrioId, setBarrioId] = useState('');

  const [sectores, setSectores] = useState([]);
  const [barriosBySector, setBarriosBySector] = useState({});
  const [sectoresLoading, setSectoresLoading] = useState(true);
  const [sinZonas, setSinZonas] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cargar sectores al montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await zonaService.getSectores();
        const lista = res.data.sectores || [];
        if (cancelled) return;
        setSectores(lista);
        setSinZonas(lista.length === 0);
      } catch (err) {
        console.error('Error cargando sectores:', err);
        if (!cancelled) setSinZonas(true);
      } finally {
        if (!cancelled) setSectoresLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Al cambiar el sector, cargar sus barrios (con cache)
  useEffect(() => {
    if (!sectorId || barriosBySector[sectorId]) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await zonaService.getBarrios(sectorId);
        if (cancelled) return;
        setBarriosBySector((prev) => ({ ...prev, [sectorId]: res.data.barrios || [] }));
      } catch (err) {
        console.error('Error cargando barrios:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [sectorId, barriosBySector]);

  const barriosDelSector = useMemo(
    () => (sectorId ? barriosBySector[sectorId] || [] : []),
    [sectorId, barriosBySector]
  );

  const handleSectorChange = (e) => {
    setSectorId(e.target.value);
    setBarrioId(''); // al cambiar el sector, se limpia el barrio
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!telefono.trim()) return setError('Ingresa tu número de teléfono');
    if (!direccion.trim()) return setError('Ingresa tu dirección');
    if (!barrioId) return setError('Selecciona tu sector y barrio');

    setSaving(true);
    try {
      // 1. Teléfono del usuario (para el checkout)
      await authService.updateProfile({ telefono: telefono.trim() });
      // 2. Dirección por defecto
      await addressService.create({
        tipo: 'residencia',
        direccion: direccion.trim(),
        ciudad: 'Gigante, Huila',
        telefono: telefono.trim(),
        notas: notas.trim() || null,
        barrio_id: Number(barrioId),
        es_default: true,
      });
      // 3. Refrescar el usuario en el contexto
      await refreshUser();
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar. Intenta de nuevo.');
      setSaving(false);
    }
  };

  return (
    // z-[90]: por DEBAJO del LegalModal (z-100), así el legal siempre va
    // primero y este aparece recién cuando el legal se cierra.
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[color:var(--bg-elevated)] w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-y-auto animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-primary text-white px-6 py-6 relative">
          <button
            onClick={onSkip}
            aria-label="Completar más tarde"
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-all"
          >
            <X size={22} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MapPin size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading leading-tight">
                Completa tu perfil
              </h2>
              <p className="text-white/85 text-sm">
                {user?.nombre ? `¡Hola, ${user.nombre.split(' ')[0]}! ` : ''}
                Necesitamos tu dirección para tus pedidos.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="alert alert-error text-sm">{error}</div>}

          {sinZonas && !sectoresLoading && (
            <div className="alert alert-warning text-xs sm:text-sm">
              Aún no hay sectores/barrios configurados. Pídele al administrador que los cree.
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1.5">Teléfono</label>
            <div className="flex items-stretch">
              <span className="flex items-center justify-center px-3.5 rounded-l-xl border border-r-0 border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)]">
                <Phone size={18} />
              </span>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="input rounded-l-none flex-1 min-w-0"
                placeholder="300 123 4567"
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="input"
              placeholder="Calle 5 #12-45, Gigante, Huila"
              autoComplete="street-address"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Sector</label>
              <div className="relative">
                <select
                  value={sectorId}
                  onChange={handleSectorChange}
                  className="input appearance-none pr-10"
                  required
                  disabled={sectoresLoading || sinZonas}
                >
                  <option value="">
                    {sectoresLoading ? 'Cargando sectores…' : 'Selecciona un sector'}
                  </option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Barrio</label>
              <div className="relative">
                <select
                  value={barrioId}
                  onChange={(e) => setBarrioId(e.target.value)}
                  className="input appearance-none pr-10"
                  required
                  disabled={!sectorId}
                >
                  <option value="">
                    {sectorId ? 'Selecciona un barrio' : 'Primero selecciona un sector'}
                  </option>
                  {barriosDelSector.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Notas para la entrega <span className="text-[color:var(--text-muted)] font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="input"
              placeholder="Ej: casa de dos pisos, portón azul"
            />
          </div>

          <button type="submit" disabled={saving || sinZonas} className="btn btn-primary w-full">
            {saving ? 'Guardando…' : 'Guardar y continuar'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-center text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
          >
            Completar más tarde
          </button>
        </form>
      </div>
    </div>
  );
}
