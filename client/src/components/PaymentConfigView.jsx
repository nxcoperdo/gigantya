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
      <div className="card-lg py-12 text-center text-[color:var(--text-muted)]">
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
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">Configuración de Pagos</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">Configura tus métodos de pago para que los clientes puedan transferir</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error rounded-xl">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success rounded-xl">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">¡Configuración guardada exitosamente!</span>
        </div>
      )}

      <div className="card-lg">
        <div className="space-y-6">
          {/* Nequi */}
          <div
            className="border rounded-xl p-5"
            style={{ borderColor: 'var(--accent-purple-border, var(--border-subtle))', backgroundColor: 'var(--accent-purple-bg)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-purple-bg)', color: 'var(--accent-purple-text)' }}
              >
                <Smartphone size={16} />
              </div>
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Nequi</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Número de Nequi</label>
                <input
                  type="text"
                  value={paymentConfig.nequi.telefono}
                  onChange={(e) => handlePaymentConfigChange('nequi', 'telefono', e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 outline-none transition-all"
                  style={{ '--tw-ring-color': 'var(--accent-purple-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.nequi.titular}
                  onChange={(e) => handlePaymentConfigChange('nequi', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Daviplata */}
          <div
            className="border rounded-xl p-5"
            style={{ borderColor: 'var(--danger-border)', backgroundColor: 'var(--danger-bg)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}
              >
                <Wallet size={16} />
              </div>
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Daviplata</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Número de Daviplata</label>
                <input
                  type="text"
                  value={paymentConfig.daviplata.telefono}
                  onChange={(e) => handlePaymentConfigChange('daviplata', 'telefono', e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.daviplata.titular}
                  onChange={(e) => handlePaymentConfigChange('daviplata', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* BRE-B */}
          <div
            className="border rounded-xl p-5"
            style={{ borderColor: 'var(--info-border)', backgroundColor: 'var(--info-bg)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
              >
                <QrCode size={16} />
              </div>
              <h3 className="text-lg font-bold text-[color:var(--text-primary)]">BRE-B</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Clave BRE-B</label>
                <input
                  type="text"
                  value={paymentConfig.bre_b.clave}
                  onChange={(e) => handlePaymentConfigChange('bre_b', 'clave', e.target.value)}
                  placeholder="Tu clave de BRE-B"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Titular</label>
                <input
                  type="text"
                  value={paymentConfig.bre_b.titular}
                  onChange={(e) => handlePaymentConfigChange('bre_b', 'titular', e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-blue-400 outline-none transition-all"
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
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--warning-text)' }}>
              <strong>Nota:</strong> Los clientes verán esta información cuando seleccionen el método de pago en el checkout.
              Asegúrate de que los números y nombres sean correctos para evitar problemas con los pagos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
