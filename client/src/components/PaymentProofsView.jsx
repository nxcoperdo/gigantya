import { useEffect, useState } from 'react';
import { paymentService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { FileText, CheckCircle, XCircle, Eye, AlertCircle, Calendar, User, RefreshCcw } from 'lucide-react';

export default function PaymentProofsView({ refreshData }) {
  const [pendingProofs, setPendingProofs] = useState([]);
  const [historyProofs, setHistoryProofs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProof, setSelectedProof] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProofId, setConfirmProofId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadProofs();
  }, []);

  const loadProofs = async () => {
    try {
      setLoading(true);
      setError('');

      // Cargar pendientes
      const pendingRes = await paymentService.getPendingProofs();
      setPendingProofs(pendingRes.data?.comprobantes || []);

      // Cargar historial (últimos 10)
      const historyRes = await paymentService.getProofsHistory();
      setHistoryProofs(historyRes.data?.comprobantes?.slice(0, 10) || []);
    } catch (err) {
      console.error('Error cargando comprobantes:', err);
      setError(err.response?.data?.error || 'No se pudieron cargar los comprobantes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (proofId) => {
    setConfirmProofId(proofId);
    setConfirmOpen(true);
  };

  const confirmApprove = async () => {
    if (!confirmProofId) return;

    try {
      setProcessingId(confirmProofId);
      setConfirmOpen(false);
      await paymentService.approveProof(confirmProofId);
      await loadProofs();
      if (refreshData) await refreshData();
    } catch (err) {
      console.error('Error aprobando pago:', err);
      alert(err.response?.data?.error || 'Error aprobando el pago');
    } finally {
      setProcessingId(null);
      setConfirmProofId(null);
    }
  };

  const handleReject = async (proofId) => {
    if (!rejectReason.trim()) {
      setRejectError('El motivo del rechazo es obligatorio. Por favor, explica por qué estás rechazando este comprobante.');
      return;
    }

    try {
      setProcessingId(proofId);
      setRejectError('');
      await paymentService.rejectProof(proofId, rejectReason);
      setRejectReason('');
      setIsModalOpen(false);
      setSelectedProof(null);
      await loadProofs();
    } catch (err) {
      console.error('Error rechazando pago:', err);
      alert(err.response?.data?.error || 'Error rechazando el pago');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (proof) => {
    setSelectedProof(proof);
    setIsModalOpen(true);
  };

  const getStatusBadge = (estado) => {
    const badges = {
      pendiente: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' },
      aprobado:  { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' },
      rechazado: { backgroundColor: 'var(--danger-bg)',  color: 'var(--danger-text)',  borderColor: 'var(--danger-border)' }
    };
    return badges[estado] || badges.pendiente;
  };

  const getStatusLabel = (estado) => {
    const labels = {
      pendiente: 'Pendiente',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado'
    };
    return labels[estado] || estado;
  };

  if (loading) {
    return (
      <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
        <p>Cargando comprobantes de pago...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Validación de Pagos</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">Revisa y valida los comprobantes de pago</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadProofs}
          className="btn btn-outline inline-flex items-center gap-2"
        >
          <RefreshCcw size={16} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Comprobantes Pendientes */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-6 rounded-full" style={{ backgroundColor: 'var(--warning-text)' }}></div>
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Pendientes de Validación</h3>
          {pendingProofs.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}
            >
              {pendingProofs.length}
            </span>
          )}
        </div>

        {pendingProofs.length === 0 ? (
          <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
            <p>No hay comprobantes pendientes de validación</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingProofs.map((proof) => (
              <div
                key={proof.id}
                className="card border-2"
                style={{ borderColor: 'var(--warning-border)', backgroundColor: 'var(--warning-bg)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-[color:var(--text-primary)]">Pedido #{proof.pedido_id}</h4>
                    <p className="text-sm text-[color:var(--text-secondary)] flex items-center gap-1 mt-1">
                      <User size={14} />
                      {proof.cliente_nombre}
                    </p>
                    <p className="text-sm text-[color:var(--text-secondary)] flex items-center gap-1 mt-1">
                      <Calendar size={14} />
                      {new Date(proof.fecha_subida).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold border"
                    style={getStatusBadge(proof.estado_validacion)}
                  >
                    {getStatusLabel(proof.estado_validacion)}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-[color:var(--text-muted)] mb-2">Método: <span className="font-semibold text-[color:var(--text-secondary)] uppercase">{proof.metodo_pago}</span></p>
                  <p className="text-xs text-[color:var(--text-muted)] mb-2">Total pedido: <span className="font-bold text-primary">${Number(proof.pedido_total || 0).toLocaleString('es-CO')}</span></p>
                </div>

                {/* Imagen del comprobante */}
                <div className="mb-4 rounded-xl overflow-hidden border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]">
                  <img
                    src={getImageUrl(proof.url_imagen)}
                    alt="Comprobante de pago"
                    className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedProof(proof);
                      setIsModalOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProof(proof);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-2 bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] text-sm font-medium hover:bg-[color:var(--bg-muted)] transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={14} />
                    Ver comprobante en detalle
                  </button>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(proof.id)}
                    disabled={processingId === proof.id}
                    className="flex-1 btn btn-success btn-small inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    {processingId === proof.id ? 'Procesando...' : 'Aprobar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openRejectModal(proof)}
                    disabled={processingId === proof.id}
                    className="flex-1 btn btn-error btn-small inline-flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} />
                    {processingId === proof.id ? 'Procesando...' : 'Rechazar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial */}
      <section className="pt-6 border-t border-[color:var(--border-default)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-6 bg-[color:var(--text-subtle)] rounded-full"></div>
          <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Historial Reciente</h3>
        </div>

        {historyProofs.length === 0 ? (
          <p className="text-[color:var(--text-muted)] text-sm">No hay comprobantes en el historial</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {historyProofs.map((proof) => (
                  <tr key={proof.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[color:var(--text-primary)]">#{proof.pedido_id}</td>
                    <td className="px-4 py-3 text-sm text-[color:var(--text-secondary)]">{proof.cliente_nombre}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase text-[color:var(--text-secondary)]">{proof.metodo_pago}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-semibold border"
                        style={getStatusBadge(proof.estado_validacion)}
                      >
                        {getStatusLabel(proof.estado_validacion)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--text-muted)]">
                      {new Date(proof.fecha_subida).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal para ver comprobante */}
      {isModalOpen && selectedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[color:var(--bg-elevated)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp">
            <div className="sticky top-0 bg-[color:var(--bg-elevated)] border-b border-[color:var(--border-subtle)] p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[color:var(--text-primary)]">Comprobante - Pedido #{selectedProof.pedido_id}</h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedProof(null);
                  setRejectReason('');
                  setRejectError('');
                }}
                className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-full transition-colors"
              >
                <XCircle size={20} className="text-[color:var(--text-muted)]" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Información del comprobante */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[color:var(--text-muted)]">Cliente</p>
                  <p className="font-semibold text-[color:var(--text-primary)]">{selectedProof.cliente_nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-[color:var(--text-muted)]">Teléfono</p>
                  <p className="font-semibold text-[color:var(--text-primary)]">{selectedProof.cliente_telefono || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-[color:var(--text-muted)]">Método de Pago</p>
                  <p className="font-semibold text-[color:var(--text-primary)] uppercase">{selectedProof.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-sm text-[color:var(--text-muted)]">Total Pedido</p>
                  <p className="font-bold text-primary">${Number(selectedProof.pedido_total || 0).toLocaleString('es-CO')}</p>
                </div>
              </div>

              {/* Imagen grande */}
              <div>
                <p className="text-sm text-[color:var(--text-muted)] mb-2">Comprobante</p>
                <img
                  src={getImageUrl(selectedProof.url_imagen)}
                  alt="Comprobante de pago"
                  className="w-full rounded-xl border border-[color:var(--border-default)]"
                />
              </div>

              {/* Estado */}
              <div className="flex items-center gap-2">
                <p className="text-sm text-[color:var(--text-muted)]">Estado:</p>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold border"
                  style={getStatusBadge(selectedProof.estado_validacion)}
                >
                  {getStatusLabel(selectedProof.estado_validacion)}
                </span>
              </div>

              {/* Motivo de rechazo si existe */}
              {selectedProof.motivo_rechazo && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger-text)' }}>Motivo de Rechazo:</p>
                  <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{selectedProof.motivo_rechazo}</p>
                </div>
              )}

              {/* Acciones para pendientes */}
              {selectedProof.estado_validacion === 'pendiente' && (
                <div className="space-y-4 pt-4 border-t border-[color:var(--border-default)]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedProof.id)}
                      disabled={processingId === selectedProof.id}
                      className="flex-1 btn btn-success inline-flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      {processingId === selectedProof.id ? 'Procesando...' : 'Aprobar Pago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(selectedProof.id)}
                      disabled={processingId === selectedProof.id}
                      className="flex-1 btn btn-error inline-flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} />
                      {processingId === selectedProof.id ? 'Procesando...' : 'Rechazar Pago'}
                    </button>
                  </div>

                  {/* Input para motivo de rechazo */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">
                      Motivo de Rechazo *
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value);
                        if (rejectError) setRejectError('');
                      }}
                      placeholder="Ej: El comprobante no es legible, el monto no coincide..."
                      className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                      style={rejectError
                        ? { borderColor: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)' }
                        : { borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }
                      }
                      rows="3"
                    />
                    {rejectError && (
                      <div className="flex items-center gap-1.5 text-xs font-medium animate-shake" style={{ color: 'var(--danger-text)' }}>
                        <AlertCircle size={14} />
                        <span>{rejectError}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de aprobación */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[color:var(--bg-elevated)] shadow-2xl animate-scaleUp">
            <button
              onClick={() => {
                setConfirmOpen(false);
                setConfirmProofId(null);
              }}
              className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--text-subtle)] transition-colors hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--text-secondary)]"
              aria-label="Cerrar"
            >
              <XCircle size={18} />
            </button>

            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                >
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Confirmación</p>
                  <h3 className="text-xl font-bold text-[color:var(--text-primary)]">¿Está seguro de aprobar este pago?</h3>
                </div>
              </div>

              <p className="mb-5 text-[color:var(--text-secondary)]">
                Al aprobar este comprobante, el pago será marcado como válido y no podrá ser revertido.
                ¿Desea continuar con la aprobación?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmProofId(null);
                  }}
                  className="w-full px-4 py-2 bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] rounded-lg hover:bg-[color:var(--bg-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={processingId === confirmProofId}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors"
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
