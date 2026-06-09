import { useState, useEffect } from 'react';
import { paymentService } from '../services/api';
import { Wallet, Smartphone, QrCode, Save, CheckCircle, AlertCircle } from 'lucide-react';

const DEFAULT_CONFIG = {
  nequi: { telefono: '', titular: '' },
  daviplata: { telefono: '', titular: '' },
  bre_b: { clave: '', titular: '' }
};

export default function PaymentConfigView() {
  const [paymentConfig, setPaymentConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPaymentConfig();
  }, []);

  const loadPaymentConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await paymentService.getPaymentConfig('me');
      const config = response.data.configuracion || {};
      setPaymentConfig({
        nequi: { ...DEFAULT_CONFIG.nequi, ...config.nequi },
        daviplata: { ...DEFAULT_CONFIG.daviplata, ...config.daviplata },
        bre_b: { ...DEFAULT_CONFIG.bre_b, ...config.bre_b },
      });
    } catch (err) {
      console.error('Error cargando configuración de pagos:', err);
      setError(err.response?.data?.error || 'No se pudo cargar la configuración de pagos');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfigChange = (method, field, value) => {
    setPaymentConfig(prev => ({
      ...prev,
      [method]: {
        ...prev[method],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccess(false);
      setError('');
      await paymentService.updatePaymentConfig(paymentConfig);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración de pagos:', err);
      setError(err.response?.data?.error || 'Error guardando configuración de pagos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-lg py-12 text-center text-gray-500">
        <p>Cargando configuración de pagos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-dark">Configuración de Pagos</h2>
            <p className="text-sm text-gray-600">Configura tus métodos de pago para que los clientes puedan transferir</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-start gap-3">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">¡Configuración guardada exitosamente!</span>
        </div>
      )}

      <div className="card-lg">
        <div className="space-y-6">
          {/* Nequi */}
          <div className="border border-purple-200 rounded-xl p-5 bg-purple-50/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                <Smartphone size={16} />
              </div>
              <h3 className="text-lg font-bold text-dark">Nequi</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Nequi</label>
                <input
                  type="text"
                  value={paymentConfig.nequi.telefono}
                  onChange={(e) => handlePaymentConfigChange('nequi', 'telefono', e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.nequi.titular}
                  onChange={(e) => handlePaymentConfigChange('nequi', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Daviplata */}
          <div className="border border-red-200 rounded-xl p-5 bg-red-50/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <Wallet size={16} />
              </div>
              <h3 className="text-lg font-bold text-dark">Daviplata</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Daviplata</label>
                <input
                  type="text"
                  value={paymentConfig.daviplata.telefono}
                  onChange={(e) => handlePaymentConfigChange('daviplata', 'telefono', e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.daviplata.titular}
                  onChange={(e) => handlePaymentConfigChange('daviplata', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* BRE-B */}
          <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <QrCode size={16} />
              </div>
              <h3 className="text-lg font-bold text-dark">BRE-B</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clave BRE-B</label>
                <input
                  type="text"
                  value={paymentConfig.bre_b.clave}
                  onChange={(e) => handlePaymentConfigChange('bre_b', 'clave', e.target.value)}
                  placeholder="Tu clave de BRE-B"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.bre_b.titular}
                  onChange={(e) => handlePaymentConfigChange('bre_b', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Botón de guardar */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>

          {/* Nota informativa */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              <strong>Nota:</strong> Los clientes verán esta información cuando seleccionen el método de pago en el checkout.
              Asegúrate de que los números y nombres sean correctos para evitar problemas con los pagos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
