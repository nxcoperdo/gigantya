import { useEffect, useState, useMemo } from 'react';
import { FileText, CheckCircle, XCircle, Eye, AlertCircle, Calendar, User, RefreshCcw, Store } from 'lucide-react';
import { adminService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { formatDate, formatDateTime } from '../utils/dateHelper';
import { formatCurrency } from '../utils/formatHelper';

/**
 * Vista de comprobantes de pago para el admin (panel global).
 *
 * A diferencia de `PaymentProofsView` (que filtra por el restaurante del
 * usuario logueado), acá el admin ve TODOS los comprobantes de la
 * plataforma, con filtros por:
 *  - estado (todos / pendiente / aprobado / rechazado)
 *  - método de pago
 *  - restaurante
 *
 * Props:
 *  - restaurants: array de restaurantes (del loadData del AdminDashboard).
 *    Se usa para popular el <select> de filtro por local.
 *  - onCountChange: (count: number) => void — emite el conteo de
 *    pendientes para que el padre actualice el badge del tab.
 */
export default function AdminPaymentProofsView({ restaurants = [], onCountChange }) {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProof, setSelectedProof] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProofId, setConfirmProofId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [processingId, setProcessingId] = useState(null);

  // Filtros
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterMetodo, setFilterMetodo] = useState('todos');
  const [filterRestaurante, setFilterRestaurante] = useState('todos');

  const loadComprobantes = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { limit: 200 };
      if (filterEstado !== 'todos') params.estado = filterEstado;
      if (filterMetodo !== 'todos') params.metodo_pago = filterMetodo;
      if (filterRestaurante !== 'todos') params.restaurante_id = filterRestaurante;
      const res = await adminService.getPaymentProofs(params);
      setComprobantes(res.data?.comprobantes || []);
    } catch (err) {
      console.error('Error cargando comprobantes (admin):', err);
      setError(err.response?.data?.error || 'No se pudieron cargar los comprobantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComprobantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEstado, filterMetodo, filterRestaurante]);

  // Notificar al padre el conteo de pendientes para el badge del tab.
  const pendientesCount = useMemo(
    () => comprobantes.filter((c) => c.estado_validacion === 'pendiente').length,
    [comprobantes]
  );
  useEffect(() => {
    if (onCountChange) onCountChange(pendientesCount);
  }, [pendientesCount, onCountChange]);

  const handleApprove = (proofId) => {
    setConfirmProofId(proofId);
    setConfirmOpen(true);
  };

  const confirmApprove = async () => {
    if (!confirmProofId) return;
    try {
      setProcessingId(confirmProofId);
      setConfirmOpen(false);
      await adminService.approvePaymentProofAdmin(confirmProofId);
      await loadComprobantes();
    } catch (err) {
      console.error('Error aprobando pago (admin):', err);
      alert(err.response?.data?.error || 'Error aprobando el pago');
    } finally {
      setProcessingId(null);
      setConfirmProofId(null);
    }
  };

  const handleReject = async (proofId) => {
    if (!rejectReason.trim()) {
      setRejectError('El motivo del rechazo es obligatorio.');
      return;
    }
    try {
      setProcessingId(proofId);
      setRejectError('');
      await adminService.rejectPaymentProofAdmin(proofId, rejectReason);
      setRejectReason('');
      setIsModalOpen(false);
      setSelectedProof(null);
      await loadComprobantes();
    } catch (err) {
      console.error('Error rechazando pago (admin):', err);
      alert(err.response?.data?.error || 'Error rechazando el pago');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con título y refrescar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Comprobantes de Pago</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">Vista global de todos los locales de la plataforma</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadComprobantes}
          className="btn btn-outline inline-flex items-center gap-2"
          aria-label="Refrescar"
        >
          <RefreshCcw size={16} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card-lg flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">
            Estado
          </label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="select"
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">
            Método
          </label>
          <select
            value={filterMetodo}
            onChange={(e) => setFilterMetodo(e.target.value)}
            className="select"
          >
            <option value="todos">Todos</option>
            <option value="nequi">Nequi</option>
            <option value="daviplata">Daviplata</option>
            <option value="bre_b">Bre-B</option>
            <option value="contra_entrega">Contra entrega</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-1">
            Local
          </label>
          <select
            value={filterRestaurante}
            onChange={(e) => setFilterRestaurante(e.target.value)}
            className="select"
          >
            <option value="todos">Todos los locales</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      ) : comprobantes.length === 0 ? (
        <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
          <FileText size={48} className="mx-auto mb-4 opacity-40" aria-hidden="true" />
          <p>No hay comprobantes que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comprobantes.map((proof) => (
            <ProofCard
              key={proof.id}
              proof={proof}
              onView={() => {
                setSelectedProof(proof);
                setIsModalOpen(true);
              }}
              onApprove={() => handleApprove(proof.id)}
              onReject={() => {
                setSelectedProof(proof);
                setIsModalOpen(true);
              }}
              processing={processingId === proof.id}
            />
          ))}
        </div>
      )}

      {/* Modal de detalle + acciones */}
      {isModalOpen && selectedProof && (
        <ProofModal
          proof={selectedProof}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProof(null);
            setRejectReason('');
            setRejectError('');
          }}
          onApprove={() => handleApprove(selectedProof.id)}
          onReject={() => handleReject(selectedProof.id)}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          rejectError={rejectError}
          setRejectError={setRejectError}
          processing={processingId === selectedProof.id}
        />
      )}

      {/* Modal de confirmación de aprobación */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-[color:var(--bg-elevated)] shadow-2xl animate-scaleIn">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmProofId(null);
              }}
              className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--text-secondary)]"
              aria-label="Cerrar"
            >
              <XCircle size={18} />
            </button>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                >
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Confirmación</p>
                  <h3 className="text-xl font-bold text-[color:var(--text-primary)]">¿Aprobar este comprobante?</h3>
                </div>
              </div>
              <p className="mb-5 text-[color:var(--text-secondary)]">
                Se marcará el comprobante como válido. El pedido asociado quedará con el pago aprobado.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmProofId(null);
                  }}
                  className="w-full px-4 py-2 bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] rounded-lg hover:bg-[color:var(--bg-muted)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmApprove}
                  disabled={processingId === confirmProofId}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark disabled:opacity-50"
                >
                  {processingId === confirmProofId ? 'Procesando...' : 'Confirmar Aprobación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Sub-componentes ============================== */

function ProofCard({ proof, onView, onApprove, onReject, processing }) {
  return (
    <div className="card border border-[color:var(--border-subtle)]">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h4 className="font-bold text-[color:var(--text-primary)] truncate">Pedido #{proof.pedido_id}</h4>
          <p className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mt-0.5">
            <User size={12} /> {proof.cliente_nombre}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mt-0.5">
            <Store size={12} /> {proof.restaurante_nombre || '—'}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 mt-0.5">
            <Calendar size={12} /> {formatDateTime(proof.fecha_subida)}
          </p>
        </div>
        <EstadoBadge estado={proof.estado_validacion} />
      </div>
      <div className="mb-3">
        <p className="text-[11px] text-[color:var(--text-muted)] uppercase">{proof.metodo_pago}</p>
        <p className="text-base font-bold text-primary">{formatCurrency(proof.pedido_total)}</p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="w-full rounded-lg overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:opacity-90 transition-opacity"
      >
        <img
          src={getImageUrl(proof.url_imagen)}
          alt={`Comprobante pedido #${proof.pedido_id}`}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
        <span className="block py-1.5 text-xs text-[color:var(--text-secondary)] font-medium flex items-center justify-center gap-1">
          <Eye size={12} /> Ver detalle
        </span>
      </button>
      {proof.estado_validacion === 'pendiente' && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onApprove}
            disabled={processing}
            className="flex-1 btn btn-success btn-small inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle size={14} />
            Aprobar
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={processing}
            className="flex-1 btn btn-error btn-small inline-flex items-center justify-center gap-1.5"
          >
            <XCircle size={14} />
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

function ProofModal({
  proof,
  onClose,
  onApprove,
  onReject,
  rejectReason,
  setRejectReason,
  rejectError,
  setRejectError,
  processing,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadeIn" onClick={onClose}>
      <div
        className="bg-[color:var(--bg-elevated)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">
            Comprobante · Pedido #{proof.pedido_id}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-full"
            aria-label="Cerrar"
          >
            <XCircle size={20} className="text-[color:var(--text-muted)]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label="Cliente" value={proof.cliente_nombre} />
            <DetailRow label="Local" value={proof.restaurante_nombre} />
            <DetailRow label="Teléfono" value={proof.cliente_telefono || '—'} />
            <DetailRow label="Método" value={proof.metodo_pago?.toUpperCase()} />
            <DetailRow label="Total" value={formatCurrency(proof.pedido_total)} />
            <DetailRow label="Subido" value={formatDateTime(proof.fecha_subida)} />
            {proof.validado_por_nombre && (
              <DetailRow
                label={`${proof.estado_validacion === 'aprobado' ? 'Aprobado' : 'Rechazado'} por`}
                value={proof.validado_por_nombre}
              />
            )}
            {proof.fecha_validacion && (
              <DetailRow label="Fecha validación" value={formatDateTime(proof.fecha_validacion)} />
            )}
          </div>

          <div>
            <p className="text-xs text-[color:var(--text-muted)] mb-1">Comprobante</p>
            <img
              src={getImageUrl(proof.url_imagen)}
              alt="Comprobante"
              className="w-full rounded-xl border border-[color:var(--border-default)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-[color:var(--text-muted)]">Estado actual:</p>
            <EstadoBadge estado={proof.estado_validacion} />
          </div>

          {proof.motivo_rechazo && (
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--danger-text)' }}>Motivo de rechazo:</p>
              <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{proof.motivo_rechazo}</p>
            </div>
          )}

          {proof.estado_validacion === 'pendiente' && (
            <div className="space-y-3 pt-3 border-t border-[color:var(--border-default)]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={processing}
                  className="flex-1 btn btn-success inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Aprobar
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[color:var(--text-secondary)] mb-1">
                  Motivo de rechazo (obligatorio para rechazar)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  placeholder="Ej: imagen borrosa, monto no coincide..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  style={
                    rejectError
                      ? { borderColor: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)' }
                      : { borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }
                  }
                />
                {rejectError && (
                  <p className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--danger-text)' }}>
                    <AlertCircle size={12} /> {rejectError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onReject}
                  disabled={processing || !rejectReason.trim()}
                  className="mt-2 w-full btn btn-error inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={16} /> Rechazar comprobante
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[color:var(--text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[color:var(--text-primary)] break-words">{value}</p>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const styles = {
    aprobado: { bg: 'var(--success-bg)', fg: 'var(--success-text)', border: 'var(--success-border)' },
    rechazado: { bg: 'var(--danger-bg)', fg: 'var(--danger-text)', border: 'var(--danger-border)' },
    pendiente: { bg: 'var(--warning-bg)', fg: 'var(--warning-text)', border: 'var(--warning-border)' },
  };
  const s = styles[estado] || styles.pendiente;
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border"
      style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
    >
      {estado}
    </span>
  );
}
