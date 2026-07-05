import { useState, useEffect } from 'react';
import { Save, DollarSign, Truck, X, MapPin, Clock } from 'lucide-react';
import { restaurantService, zonaService, restaurantShippingService } from '../services/api';
import { formatDateTime } from '../utils/dateHelper';

/**
 * Modal para que el dueño del restaurante configure:
 *   - Envío maestro (activar + costo fijo fallback + envío gratis por monto)
 *   - Costos de envío por sector
 *
 * Reutiliza los endpoints `/api/restaurants/:id/envios-sectores` (para costos)
 * y `restaurantService.update` (para configuracion_envios).
 *
 * Nota: los impuestos los gestiona únicamente el administrador.
 */
export default function RestaurantShippingTaxModal({ isOpen, onClose, onSucceeded, restaurant }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [shippingConfig, setShippingConfig] = useState({
    activo: false,
    costo_fijo: 0,
    envio_gratis_activo: false,
    envio_gratis_desde: 50000
  });

  const [sectores, setSectores] = useState([]);
  const [costosPorSector, setCostosPorSector] = useState({});
  const [metaPorSector, setMetaPorSector] = useState({}); // { sector_id: { actualizado_por_nombre, actualizado_por_tipo, actualizado_en } }
  const [sectoresLoading, setSectoresLoading] = useState(false);

  // Cargar config inicial del restaurante
  useEffect(() => {
    if (restaurant) {
      const defaultShipping = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 50000 };

      const sc = restaurant.configuracion_envios || defaultShipping;

      setShippingConfig({
        activo: sc.activo ?? defaultShipping.activo,
        costo_fijo: sc.costo_fijo ?? defaultShipping.costo_fijo,
        envio_gratis_activo: sc.envio_gratis_activo ?? defaultShipping.envio_gratis_activo,
        envio_gratis_desde: sc.envio_gratis_desde ?? defaultShipping.envio_gratis_desde
      });
    }
  }, [restaurant]);

  // Cargar sectores y costos cuando se abre
  useEffect(() => {
    if (!isOpen || !restaurant) return;

    const fetchData = async () => {
      try {
        setSectoresLoading(true);
        const [sectoresRes, costosRes] = await Promise.all([
          zonaService.getSectores(),
          restaurantShippingService.getEnviosSectoresRestaurant(restaurant.id)
        ]);

        const listaSectores = sectoresRes.data.sectores || [];
        setSectores(listaSectores);

        const costos = {};
        const meta = {};
        const costosList = costosRes.data.sectores || [];
        for (const item of costosList) {
          costos[item.sector_id] = Number(item.costo) || 0;
          meta[item.sector_id] = {
            actualizado_por_nombre: item.actualizado_por_nombre || null,
            actualizado_por_tipo: item.actualizado_por_tipo || null,
            actualizado_en: item.actualizado_en || null
          };
        }
        setCostosPorSector(costos);
        setMetaPorSector(meta);
      } catch (err) {
        console.error('Error cargando sectores/costos:', err);
        setError('No se pudieron cargar los sectores o los costos por sector.');
      } finally {
        setSectoresLoading(false);
      }
    };

    fetchData();
  }, [isOpen, restaurant]);

  if (!isOpen) return null;

  const handleClose = () => {
    setError('');
    setSuccess('');
    onClose();
  };

  const handleCostoSectorChange = (sectorId, value) => {
    const num = parseFloat(value);
    setCostosPorSector(prev => ({
      ...prev,
      [sectorId]: Number.isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1) Actualizar config de envío (los impuestos los gestiona el admin)
      await restaurantService.update(restaurant.id, {
        configuracion_envios: {
          activo: shippingConfig.activo,
          costo_fijo: parseFloat(shippingConfig.costo_fijo) || 0,
          envio_gratis_activo: shippingConfig.envio_gratis_activo,
          envio_gratis_desde: parseFloat(shippingConfig.envio_gratis_desde) || 0
        }
      });

      // 2) Actualizar costos por sector (reemplazo total)
      const sectoresPayload = sectores.map(s => ({
        sector_id: Number(s.id),
        costo: Number(costosPorSector[s.id] ?? 0)
      }));
      await restaurantShippingService.replaceEnviosSectoresRestaurant(restaurant.id, sectoresPayload);

      setSuccess('Configuración guardada exitosamente');
      setTimeout(() => {
        if (onSucceeded) onSucceeded();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const sectoresConCosto = Object.values(costosPorSector).filter(c => Number(c) > 0).length;
  const tieneCostosPorSector = sectoresConCosto > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 sm:p-6">
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-2xl w-full mx-auto animate-scaleIn flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <DollarSign size={24} />
            <h2 className="text-xl font-bold">Configurar Envíos</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          {/* Switch maestro: ACTIVAR ENVÍOS */}
          <div
            className="border-2 rounded-xl p-5 transition-all"
            style={{
              backgroundColor: shippingConfig.activo ? 'var(--success-bg)' : 'var(--warning-bg)',
              borderColor: shippingConfig.activo ? 'var(--success-border)' : 'var(--warning-border)'
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  id="shipping_activo_maestro_rest"
                  checked={shippingConfig.activo}
                  onChange={(e) => setShippingConfig({ ...shippingConfig, activo: e.target.checked })}
                  className="w-6 h-6 text-primary rounded focus:ring-primary cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="shipping_activo_maestro_rest" className="flex items-center gap-2 font-bold text-base cursor-pointer text-[color:var(--text-primary)]">
                  <Truck size={20} style={{ color: shippingConfig.activo ? 'var(--success-text)' : 'var(--warning-text)' }} />
                  ¿Cobrar envío en los pedidos?
                </label>
                <p
                  className="text-sm mt-1"
                  style={{ color: shippingConfig.activo ? 'var(--success-text)' : 'var(--warning-text)' }}
                >
                  {shippingConfig.activo ? (
                    <>✅ Envío <strong>ACTIVO</strong>. Se cobrará según el sector del cliente (o el costo fijo global si el sector no tiene precio).</>
                  ) : (
                    <>⚠️ Envío <strong>DESACTIVADO</strong>. El cliente no pagará envío aunque configures valores abajo. Activa esta opción para que los costos apliquen.</>
                  )}
                </p>
                {!shippingConfig.activo && tieneCostosPorSector && (
                  <p
                    className="text-xs mt-2 font-semibold inline-block px-2 py-1 rounded"
                    style={{
                      color: 'var(--warning-text)',
                      backgroundColor: 'var(--warning-bg)',
                      border: '1px solid var(--warning-border)'
                    }}
                  >
                    Tienes {sectoresConCosto} sector(es) con costo configurado pero el envío está apagado — no se cobrarán.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Envío fijo (fallback) */}
          <div className="border border-[color:var(--border-default)] rounded-xl p-5 bg-[color:var(--bg-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              <Truck size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Envío fijo (fallback)</h3>
            </div>
            <p className="text-xs text-[color:var(--text-muted)] mb-4">
              Costo que se cobra cuando el sector del cliente no tiene un valor configurado.
            </p>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[color:var(--bg-elevated)] border border-[color:var(--border-default)]">
              <input
                type="checkbox"
                id="shipping_activo_local_rest"
                checked={shippingConfig.activo}
                onChange={(e) => setShippingConfig({ ...shippingConfig, activo: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-primary cursor-pointer"
              />
              <label htmlFor="shipping_activo_local_rest" className="font-semibold text-[color:var(--text-secondary)] cursor-pointer flex-1">
                Activar cobro de envío
              </label>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: shippingConfig.activo ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: shippingConfig.activo ? 'var(--success-text)' : 'var(--warning-text)',
                  border: `1px solid ${shippingConfig.activo ? 'var(--success-border)' : 'var(--warning-border)'}`
                }}
              >
                {shippingConfig.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[color:var(--text-primary)]">
                  Costo fijo de envío ($)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={shippingConfig.costo_fijo}
                    onChange={(e) => setShippingConfig({ ...shippingConfig, costo_fijo: e.target.value })}
                    disabled={!shippingConfig.activo}
                    className="input pl-10 disabled:bg-[color:var(--bg-muted)]"
                  />
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-subtle)] pointer-events-none" size={16} />
                </div>
              </div>

              <div className="flex items-center gap-3 pl-1">
                <input
                  type="checkbox"
                  id="envio_gratis_activo_rest"
                  checked={shippingConfig.envio_gratis_activo}
                  onChange={(e) => setShippingConfig({ ...shippingConfig, envio_gratis_activo: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                  disabled={!shippingConfig.activo}
                />
                <label htmlFor="envio_gratis_activo_rest" className="font-semibold text-[color:var(--text-secondary)]">
                  Habilitar envío gratis por superar monto
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-[color:var(--text-primary)]">
                  Envío gratis desde ($)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={shippingConfig.envio_gratis_desde}
                    onChange={(e) => setShippingConfig({ ...shippingConfig, envio_gratis_desde: e.target.value })}
                    disabled={!shippingConfig.activo || !shippingConfig.envio_gratis_activo}
                    className="input pl-10 disabled:bg-[color:var(--bg-muted)]"
                  />
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-subtle)] pointer-events-none" size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Costos por sector */}
          <div className="border border-[color:var(--border-default)] rounded-xl p-5 bg-[color:var(--bg-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Costos de envío por sector</h3>
            </div>
            <p className="text-xs text-[color:var(--text-muted)] mb-4">
              Define cuánto cobrar según el sector de la dirección del cliente. Si dejas un sector en $0,
              se usará el costo fijo global como fallback.
            </p>

            {!shippingConfig.activo && (
              <div
              className="mb-4 rounded-lg p-3 text-sm"
              style={{
                color: 'var(--warning-text)',
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)'
              }}
            >
              <strong>Los valores de abajo no se cobrarán</strong> porque el switch maestro de envío está desactivado.
            </div>
            )}

            {sectoresLoading ? (
              <div className="flex justify-center py-6">
                <div className="spinner spinner-sm"></div>
              </div>
            ) : sectores.length === 0 ? (
              <p className="text-sm text-[color:var(--text-secondary)]">
                Aún no hay sectores configurados. Pídele al administrador que cree algunos primero.
              </p>
            ) : (
              <div className="space-y-3">
                {sectores.map(s => {
                  const meta = metaPorSector[s.id] || {};
                  const autorTipo = meta.actualizado_por_tipo;
                  const autorNombre = meta.actualizado_por_nombre;
                  const autorFecha = meta.actualizado_en;
                  const autorEsAdmin = autorTipo === 'admin';
                  const autorEsRestaurante = autorTipo === 'restaurante';
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 items-center">
                        <label className="text-sm font-semibold text-[color:var(--text-primary)] sm:col-span-2">
                          {s.nombre}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={costosPorSector[s.id] ?? 0}
                            onChange={(e) => handleCostoSectorChange(s.id, e.target.value)}
                            disabled={!shippingConfig.activo}
                            placeholder="0"
                            className="input pl-10 disabled:bg-[color:var(--bg-muted)] disabled:opacity-60"
                          />
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-subtle)] pointer-events-none" size={16} />
                        </div>
                      </div>
                      {(autorNombre || autorFecha) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)] pl-1 flex-wrap">
                          <Clock size={11} />
                          <span>Última edición:</span>
                          {autorNombre && (
                            <span
                              className="font-semibold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: autorEsAdmin
                                  ? 'var(--accent-purple-bg)'
                                  : autorEsRestaurante
                                    ? 'var(--accent-blue-bg)'
                                    : 'var(--neutral-bg)',
                                color: autorEsAdmin
                                  ? 'var(--accent-purple-text)'
                                  : autorEsRestaurante
                                    ? 'var(--accent-blue-text)'
                                    : 'var(--neutral-text)',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              {autorNombre} ({autorEsAdmin ? 'admin' : autorEsRestaurante ? 'local' : autorTipo || 'sistema'})
                            </span>
                          )}
                          {autorFecha && (
                            <span>{formatDateTime(autorFecha)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Botones fijos al pie */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary px-6 py-2 text-sm font-bold inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="spinner spinner-sm inline"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}