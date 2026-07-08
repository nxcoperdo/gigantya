import { useEffect, useState, useCallback } from 'react';
import { History, CheckCircle, XCircle, ShieldAlert, User, Store, FileText, RefreshCcw, AlertCircle, Filter } from 'lucide-react';
import { adminService } from '../services/api';
import { formatDate, formatDateTime } from '../utils/dateHelper';

/**
 * Vista de auditoría para el admin.
 *
 * Lista los logs de acciones del admin con filtros:
 *  - acción
 *  - entidad (restaurante, usuario, comprobante, plan, modalidad)
 *  - rango de fechas
 *
 * Paginación: botón "Cargar más" incrementa offset en 100.
 */
const ACCIONES = [
  { value: 'restaurante.approve', label: 'Aprobar local' },
  { value: 'restaurante.reject', label: 'Rechazar local' },
  { value: 'comprobante.approve', label: 'Aprobar comprobante' },
  { value: 'comprobante.reject', label: 'Rechazar comprobante' },
  { value: 'user.status_change', label: 'Cambio de estado de usuario' },
  { value: 'user.update', label: 'Actualización de usuario' },
  { value: 'user.delete', label: 'Eliminar usuario' },
  { value: 'plan.change', label: 'Cambio de plan' },
  { value: 'modalidad.toggle', label: 'Cambio de modalidad' },
];

const ENTIDADES = [
  { value: 'restaurante', label: 'Local' },
  { value: 'usuario', label: 'Usuario' },
  { value: 'comprobante', label: 'Comprobante' },
];

const PAGE_SIZE = 100;

export default function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filterAccion, setFilterAccion] = useState('todas');
  const [filterEntidad, setFilterEntidad] = useState('todas');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const load = useCallback(async (resetOffset = false) => {
    try {
      setLoading(true);
      setError('');
      const newOffset = resetOffset ? 0 : offset;
      const params = {
        limit: PAGE_SIZE,
        offset: newOffset,
      };
      if (filterAccion !== 'todas') params.accion = filterAccion;
      if (filterEntidad !== 'todas') params.entidad_tipo = filterEntidad;
      if (filterDesde) params.desde = `${filterDesde} 00:00:00`;
      if (filterHasta) params.hasta = `${filterHasta} 23:59:59`;

      const res = await adminService.getAuditLogs(params);
      const nuevos = res.data?.logs || [];
      setTotal(res.data?.total || 0);
      if (resetOffset) {
        setLogs(nuevos);
        setOffset(PAGE_SIZE);
      } else {
        setLogs((prev) => [...prev, ...nuevos]);
        setOffset(newOffset + PAGE_SIZE);
      }
    } catch (err) {
      console.error('Error cargando auditoría:', err);
      setError(err.response?.data?.error || 'No se pudieron cargar los logs de auditoría');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filterAccion, filterEntidad, filterDesde, filterHasta]);

  // Carga inicial + al cambiar filtros.
  useEffect(() => {
    setOffset(0);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAccion, filterEntidad, filterDesde, filterHasta]);

  const hasMore = logs.length < total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Auditoría</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {total > 0 ? `${total} acción${total === 1 ? '' : 'es'} registrada${total === 1 ? '' : 's'}` : 'Sin acciones registradas'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setOffset(0); load(true); }}
          className="btn btn-outline inline-flex items-center gap-2"
          aria-label="Refrescar"
        >
          <RefreshCcw size={16} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card-lg">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-[color:var(--text-muted)]" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Filtros</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">Acción</label>
            <select value={filterAccion} onChange={(e) => setFilterAccion(e.target.value)} className="select">
              <option value="todas">Todas</option>
              {ACCIONES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">Entidad</label>
            <select value={filterEntidad} onChange={(e) => setFilterEntidad(e.target.value)} className="select">
              <option value="todas">Todas</option>
              {ENTIDADES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">Desde</label>
            <input
              type="date"
              value={filterDesde}
              onChange={(e) => setFilterDesde(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] text-sm focus:outline-none focus:border-[color:var(--primary-text)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">Hasta</label>
            <input
              type="date"
              value={filterHasta}
              onChange={(e) => setFilterHasta(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] text-sm focus:outline-none focus:border-[color:var(--primary-text)]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Lista */}
      {loading && logs.length === 0 ? (
        <div className="space-y-2">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
          <History size={48} className="mx-auto mb-4 opacity-40" aria-hidden="true" />
          <p className="font-semibold mb-1 text-[color:var(--text-secondary)]">Aún no hay acciones registradas</p>
          <p className="text-sm">
            Las acciones del admin (aprobar locales, suspender usuarios, validar comprobantes)
            aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </ol>
      )}

      {/* Paginación "Cargar más" */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => load(false)}
            className="btn btn-outline"
          >
            Cargar más ({logs.length} de {total})
          </button>
        </div>
      )}

      {loading && logs.length > 0 && (
        <div className="text-center text-sm text-[color:var(--text-muted)]">Cargando…</div>
      )}
    </div>
  );
}

