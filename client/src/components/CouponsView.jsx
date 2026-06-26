import { useEffect, useState } from 'react';
import { couponService } from '../services/api';
import { Ticket, Plus, Pencil, Trash2, AlertCircle, Calendar, Percent, DollarSign, Copy } from 'lucide-react';

function CouponModal({ isOpen, onClose, onSave, coupon, restaurant }) {
  const [formData, setFormData] = useState({
    codigo: '',
    descuento: '',
    tipo_descuento: 'porcentaje',
    fecha_expiracion: '',
    min_compra: '',
    usos_maximos: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (coupon) {
      setFormData({
        codigo: coupon.codigo || '',
        descuento: coupon.descuento || '',
        tipo_descuento: coupon.tipo_descuento || 'porcentaje',
        fecha_expiracion: coupon.fecha_expiracion ? coupon.fecha_expiracion.split('T')[0] : '',
        min_compra: coupon.min_compra || '',
        usos_maximos: coupon.usos_maximos || '',
      });
    } else {
      setFormData({
        codigo: '',
        descuento: '',
        tipo_descuento: 'porcentaje',
        fecha_expiracion: '',
        min_compra: '',
        usos_maximos: '',
      });
    }
  }, [coupon]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        descuento: parseFloat(formData.descuento),
        min_compra: formData.min_compra ? parseFloat(formData.min_compra) : null,
        usos_maximos: formData.usos_maximos ? parseInt(formData.usos_maximos, 10) : null,
      };

      if (coupon) {
        await couponService.update(coupon.id, payload);
      } else {
        await couponService.create(payload);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando cupón');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-scaleUp">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <Ticket size={20} />
            </div>
            <h3 className="text-xl font-bold text-[color:var(--text-primary)]">{coupon ? 'Editar Cupón' : 'Nuevo Cupón'}</h3>
          </div>

          {error && (
            <div className="mb-4 alert alert-error rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Código *</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ej: DESCUENTO20"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Descuento *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.descuento}
                  onChange={(e) => setFormData({ ...formData, descuento: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Tipo *</label>
                <select
                  value={formData.tipo_descuento}
                  onChange={(e) => setFormData({ ...formData, tipo_descuento: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="fijo">Fijo ($)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Fecha de Expiración</label>
              <input
                type="date"
                value={formData.fecha_expiracion}
                onChange={(e) => setFormData({ ...formData, fecha_expiracion: e.target.value })}
                className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Mín. Compra</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_compra}
                  onChange={(e) => setFormData({ ...formData, min_compra: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Usos Máximos</label>
                <input
                  type="number"
                  min="1"
                  value={formData.usos_maximos}
                  onChange={(e) => setFormData({ ...formData, usos_maximos: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-bold text-[color:var(--text-secondary)] bg-[color:var(--bg-muted)] hover:bg-[color:var(--border-default)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primaryDark shadow-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : coupon ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coupon.codigo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date();
  const discountLabel = coupon.tipo_descuento === 'porcentaje'
    ? `${coupon.descuento}%`
    : `$${Number(coupon.descuento).toLocaleString('es-CO')}`;

  return (
    <div className={`border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] ${isExpired ? 'opacity-60' : 'hover:shadow-sm'} transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold font-mono">
              {coupon.codigo}
            </span>
            {isExpired && (
              <span className="px-2 py-1 bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] rounded-lg text-xs font-semibold">
                Expirado
              </span>
            )}
            {coupon.usos_maximos !== null && (
              <span
                className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
              >
                Máx: {coupon.usos_maximos}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-[color:var(--text-secondary)] mb-2">
            <div className="flex items-center gap-1">
              {coupon.tipo_descuento === 'porcentaje' ? <Percent size={14} /> : <DollarSign size={14} />}
              <span className="font-semibold text-[color:var(--text-primary)]">{discountLabel} de descuento</span>
            </div>
            {coupon.min_compra && (
              <div className="flex items-center gap-1">
                <DollarSign size={14} />
                <span>Mín: ${Number(coupon.min_compra).toLocaleString('es-CO')}</span>
              </div>
            )}
          </div>

          {coupon.fecha_expiracion && (
            <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
              <Calendar size={12} />
              <span>Expira: {new Date(coupon.fecha_expiracion).toLocaleDateString('es-CO')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 text-[color:var(--text-muted)] hover:text-primary transition-colors"
            title="Copiar código"
          >
            <Copy size={18} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(coupon)}
            className="p-2 text-[color:var(--text-muted)] hover:text-primary transition-colors"
            title="Editar"
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(coupon)}
            className="p-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Eliminar"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {copied && (
        <div className="mt-2 text-xs font-medium animate-fadeIn" style={{ color: 'var(--success-text)' }}>
          ¡Código copiado!
        </div>
      )}
    </div>
  );
}

export default function CouponsView({ restaurant, refreshData }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [deletingCouponId, setDeletingCouponId] = useState(null);

  const isBasicPlan = restaurant?.plan === 'basico';

  const loadCoupons = async () => {
    try {
      setError('');
      setLoading(true);
      const response = await couponService.getMyCoupons();
      setCoupons(response.data?.cupones || []);
    } catch (err) {
      console.error('Error cargando cupones:', err);
      setError(err.response?.data?.error || 'No se pudieron cargar los cupones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurant?.id) {
      loadCoupons();
    }
  }, [restaurant?.id]);

  const handleSave = async () => {
    await loadCoupons();
    if (refreshData) {
      await refreshData();
    }
  };

  const handleEdit = (coupon) => {
    setSelectedCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`¿Estás seguro de eliminar el cupón "${coupon.codigo}"?`)) return;

    try {
      setDeletingCouponId(coupon.id);
      await couponService.delete(coupon.id);
      await loadCoupons();
    } catch (err) {
      console.error('Error eliminando cupón:', err);
      setError(err.response?.data?.error || 'No se pudo eliminar el cupón');
    } finally {
      setDeletingCouponId(null);
    }
  };

  const openNewCouponModal = () => {
    setSelectedCoupon(null);
    setIsModalOpen(true);
  };

  if (isBasicPlan) {
    return (
      <div className="card-lg p-12 text-center">
        <div className="w-20 h-20 bg-[color:var(--bg-muted)] text-[color:var(--text-subtle)] rounded-full flex items-center justify-center mx-auto mb-6">
          <Ticket size={40} />
        </div>
        <h2 className="text-2xl font-heading font-bold text-[color:var(--text-primary)] mb-2">
          Cupones no disponibles en tu plan
        </h2>
        <p className="text-[color:var(--text-secondary)] max-w-lg mx-auto mb-6">
          La creación y gestión de cupones está disponible únicamente para los planes
          <span className="font-semibold text-primary"> Profesional</span> y{' '}
          <span className="font-semibold text-primary">Premium</span>.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-semibold text-sm">
          <AlertCircle size={16} />
          Plan actual: <span className="uppercase">{restaurant?.plan || 'Básico'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Ticket size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Gestión de Cupones</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">Crea y administra descuentos para tus clientes</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNewCouponModal}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Cupón
        </button>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
          <p>Cargando cupones...</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="card-lg py-12 text-center">
          <div className="w-16 h-16 bg-[color:var(--bg-muted)] text-[color:var(--text-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket size={32} />
          </div>
          <p className="text-[color:var(--text-secondary)]">No tienes cupones creados todavía</p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">Crea tu primer cupón para ofrecer descuentos a tus clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CouponModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCoupon(null);
        }}
        onSave={handleSave}
        coupon={selectedCoupon}
        restaurant={restaurant}
      />
    </div>
  );
}
