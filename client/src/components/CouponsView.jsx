import { useEffect, useState } from 'react';
import { couponService, adminService } from '../services/api';
import {
  Ticket, Plus, Pencil, Trash2, AlertCircle,
  Calendar, Percent, DollarSign, Copy, Globe, Store, Lock
} from 'lucide-react';
import { formatDate } from '../utils/dateHelper';

/**
 * Modal para crear/editar un cupón.
 *
 * Props:
 *   - isOpen, onClose, onSave
 *   - coupon: el cupón a editar (null = creación)
 *   - mode: 'restaurant' | 'admin'
 *       - 'restaurant': el cupón SIEMPRE es del local del caller.
 *         El toggle no se muestra (o se muestra fijo en "local").
 *       - 'admin': el admin puede elegir entre cupón global o cupón
 *         de un local específico. Si elige local, debe elegir el
 *         restaurante en un select.
 *   - restaurants: lista de restaurantes para el selector (solo admin).
 */
function CouponModal({ isOpen, onClose, onSave, coupon, mode = 'restaurant', restaurants = [] }) {
  const isAdmin = mode === 'admin';
  const [formData, setFormData] = useState({
    codigo: '',
    descuento: '',
    tipo_descuento: 'porcentaje',
    fecha_expiracion: '',
    min_compra: '',
    max_compra: '',
    usos_maximos: '',
    es_global: !isAdmin ? false : true,
    restaurante_id: '',
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
        max_compra: coupon.max_compra || '',
        usos_maximos: coupon.usos_maximos || '',
        es_global: coupon.es_global === 1 || coupon.es_global === true,
        restaurante_id: coupon.restaurante_id || '',
      });
    } else {
      setFormData({
        codigo: '',
        descuento: '',
        tipo_descuento: 'porcentaje',
        fecha_expiracion: '',
        min_compra: '',
        max_compra: '',
        usos_maximos: '',
        es_global: !isAdmin ? false : true,
        restaurante_id: '',
      });
    }
  }, [coupon, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        descuento: parseFloat(formData.descuento),
        min_compra: formData.min_compra ? parseFloat(formData.min_compra) : null,
        max_compra: formData.max_compra ? parseFloat(formData.max_compra) : null,
        usos_maximos: formData.usos_maximos ? parseInt(formData.usos_maximos, 10) : null,
      };

      if (isAdmin) {
        payload.es_global = formData.es_global === true;
        if (!payload.es_global) {
          // Cupón de local específico: necesitamos restaurante_id
          if (!formData.restaurante_id) {
            setError('Seleccioná un local para el cupón');
            setLoading(false);
            return;
          }
          payload.restaurante_id = parseInt(formData.restaurante_id, 10);
        } else {
          // Global: explícitamente null para que el backend no use el valor viejo
          payload.restaurante_id = null;
        }
      } else {
        // Modo local: nunca es global
        payload.es_global = false;
        delete payload.restaurante_id;
      }

      // Validación de UI: coherencia min/max antes de enviar al server
      if (payload.min_compra !== null && payload.max_compra !== null
          && payload.max_compra < payload.min_compra) {
        setError('El monto máximo debe ser mayor o igual al monto mínimo');
        setLoading(false);
        return;
      }

      // Decidir qué servicio usar
      if (isAdmin) {
        if (coupon) {
          await adminService.updateCoupon(coupon.id, payload);
        } else {
          await adminService.createCoupon(payload);
        }
      } else {
        if (coupon) {
          await couponService.update(coupon.id, payload);
        } else {
          await couponService.create(payload);
        }
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
            <h3 className="text-xl font-bold text-[color:var(--text-primary)]">
              {coupon ? 'Editar Cupón' : 'Nuevo Cupón'}
            </h3>
          </div>

          {error && (
            <div className="mb-4 alert alert-error rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Toggle de alcance (solo admin) */}
            {isAdmin && (
              <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] p-3">
                <p className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
                  Alcance del cupón
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, es_global: true, restaurante_id: '' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                      formData.es_global
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary/50'
                    }`}
                  >
                    <Globe size={16} />
                    Global (plataforma)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, es_global: false })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                      !formData.es_global
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary/50'
                    }`}
                  >
                    <Store size={16} />
                    Para un local
                  </button>
                </div>

                {!formData.es_global && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-[color:var(--text-secondary)] mb-1">
                      Local *
                    </label>
                    <select
                      value={formData.restaurante_id}
                      onChange={(e) => setFormData({ ...formData, restaurante_id: e.target.value })}
                      className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    >
                      <option value="">Seleccioná un local</option>
                      {Array.isArray(restaurants) && restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

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

            <div className="grid grid-cols-3 gap-4">
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
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Máx. Compra</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.max_compra}
                  onChange={(e) => setFormData({ ...formData, max_compra: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Sin tope"
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

/**
 * Card de un cupón individual.
 *
 * `puede_editar` (viene del backend en el payload del local): si es
 * false (típicamente para cupones globales en la vista del local),
 * los botones de editar/borrar se deshabilitan con tooltip.
 *
 * Si `restaurante_nombre` viene (vista admin), se muestra el nombre
 * del local o "Plataforma" si es global.
 */
function CouponCard({ coupon, onEdit, onDelete, mode = 'restaurant' }) {
  const [copied, setCopied] = useState(false);
  const isAdmin = mode === 'admin';
  const isExpired = coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date();
  const isGlobal = coupon.es_global === 1 || coupon.es_global === true;
  const canEdit = isAdmin || coupon.puede_editar !== 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coupon.codigo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discountLabel = coupon.tipo_descuento === 'porcentaje'
    ? `${coupon.descuento}%`
    : `$${Number(coupon.descuento).toLocaleString('es-CO')}`;

  return (
    <div className={`border border-[color:var(--border-default)] rounded-xl p-4 bg-[color:var(--bg-elevated)] ${isExpired ? 'opacity-60' : 'hover:shadow-sm'} transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold font-mono">
              {coupon.codigo}
            </span>
            {isGlobal && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                title={isAdmin ? 'Cupón global de plataforma' : 'Administrado por la plataforma'}
              >
                <Globe size={12} />
                {isAdmin ? 'Global' : 'Plataforma'}
              </span>
            )}
            {!isGlobal && isAdmin && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]"
                title="Cupón de un local específico"
              >
                <Store size={12} />
                {coupon.restaurante_nombre || `Local #${coupon.restaurante_id}`}
              </span>
            )}
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
            {coupon.activo === 0 && (
              <span
                className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}
              >
                Pausado
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-[color:var(--text-secondary)] mb-2 flex-wrap">
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
            {coupon.max_compra && (
              <div className="flex items-center gap-1">
                <DollarSign size={14} />
                <span>Máx: ${Number(coupon.max_compra).toLocaleString('es-CO')}</span>
              </div>
            )}
          </div>

          {coupon.fecha_expiracion && (
            <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
              <Calendar size={12} />
              <span>Expira: {formatDate(coupon.fecha_expiracion)}</span>
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
            onClick={() => canEdit && onEdit(coupon)}
            disabled={!canEdit}
            className="p-2 text-[color:var(--text-muted)] hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[color:var(--text-muted)]"
            title={canEdit ? 'Editar' : 'Cupón administrado por la plataforma'}
          >
            {canEdit ? <Pencil size={18} /> : <Lock size={18} />}
          </button>
          <button
            type="button"
            onClick={() => canEdit && onDelete(coupon)}
            disabled={!canEdit}
            className="p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={canEdit ? 'Eliminar' : 'Cupón administrado por la plataforma'}
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

/**
 * Componente principal: gestión de cupones.
 *
 * Props:
 *   - mode: 'restaurant' (default) | 'admin'
 *       - 'restaurant': muestra solo los del local + los globales (read-only).
 *       - 'admin': muestra TODOS los cupones de la plataforma y permite
 *         crear/editar/borrar cualquiera.
 *   - restaurant: info del local (solo en modo 'restaurant'). Usado
 *       para detectar plan 'basico' y mostrar el upsell.
 *   - refreshData: callback opcional para refrescar datos del padre.
 */
export default function CouponsView({ mode = 'restaurant', restaurant, refreshData }) {
  const isAdmin = mode === 'admin';
  const [coupons, setCoupons] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [filtroRestaurante, setFiltroRestaurante] = useState('');

  const isBasicPlan = !isAdmin && restaurant?.plan === 'basico';

  const loadCoupons = async () => {
    try {
      setError('');
      setLoading(true);
      if (isAdmin) {
        const params = {};
        if (filtroRestaurante === 'global') {
          params.es_global = 1;
        } else if (filtroRestaurante) {
          params.restaurante_id = filtroRestaurante;
        }
        const response = await adminService.getCoupons(params);
        setCoupons(response.data?.cupones || []);
      } else {
        const response = await couponService.getMyCoupons();
        setCoupons(response.data?.cupones || []);
      }
    } catch (err) {
      console.error('Error cargando cupones:', err);
      setError(err.response?.data?.error || 'No se pudieron cargar los cupones');
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurants = async () => {
    if (!isAdmin) return;
    try {
      // El backend devuelve { total, restaurantes: [...] }, NO un array
      // directo. Hay que leer response.data.restaurantes.
      const response = await adminService.getRestaurants();
      setRestaurants(response.data?.restaurantes || []);
    } catch (err) {
      console.error('Error cargando locales:', err);
    }
  };

  useEffect(() => {
    loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filtroRestaurante]);

  useEffect(() => {
    if (isAdmin) {
      loadRestaurants();
    }
  }, [isAdmin]);

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
      if (isAdmin) {
        await adminService.deleteCoupon(coupon.id);
      } else {
        await couponService.delete(coupon.id);
      }
      await loadCoupons();
    } catch (err) {
      console.error('Error eliminando cupón:', err);
      setError(err.response?.data?.error || 'No se pudo eliminar el cupón');
    }
  };

  const openNewCouponModal = () => {
    setSelectedCoupon(null);
    setIsModalOpen(true);
  };

  // Upsell: solo aparece en modo 'restaurant' con plan basico.
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

  // Header copy cambia según el modo.
  const headerTitle = isAdmin ? 'Cupones de la plataforma' : 'Gestión de Cupones';
  const headerSubtitle = isAdmin
    ? 'Crea cupones globales que aplican a toda la plataforma o para locales específicos'
    : 'Crea y administra descuentos para tus clientes';
  const emptyTitle = isAdmin
    ? 'No hay cupones en la plataforma'
    : 'No tienes cupones creados todavía';
  const emptyHint = isAdmin
    ? 'Creá el primer cupón global para ofrecer descuentos a todos los clientes'
    : 'Crea tu primer cupón para ofrecer descuentos a tus clientes';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Ticket size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">{headerTitle}</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">{headerSubtitle}</p>
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

      {/* Filtro por local (solo admin) */}
      {isAdmin && (
        <div className="card-base p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-[color:var(--text-secondary)]">Filtrar:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFiltroRestaurante('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filtroRestaurante === ''
                  ? 'bg-primary text-white border-primary'
                  : 'bg-[color:var(--bg-base)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary/50'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroRestaurante('global')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filtroRestaurante === 'global'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-[color:var(--bg-base)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary/50'
              }`}
            >
              <Globe size={14} />
              Solo globales
            </button>
            {Array.isArray(restaurants) && restaurants.length > 0 && (
              <select
                value={filtroRestaurante === 'global' ? '' : filtroRestaurante}
                onChange={(e) => setFiltroRestaurante(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Por local…</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

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
          <p className="text-[color:var(--text-secondary)]">{emptyTitle}</p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">{emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={handleEdit}
              onDelete={handleDelete}
              mode={mode}
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
        mode={mode}
        restaurants={restaurants}
      />
    </div>
  );
}
