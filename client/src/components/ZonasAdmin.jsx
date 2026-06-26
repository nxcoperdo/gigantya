import { useEffect, useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, Save, X, Building2, Tag, AlertCircle } from 'lucide-react';
import { zonaAdminService } from '../services/api';

export default function ZonasAdmin() {
  const [sectores, setSectores] = useState([]);
  const [barrios, setBarrios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state
  const [sectorModal, setSectorModal] = useState({ isOpen: false, sector: null });
  const [barrioModal, setBarrioModal] = useState({ isOpen: false, barrio: null });
  const [sectorFiltro, setSectorFiltro] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [sectoresRes, barriosRes] = await Promise.all([
        zonaAdminService.getSectores(),
        zonaAdminService.getBarrios()
      ]);
      setSectores(sectoresRes.data.sectores || []);
      setBarrios(barriosRes.data.barrios || []);
    } catch (err) {
      console.error('Error cargando zonas:', err);
      setError(err.response?.data?.error || 'Error cargando sectores y barrios');
    } finally {
      setLoading(false);
    }
  };

  const barriosFiltrados = sectorFiltro
    ? barrios.filter(b => Number(b.sector_id) === Number(sectorFiltro))
    : barrios;

  // ========== HANDLERS SECTOR ==========
  const handleSaveSector = async (formData) => {
    try {
      setError('');
      if (sectorModal.sector) {
        await zonaAdminService.updateSector(sectorModal.sector.id, formData);
        setSuccess('Sector actualizado');
      } else {
        await zonaAdminService.createSector(formData);
        setSuccess('Sector creado');
      }
      setSectorModal({ isOpen: false, sector: null });
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando sector');
    }
  };

  const handleDeleteSector = async (id) => {
    if (!window.confirm('¿Eliminar este sector? Esto también eliminará TODOS los barrios y costos de envío asociados.')) return;
    try {
      setError('');
      await zonaAdminService.deleteSector(id);
      setSuccess('Sector eliminado');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando sector');
    }
  };

  const handleToggleSectorActivo = async (s) => {
    try {
      await zonaAdminService.updateSector(s.id, { activo: !s.activo });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error actualizando sector');
    }
  };

  // ========== HANDLERS BARRIO ==========
  const handleSaveBarrio = async (formData) => {
    try {
      setError('');
      if (barrioModal.barrio) {
        await zonaAdminService.updateBarrio(barrioModal.barrio.id, formData);
        setSuccess('Barrio actualizado');
      } else {
        await zonaAdminService.createBarrio(formData);
        setSuccess('Barrio creado');
      }
      setBarrioModal({ isOpen: false, barrio: null });
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando barrio');
    }
  };

  const handleDeleteBarrio = async (id) => {
    if (!window.confirm('¿Eliminar este barrio? Las direcciones y pedidos que lo usen quedarán sin barrio asignado.')) return;
    try {
      setError('');
      await zonaAdminService.deleteBarrio(id);
      setSuccess('Barrio eliminado');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando barrio');
    }
  };

  const handleToggleBarrioActivo = async (b) => {
    try {
      await zonaAdminService.updateBarrio(b.id, { activo: !b.activo });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error actualizando barrio');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert alert-error animate-slideDown">✕ {error}</div>
      )}
      {success && (
        <div className="alert alert-success animate-slideDown">✓ {success}</div>
      )}

      {/* ============ SECTORES ============ */}
      <section className="card-lg overflow-hidden animate-fadeIn">
        <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)] flex items-center gap-2">
              <Building2 className="text-primary" size={24} /> Sectores
            </h2>
            <p className="text-sm text-[color:var(--text-muted)] mt-1">
              Zonas globales de la ciudad (Centro, Sur, Norte, etc.) para agrupar barrios.
            </p>
          </div>
          <button
            onClick={() => setSectorModal({ isOpen: true, sector: null })}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> Nuevo Sector
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
              <tr>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Ciudad</th>
                <th className="px-6 py-3">Orden</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-subtle)]">
              {sectores.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-[color:var(--text-muted)]">
                    No hay sectores. Crea el primero (ej. Centro) para empezar.
                  </td>
                </tr>
              ) : (
                sectores.map(s => (
                  <tr key={s.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <td className="px-6 py-4 font-semibold text-[color:var(--text-primary)]">{s.nombre}</td>
                    <td className="px-6 py-4 text-sm text-[color:var(--text-secondary)]">{s.ciudad || '—'}</td>
                    <td className="px-6 py-4 text-sm text-[color:var(--text-secondary)]">{s.orden}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleSectorActivo(s)}
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={s.activo
                          ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }
                          : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }
                        }
                      >
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSectorModal({ isOpen: true, sector: s })}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteSector(s.id)}
                          className="p-2 rounded-lg"
                          style={{ color: 'var(--danger-text)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ BARRIOS ============ */}
      <section className="card-lg overflow-hidden animate-fadeIn">
        <div className="p-6 border-b border-[color:var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)] flex items-center gap-2">
              <MapPin className="text-primary" size={24} /> Barrios
            </h2>
            <p className="text-sm text-[color:var(--text-muted)] mt-1">
              Cada barrio pertenece a un sector. El cliente selecciona barrio al guardar dirección y al hacer checkout.
            </p>
          </div>
          <button
            onClick={() => setBarrioModal({ isOpen: true, barrio: null })}
            className="btn btn-primary inline-flex items-center gap-2"
            disabled={sectores.length === 0}
          >
            <Plus size={16} /> Nuevo Barrio
          </button>
        </div>

        {/* Filtro por sector */}
        <div className="p-4 bg-[color:var(--bg-subtle)] border-b border-[color:var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-[color:var(--text-secondary)]">Filtrar por sector:</label>
            <select
              value={sectorFiltro}
              onChange={(e) => setSectorFiltro(e.target.value)}
              className="input max-w-xs"
            >
              <option value="">Todos los sectores</option>
              {sectores.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <span className="text-xs text-[color:var(--text-muted)]">
              ({barriosFiltrados.length} de {barrios.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
              <tr>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Sector</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-subtle)]">
              {barriosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-[color:var(--text-muted)]">
                    {sectorFiltro
                      ? 'No hay barrios en este sector.'
                      : 'No hay barrios. Crea al menos un sector primero y luego agrega barrios.'}
                  </td>
                </tr>
              ) : (
                barriosFiltrados.map(b => (
                  <tr key={b.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <td className="px-6 py-4 font-semibold text-[color:var(--text-primary)]">{b.nombre}</td>
                    <td className="px-6 py-4 text-sm text-[color:var(--text-secondary)]">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                      >
                        <Tag size={12} /> {b.sector_nombre}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleBarrioActivo(b)}
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={b.activo
                          ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }
                          : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }
                        }
                      >
                        {b.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setBarrioModal({ isOpen: true, barrio: b })}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteBarrio(b.id)}
                          className="p-2 rounded-lg"
                          style={{ color: 'var(--danger-text)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ INFO ============ */}
      <div
        className="card-lg p-4 flex gap-3 items-start"
        style={{ backgroundColor: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <AlertCircle style={{ color: 'var(--info-text)' }} className="flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm" style={{ color: 'var(--info-text)' }}>
          <p className="font-semibold mb-1">¿Cómo se usan?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>El cliente selecciona un barrio al guardar una dirección y al hacer checkout.</li>
            <li>El barrio determina el sector, y cada restaurante tiene configurado un costo de envío por sector.</li>
            <li>Si un barrio no tiene sector configurado en un restaurante, se usa el costo de envío global como fallback.</li>
          </ul>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      {sectorModal.isOpen && (
        <SectorModal
          sector={sectorModal.sector}
          onClose={() => setSectorModal({ isOpen: false, sector: null })}
          onSave={handleSaveSector}
        />
      )}
      {barrioModal.isOpen && (
        <BarrioModal
          barrio={barrioModal.barrio}
          sectores={sectores.filter(s => s.activo)}
          onClose={() => setBarrioModal({ isOpen: false, barrio: null })}
          onSave={handleSaveBarrio}
        />
      )}
    </div>
  );
}

// ====== MODAL SECTOR ======
function SectorModal({ sector, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nombre: sector?.nombre || '',
    ciudad: sector?.ciudad || 'Gigante, Huila',
    orden: sector?.orden ?? 0,
    activo: sector?.activo ?? true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;
    onSave({
      ...formData,
      orden: Number(formData.orden) || 0
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{sector ? 'Editar Sector' : 'Nuevo Sector'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              required
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Centro, Sur, Norte…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Ciudad</label>
            <input
              type="text"
              value={formData.ciudad}
              onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Orden (menor = primero)</label>
            <input
              type="number"
              value={formData.orden}
              onChange={(e) => setFormData(prev => ({ ...prev, orden: e.target.value }))}
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium">Sector activo</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)]">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md inline-flex items-center justify-center gap-2">
              <Save size={18} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====== MODAL BARRIO ======
function BarrioModal({ barrio, sectores, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nombre: barrio?.nombre || '',
    sector_id: barrio?.sector_id || (sectores[0]?.id ?? ''),
    activo: barrio?.activo ?? true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.sector_id) return;
    onSave({
      ...formData,
      sector_id: Number(formData.sector_id)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{barrio ? 'Editar Barrio' : 'Nuevo Barrio'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              required
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Las Brisas, Centro, etc."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--text-muted)] uppercase">Sector *</label>
            <select
              value={formData.sector_id}
              onChange={(e) => setFormData(prev => ({ ...prev, sector_id: e.target.value }))}
              required
              className="w-full p-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Selecciona un sector</option>
              {sectores.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {sectores.length === 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger-text)' }}>Crea primero al menos un sector activo.</p>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium">Barrio activo</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)]">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md inline-flex items-center justify-center gap-2">
              <Save size={18} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}