function LogRow({ log }) {
  return (
    <li className="rounded-xl border border-[color:var(--border-subtle)] p-3 hover:bg-[color:var(--bg-subtle)] transition-colors">
      <div className="flex items-start gap-3">
        <AccionIcon accion={log.accion} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            {describeAccion(log)}
          </p>
          <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
            {formatDateTime(log.creado_en)} · por {log.admin_nombre || `admin #${log.admin_id}`}
            {log.ip && <span className="ml-1">· IP {log.ip}</span>}
          </p>
          {(log.datos_antes || log.datos_despues) && (
            <details className="mt-2">
              <summary className="text-[11px] text-[color:var(--primary-text)] cursor-pointer hover:underline">
                Ver diff
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {log.datos_antes && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[color:var(--text-muted)] mb-0.5">Antes</p>
                    <pre className="rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] p-2 text-[10px] overflow-x-auto text-[color:var(--text-secondary)]">
                      {JSON.stringify(log.datos_antes, null, 2)}
                    </pre>
                  </div>
                )}
                {log.datos_despues && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[color:var(--text-muted)] mb-0.5">Después</p>
                    <pre className="rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] p-2 text-[10px] overflow-x-auto text-[color:var(--text-secondary)]">
                      {JSON.stringify(log.datos_despues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

function AccionIcon({ accion }) {
  const map = {
    'restaurante.approve': { Icon: CheckCircle, color: 'var(--success-text)' },
    'restaurante.reject': { Icon: XCircle, color: 'var(--danger-text)' },
    'comprobante.approve': { Icon: CheckCircle, color: 'var(--success-text)' },
    'comprobante.reject': { Icon: XCircle, color: 'var(--danger-text)' },
    'user.status_change': { Icon: ShieldAlert, color: 'var(--warning-text)' },
    'user.delete': { Icon: XCircle, color: 'var(--danger-text)' },
    'user.update': { Icon: User, color: 'var(--primary-text)' },
    'plan.change': { Icon: Store, color: 'var(--primary-text)' },
    'modalidad.toggle': { Icon: Store, color: 'var(--text-secondary)' },
  };
  const { Icon, color } = map[accion] || { Icon: FileText, color: 'var(--text-muted)' };
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: 'var(--bg-subtle)' }}
    >
      <Icon size={14} style={{ color }} aria-hidden="true" />
    </div>
  );
}

function describeAccion(log) {
  const map = {
    'restaurante.approve': `aprobó el local #${log.entidad_id}`,
    'restaurante.reject': `rechazó el local #${log.entidad_id}`,
    'comprobante.approve': `aprobó el comprobante #${log.entidad_id}`,
    'comprobante.reject': `rechazó el comprobante #${log.entidad_id}`,
    'user.status_change': `cambió el estado del usuario #${log.entidad_id}`,
    'user.delete': `eliminó el usuario #${log.entidad_id}`,
    'user.update': `actualizó datos del usuario #${log.entidad_id}`,
    'plan.change': `cambió el plan del local #${log.entidad_id}`,
    'modalidad.toggle': `cambió una modalidad del local #${log.entidad_id}`,
  };
  return map[log.accion] || `${log.accion} (entidad #${log.entidad_id})`;
}
