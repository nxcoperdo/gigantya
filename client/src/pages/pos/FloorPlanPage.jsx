/**
 * Página del plano de mesas (POS Fase 2).
 *
 * Funcionalidades:
 *  - Listar mesas del restaurante desde /api/pos/tables.
 *  - Drag/resize de cada mesa (en modo edición), con debounce de 300 ms
 *    para evitar martillar el backend.
 *  - Doble click cambia el estado (ciclo libre → reservada → mantenimiento).
 *  - Suscripción a eventos socket del namespace /orders:
 *      - pos:tables_updated       → reemplazo completo de la mesa.
 *      - pos:table_status_changed → solo cambia estado.
 *  - Crear mesa nueva (modal simple con nombre/capacidad/forma).
 *  - Eliminar mesa (soft-delete: backend la pasa a 'mantenimiento' y le
 *    antepone '(eliminada) ' al nombre).
 *  - Modo edición solo para rol `restaurante` o `admin` (los demás solo ven).
 *
 * Coordenadas y tamaños: el backend guarda pixeles absolutos sobre un
 * canvas virtual. Acá mostramos un canvas de 1200x700 px (con scroll si
 * hace falta) que es cómodo para la mayoría de locales. El zoom se aplica
 * via CSS transform sobre el wrapper interno.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Edit3, Eye, ZoomIn, ZoomOut, RotateCcw, LayoutGrid, Armchair } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import { posTablesService } from '../../services/api';
import socketService from '../../services/socket';
import DraggableTable from '../../components/pos/DraggableTable';
import CreateTableModal from '../../components/pos/CreateTableModal';

const CANVAS_W = 1200;
const CANVAS_H = 700;
const EDITABLE_ROLES = ['restaurante', 'admin'];
const STATUS_LABEL = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  mantenimiento: 'Mantenimiento',
};
const ESTADO_PILL = {
  libre:         'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  ocupada:       'bg-rose-500/15 text-rose-200 border border-rose-500/30',
  reservada:     'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  mantenimiento: 'bg-zinc-500/15 text-zinc-200 border border-zinc-500/30',
};

export default function FloorPlanPage() {
  const { user } = useAuth();
  // Mismo hook que el resto del POS: combina user.restaurante_id (staff)
  // con el restaurante hidratado del Outlet context (dueños).
  const { restauranteId } = usePosRestaurante();
  const editable = EDITABLE_ROLES.includes(user?.tipo_usuario);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Debounce por mesa: guardamos el último valor propuesto y lo enviamos
  // a los 300 ms sin más cambios. Evita golpear la API mientras el user
  // está arrastrando o redimensionando.
  const pendingRef = useRef({}); // { [id]: timeoutId }

  const loadMesas = useCallback(async () => {
    try {
      setLoading(true);
      const r = await posTablesService.list();
      setMesas(r.data.mesas || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Error cargando mesas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMesas(); }, [loadMesas]);

  // Suscripción a sockets: solo si hay restaurante asociado.
  // Para `admin` sin restaurante, no abrimos la sala.
  useEffect(() => {
    if (!restauranteId) return;
    socketService.connectOrders();
    socketService.joinRestaurant(restauranteId, user.id);

    const onUpdated = (payload) => {
      if (!payload?.mesa) return;
      setMesas((prev) => {
        // Si la mesa viene marcada como deleted, la removemos.
        if (payload.deleted) return prev.filter((m) => m.id !== payload.mesa_id);
        const idx = prev.findIndex((m) => m.id === payload.mesa.id);
        if (idx === -1) return [...prev, payload.mesa];
        const next = prev.slice();
        next[idx] = payload.mesa;
        return next;
      });
    };
    const onStatus = (payload) => {
      if (!payload?.mesa) return;
      setMesas((prev) => prev.map((m) => m.id === payload.mesa.id ? payload.mesa : m));
    };
    socketService.onTablesUpdated(onUpdated);
    socketService.onTableStatusChanged(onStatus);
    return () => {
      socketService.off('orders', 'pos:tables_updated');
      socketService.off('orders', 'pos:table_status_changed');
    };
  }, [restauranteId, user?.id]);

  const scheduleSave = useCallback((mesa) => {
    if (!editable) return;
    if (pendingRef.current[mesa.id]) clearTimeout(pendingRef.current[mesa.id]);
    pendingRef.current[mesa.id] = setTimeout(async () => {
      try {
        await posTablesService.update(mesa.id, {
          pos_x: mesa.pos_x, pos_y: mesa.pos_y, ancho: mesa.ancho, alto: mesa.alto,
        });
      } catch (e) {
        setError(e.response?.data?.error || 'Error guardando posición');
      }
    }, 300);
  }, [editable]);

  const cycleStatus = useCallback(async (mesa, nextEstado) => {
    if (!editable) return;
    try {
      // Optimistic update para feedback inmediato.
      setMesas((prev) => prev.map((m) => m.id === mesa.id ? { ...m, estado: nextEstado } : m));
      await posTablesService.setStatus(mesa.id, nextEstado);
    } catch (e) {
      // Revertimos si falla.
      setMesas((prev) => prev.map((m) => m.id === mesa.id ? mesa : m));
      setError(e.response?.data?.error || 'Error cambiando estado');
    }
  }, [editable]);

  const handleDelete = useCallback(async (mesa) => {
    if (!editable) return;
    if (!window.confirm(`¿Eliminar la mesa "${mesa.nombre}"?`)) return;
    try {
      await posTablesService.remove(mesa.id);
      // El socket nos va a confirmar con deleted=true. No removemos localmente
      // para evitar doble-render.
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando mesa');
    }
  }, [editable]);

  const onCreated = useCallback((mesa) => {
    setMesas((prev) => prev.some((m) => m.id === mesa.id) ? prev : [...prev, mesa]);
  }, []);

  const stats = useMemo(() => {
    const total = mesas.length;
    const byEstado = mesas.reduce((acc, m) => {
      acc[m.estado] = (acc[m.estado] || 0) + 1;
      return acc;
    }, {});
    return { total, ...byEstado };
  }, [mesas]);

  if (loading) {
    return <div className="p-8 text-center text-[color:var(--text-muted)]">Cargando plano…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
            aria-hidden="true"
          >
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-[color:var(--text)]">Plano de mesas</h1>
            <p className="text-xs text-[color:var(--text-muted)]">
              {stats.total} mesas · <span className="text-emerald-400 font-semibold">{stats.libre || 0} libres</span> · <span className="text-rose-400 font-semibold">{stats.ocupada || 0} ocupadas</span>
              {stats.reservada ? <> · <span className="text-amber-400 font-semibold">{stats.reservada} reservadas</span></> : ''}
              {stats.mantenimiento ? <> · <span className="text-zinc-400 font-semibold">{stats.mantenimiento} mant.</span></> : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <button
                onClick={() => setEditing((v) => !v)}
                className={[
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-all active:scale-95',
                  editing
                    ? 'bg-[color:var(--primary,#3b82f6)] text-white border-transparent shadow-sm'
                    : 'bg-[color:var(--bg-elevated)] border-[color:var(--border)] hover:bg-[color:var(--bg)]',
                ].join(' ')}
                type="button"
              >
                {editing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                {editing ? 'Salir de edición' : 'Editar plano'}
              </button>
              {editing && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all shadow-sm"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
                  Nueva mesa
                </button>
              )}
            </>
          )}
          <div className="flex items-center gap-0.5 border border-[color:var(--border)] rounded-lg bg-[color:var(--bg-elevated)] p-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              className="p-1.5 rounded-md hover:bg-[color:var(--bg)] transition-colors"
              title="Alejar"
              type="button"
              aria-label="Alejar"
            ><ZoomOut className="w-4 h-4" /></button>
            <span className="px-2 text-xs font-semibold tabular-nums text-[color:var(--text-muted)] min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
              className="p-1.5 rounded-md hover:bg-[color:var(--bg)] transition-colors"
              title="Acercar"
              type="button"
              aria-label="Acercar"
            ><ZoomIn className="w-4 h-4" /></button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-md hover:bg-[color:var(--bg)] transition-colors"
              title="Restablecer"
              type="button"
              aria-label="Restablecer zoom"
            ><RotateCcw className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline font-medium hover:no-underline">Cerrar</button>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg px-3 py-2">
        {Object.entries(STATUS_LABEL).map(([estado, label]) => (
          <span key={estado} className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)] font-medium">
            <span className={`inline-block w-3 h-3 rounded-sm border ${
              estado === 'libre' ? 'bg-emerald-500/40 border-emerald-500/60' :
              estado === 'ocupada' ? 'bg-rose-500/40 border-rose-500/60' :
              estado === 'reservada' ? 'bg-amber-500/40 border-amber-500/60' :
              'bg-zinc-500/40 border-zinc-500/60'
            }`} />
            {label}
          </span>
        ))}
        {editable && editing && (
          <span className="text-[10px] text-[color:var(--text-muted)] italic ml-auto hidden sm:inline">
            💡 Doble click en una mesa para cambiar su estado
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] overflow-auto shadow-sm"
        style={{ maxHeight: '70vh' }}
      >
        <div
          style={{
            width: CANVAS_W * zoom,
            height: CANVAS_H * zoom,
            minWidth: '100%',
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundColor: 'var(--bg)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'relative',
            }}
          >
            {mesas.map((m) => (
              <DraggableTable
                key={m.id}
                mesa={m}
                editable={editing}
                selected={selectedId === m.id}
                onClick={(mesa) => setSelectedId(mesa.id)}
                onChange={(changes) => {
                  // Actualización optimista + debounce a la API.
                  setMesas((prev) => prev.map((x) => x.id === m.id ? { ...x, ...changes } : x));
                  scheduleSave({ id: m.id, ...changes });
                }}
                onStatusChange={cycleStatus}
              />
            ))}
            {mesas.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)] pointer-events-none">
                <div className="text-center bg-[color:var(--bg-elevated)]/80 backdrop-blur-sm px-8 py-6 rounded-2xl border-2 border-dashed border-[color:var(--border)]">
                  <Armchair className="w-10 h-10 mx-auto mb-2 opacity-40" aria-hidden="true" />
                  <p className="text-base font-semibold mb-1">No hay mesas todavía</p>
                  {editable && (
                    <p className="text-sm">Entrá en modo edición y creá la primera.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detalle de la mesa seleccionada */}
      {selectedId && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 shadow-sm animate-fadeIn">
          {(() => {
            const m = mesas.find((x) => x.id === selectedId);
            if (!m) return null;
            const estadoMeta = ESTADO_PILL[m.estado] || ESTADO_PILL.libre;
            return (
              <div className="flex flex-wrap items-start gap-4 justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold">{m.nombre}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${estadoMeta}`}>
                      {STATUS_LABEL[m.estado]}
                    </span>
                  </div>
                  <div className="text-sm text-[color:var(--text-muted)]">
                    Capacidad: <span className="font-semibold text-[color:var(--text)]">{m.capacidad}</span> · Forma: <span className="font-semibold text-[color:var(--text)] capitalize">{m.forma}</span>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] mt-1 font-mono">
                    Pos ({m.pos_x}, {m.pos_y}) · {m.ancho}×{m.alto} px
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editable && (
                    <button
                      onClick={() => handleDelete(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-colors active:scale-95"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedId(null)}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-[color:var(--border)] hover:bg-[color:var(--bg)] transition-colors"
                    type="button"
                  >Cerrar</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showCreate && (
        <CreateTableModal
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}
