import { useState, useEffect } from 'react';
import { Save, DollarSign, Percent, Truck, X } from 'lucide-react';
import { adminService } from '../services/api';

export default function TaxShippingConfigModal({ isOpen, onClose, onSucceeded, restaurant }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Configuración de impuestos
  const [taxConfig, setTaxConfig] = useState({
    activo: true,
    porcentaje: 8
  });

  // Configuración de envíos
  const [shippingConfig, setShippingConfig] = useState({
    activo: false,
    costo_fijo: 0,
    envio_gratis_activo: false,
    envio_gratis_desde: 50000
  });

  useEffect(() => {
    if (restaurant) {
      // Cargar configuración existente
      const defaultTax = { activo: true, porcentaje: 8 };
      const defaultShipping = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 50000 };

      const taxConfig = restaurant.configuracion_impuestos || defaultTax;
      const shippingConfig = restaurant.configuracion_envios || defaultShipping;

      setTaxConfig({
        activo: taxConfig.activo ?? defaultTax.activo,
        porcentaje: taxConfig.porcentaje ?? defaultTax.porcentaje
      });
      setShippingConfig({
        activo: shippingConfig.activo ?? defaultShipping.activo,
        costo_fijo: shippingConfig.costo_fijo ?? defaultShipping.costo_fijo,
        envio_gratis_activo: shippingConfig.envio_gratis_activo ?? defaultShipping.envio_gratis_activo,
        envio_gratis_desde: shippingConfig.envio_gratis_desde ?? defaultShipping.envio_gratis_desde
      });
    }
  }, [restaurant]);

  if (!isOpen) return null;

  const handleClose = () => {
    setError('');
    setSuccess('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await adminService.updateRestaurantConfig(restaurant.id, {
        configuracion_impuestos: {
          activo: taxConfig.activo,
          porcentaje: parseFloat(taxConfig.porcentaje) || 0
        },
        configuracion_envios: {
          activo: shippingConfig.activo,
          costo_fijo: parseFloat(shippingConfig.costo_fijo) || 0,
          envio_gratis_activo: shippingConfig.envio_gratis_activo,
          envio_gratis_desde: parseFloat(shippingConfig.envio_gratis_desde) || 0
        }
      });

      setSuccess('Configuración guardada exitosamente');
      setTimeout(() => {
        onSucceeded();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto animate-scaleIn">
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <DollarSign size={24} />
            <h2 className="text-xl font-bold">Configurar Impuestos y Envíos</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm border border-green-200">
              {success}
            </div>
          )}

          {/* Sección de Impuestos */}
          <div className="border rounded-xl p-5 bg-gray-50">
            <div className="flex items-center gap-2 mb-4">
              <Percent size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-dark">Impuestos</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="tax_activo"
                  checked={taxConfig.activo}
                  onChange={(e) => setTaxConfig({ ...taxConfig, activo: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="tax_activo" className="font-semibold text-gray-700">
                  Activar impuestos en pedidos
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Porcentaje de impuesto (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxConfig.porcentaje}
                    onChange={(e) => setTaxConfig({ ...taxConfig, porcentaje: e.target.value })}
                    disabled={!taxConfig.activo}
                    className="input pl-12 disabled:bg-gray-200"
                  />
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ej: 8 para 8%, 0 para no cobrar impuestos
                </p>
              </div>
            </div>
          </div>

          {/* Sección de Envíos */}
          <div className="border rounded-xl p-5 bg-gray-50">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-dark">Envíos</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="shipping_activo"
                  checked={shippingConfig.activo}
                  onChange={(e) => setShippingConfig({ ...shippingConfig, activo: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="shipping_activo" className="font-semibold text-gray-700">
                  Cobrar costo de envío
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
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
                    className="input pl-12 disabled:bg-gray-200"
                  />
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Costo base del envío para todos los pedidos
                </p>
              </div>

              <div className="flex items-center gap-3 pl-1">
                <input
                  type="checkbox"
                  id="envio_gratis_activo"
                  checked={shippingConfig.envio_gratis_activo}
                  onChange={(e) => setShippingConfig({ ...shippingConfig, envio_gratis_activo: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                  disabled={!shippingConfig.activo}
                />
                <label htmlFor="envio_gratis_activo" className="font-semibold text-gray-700">
                  Habilitar envío gratis por superar monto
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
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
                    className="input pl-12 disabled:bg-gray-200"
                  />
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pedidos superiores a este monto tienen envío gratis
                </p>
              </div>

              {shippingConfig.activo && shippingConfig.envio_gratis_activo && shippingConfig.envio_gratis_desde > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <p className="font-semibold">Información:</p>
                  <p>
                    El envío costará <strong>${Number(shippingConfig.costo_fijo).toLocaleString('es-CO')}</strong> para pedidos menores a{' '}
                    <strong>${Number(shippingConfig.envio_gratis_desde).toLocaleString('es-CO')}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-dark transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary px-6 py-2 text-sm font-bold inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="spinner-spinner-sm inline"></div>
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
        </form>
      </div>
    </div>
  );
}
