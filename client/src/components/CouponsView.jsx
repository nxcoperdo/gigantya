import { useEffect, useState } from 'react';
import { couponService, adminService } from '../services/api';
import {
  Ticket, Plus, Pencil, Trash2, AlertCircle,
  Calendar, Percent, DollarSign, Copy, Globe, Store, Lock,
  History, ListChecks, ChevronLeft, ChevronRight, User, Filter, Receipt
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

  // Sub-tab del admin: 'definitions' (cupones, como hoy) o 'usages' (redenciones).
  // Solo se usa cuando isAdmin. En modo local el componente sigue mostrando
  // únicamente las definiciones, sin pestañas.
  const [activeSubTab, setActiveSubTab] = useState('definitions');

  // Estado de la pestaña "Usos / Historial" (solo admin).
  const [usages, setUsages] = useState([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usagesError, setUsagesError] = useState('');
  const [usagesFilters, setUsagesFilters] = useState({
    cupon_id: '',
    restaurante_id: '',
    es_global: '',
    fecha_desde: '',
    fecha_hasta: '',
  });
  const [usagesPage, setUsagesPage] = useState(0); // offset = usagesPage * USAGES_PAGE_SIZE
  const USAGES_PAGE_SIZE = 50;
  const [usagesTotalLoaded, setUsagesTotalLoaded] = useState(0); // total en esta página

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

  /**
   * Carga una página de usos de cupones con los filtros activos.
   * Solo se usa en modo admin y sub-tab 'usages'.
   * El backend devuelve como máximo `limit` filas; si la cantidad
   * recibida es == limit asumimos que podría haber más y habilitamos
   * el botón "Siguiente". (No es exacto, pero es el patrón simple
   * que usa el resto de la app.)
   */
  const loadCouponUsages = async () => {
    if (!isAdmin) return;
    try {
      setUsagesError('');
      setUsagesLoading(true);
      const params = {
        limit: USAGES_PAGE_SIZE,
        offset: usagesPage * USAGES_PAGE_SIZE,
      };
      if (usagesFilters.cupon_id) params.cupon_id = usagesFilters.cupon_id;
      if (usagesFilters.restaurante_id) params.restaurante_id = usagesFilters.restaurante_id;
      if (usagesFilters.es_global) params.es_global = usagesFilters.es_global;
      if (usagesFilters.fecha_desde) params.fecha_desde = usagesFilters.fecha_desde;
      if (usagesFilters.fecha_hasta) params.fecha_hasta = usagesFilters.fecha_hasta;

      const response = await adminService.getCouponUsages(params);
      setUsages(response.data?.usos || []);
      setUsagesTotalLoaded(response.data?.total || 0);
    } catch (err) {
      console.error('Error cargando usos de cupones:', err);
      setUsagesError(err.response?.data?.error || 'No se pudieron cargar los usos de cupones');
    } finally {
      setUsagesLoading(false);
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

  // Cargar usos cada vez que se entra a la sub-tab o cambian filtros / página.
  useEffect(() => {
    if (isAdmin && activeSubTab === 'usages') {
      loadCouponUsages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeSubTab, usagesPage]);

  // Resetear la página a 0 cuando cambia cualquier filtro de la sub-tab usages.
  useEffect(() => {
    setUsagesPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usagesFilters.cupon_id, usagesFilters.restaurante_id, usagesFilters.es_global, usagesFilters.fecha_desde, usagesFilters.fecha_hasta]);

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
        {activeSubTab === 'definitions' && (
          <button
            type="button"
            onClick={openNewCouponModal}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Nuevo Cupón
          </button>
        )}
      </div>

      {/* Sub-tabs del admin: Definiciones vs Usos / Historial. */}
      {isAdmin && (
        <nav className="flex gap-1.5 p-1.5 bg-[color:var(--bg-muted)] rounded-2xl w-fit border border-[color:var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveSubTab('definitions')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'definitions'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-base)]/60'
            }`}
          >
            <Ticket size={16} />
            Definiciones
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('usages')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'usages'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-base)]/60'
            }`}
          >
            <History size={16} />
            Usos / Historial
          </button>
        </nav>
      )}

      {activeSubTab === 'definitions' && (
        <>
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
        </>
      )}

      {/* Sub-tab: Usos / Historial (solo admin). */}
      {isAdmin && activeSubTab === 'usages' && (
        <CouponUsagesView
          usages={usages}
          loading={usagesLoading}
          error={usagesError}
          filters={usagesFilters}
          setFilters={setUsagesFilters}
          page={usagesPage}
          setPage={setUsagesPage}
          pageSize={USAGES_PAGE_SIZE}
          totalLoaded={usagesTotalLoaded}
          coupons={coupons}
          restaurants={restaurants}
          onRefresh={loadCouponUsages}
        />
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

/**
 * Sub-vista: Usos / Historial de cupones.
 *
 * Recibe todo el state ya controlado por el padre (CouponsView):
 * filtros, paginación, datos crudos. Renderiza:
 *   - Filtros (cupón, local, alcance, rango de fechas)
 *   - Resumen: total redenciones y suma de descuentos aplicados
 *   - Tabla con cada redención: fecha, cupón, local, cliente,
 *     subtotal, descuento, total cobrado, estado del pedido
 *   - Paginación simple (Anterior / Siguiente)
 */
function CouponUsagesView({
  usages,
  loading,
  error,
  filters,
  setFilters,
  page,
  setPage,
  pageSize,
  totalLoaded,
  coupons,
  restaurants,
  onRefresh,
}) {
  // Calculamos un resumen: total de redenciones en la página actual
  // y suma de descuentos aplicados. Útil para "cuánto se ha descontado
  // en total en este filtro".
  const totalUsos = usages.length;
  const totalDescuento = usages.reduce(
    (sum, u) => sum + (Number(u.descuento_aplicado) || 0),
    0
  );
  const totalFacturado = usages.reduce(
    (sum, u) => sum + (Number(u.pedido_total) || 0),
    0
  );

  // Helpers de UI ------------------------------------------------------------
  const formatMoney = (n) =>
    `$${Number(n || 0).toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  // Color de badge para el estado del pedido (mismo patrón que usa
  // el resto del admin en AdminDashboardPage).
  const estadoBadgeStyle = (estado) => {
    if (estado === 'Entregado') {
      return { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' };
    }
    if (estado === 'Cancelado') {
      return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' };
    }
    return { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' };
  };

  const clearFilters = () => {
    setFilters({
      cupon_id: '',
      restaurante_id: '',
      es_global: '',
      fecha_desde: '',
      fecha_hasta: '',
    });
  };

  const hasAnyFilter =
    filters.cupon_id ||
    filters.restaurante_id ||
    filters.es_global ||
    filters.fecha_desde ||
    filters.fecha_hasta;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card-base p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={16} className="text-[color:var(--text-muted)]" />
          <span className="text-sm font-semibold text-[color:var(--text-secondary)]">Filtros</span>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs font-semibold text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
              Cupón
            </label>
            <select
              value={filters.cupon_id}
              onChange={(e) => setFilters({ ...filters, cupon_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              {Array.isArray(coupons) && coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
              Local
            </label>
            <select
              value={filters.restaurante_id}
              onChange={(e) => setFilters({ ...filters, restaurante_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos los locales</option>
              {Array.isArray(restaurants) && restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
              Alcance
            </label>
            <select
              value={filters.es_global}
              onChange={(e) => setFilters({ ...filters, es_global: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              <option value="1">Solo globales</option>
              <option value="0">Solo de local</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-base p-4">
          <p className="text-xs text-[color:var(--text-muted)] font-medium mb-1">Redenciones en esta página</p>
          <p className="text-2xl font-heading font-bold text-[color:var(--text-primary)]">{totalUsos}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-xs text-[color:var(--text-muted)] font-medium mb-1">Descuento total aplicado</p>
          <p className="text-2xl font-heading font-bold text-[color:var(--text-primary)]">{formatMoney(totalDescuento)}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-xs text-[color:var(--text-muted)] font-medium mb-1">Total facturado</p>
          <p className="text-2xl font-heading font-bold text-[color:var(--text-primary)]">{formatMoney(totalFacturado)}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
          <p>Cargando usos...</p>
        </div>
      ) : usages.length === 0 ? (
        <div className="card-lg py-12 text-center">
          <div className="w-16 h-16 bg-[color:var(--bg-muted)] text-[color:var(--text-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={32} />
          </div>
          <p className="text-[color:var(--text-secondary)] font-semibold">
            {hasAnyFilter
              ? 'No hay usos que coincidan con los filtros'
              : 'Todavía no hay redenciones de cupones'}
          </p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            {hasAnyFilter
              ? 'Prueba limpiar los filtros o ampliar el rango de fechas'
              : 'Los pedidos que apliquen un cupón aparecerán acá'}
          </p>
        </div>
      ) : (
        <>
          <div className="card-base overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[color:var(--bg-subtle)] text-xs uppercase text-[color:var(--text-muted)] font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cupón</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Descuento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {usages.map((u) => {
                  const isGlobal = u.cupon_es_global === 1 || u.cupon_es_global === true;
                  const discountLabel = u.cupon_tipo_descuento === 'porcentaje'
                    ? `${u.cupon_descuento}%`
                    : formatMoney(u.cupon_descuento);
                  return (
                    <tr key={`${u.pedido_id}-${u.cupon_id}`} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                      <td className="px-4 py-3 text-xs text-[color:var(--text-muted)] whitespace-nowrap">
                        {formatDate(u.pedido_creado_en)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-bold font-mono">
                            {u.cupon_codigo}
                          </span>
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            ({discountLabel})
                          </span>
                          {isGlobal && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                              style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                              title="Cupón global de plataforma"
                            >
                              <Globe size={10} />
                              Global
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.restaurante_nombre ? (
                          <div className="inline-flex items-center gap-1 text-sm text-[color:var(--text-primary)]">
                            <Store size={12} className="text-[color:var(--text-muted)]" />
                            {u.restaurante_nombre}
                          </div>
                        ) : (
                          <span className="text-xs text-[color:var(--text-muted)] italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)] inline-flex items-center gap-1">
                            <User size={12} className="text-[color:var(--text-muted)]" />
                            {u.cliente_nombre || '—'}
                          </span>
                          {u.cliente_email && (
                            <span className="text-[10px] text-[color:var(--text-muted)]">{u.cliente_email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--text-secondary)]">
                        {formatMoney(u.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: 'var(--success-text)' }}>
                        −{formatMoney(u.descuento_aplicado)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-[color:var(--text-primary)]">
                        {formatMoney(u.pedido_total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={estadoBadgeStyle(u.pedido_estado)}
                        >
                          {u.pedido_estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-[color:var(--text-muted)]">
              Mostrando {page * pageSize + 1}–{page * pageSize + usages.length}
              {totalLoaded > 0 && ` de ${totalLoaded} redenciones en esta página`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(Math.max(0, page - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/50"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <span className="text-xs text-[color:var(--text-muted)] font-medium">
                Página {page + 1}
              </span>
              <button
                type="button"
                disabled={usages.length < pageSize}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/50"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={onRefresh}
                className="ml-2 text-xs font-semibold text-primary hover:underline"
                title="Refrescar"
              >
                Refrescar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
