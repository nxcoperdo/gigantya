import { useState, useEffect } from 'react';
import { Wallet, Banknote, Smartphone, Upload, AlertCircle, QrCode } from 'lucide-react';
import api from '../services/api';

export default function PaymentMethodSelector({ selectedMethod, onMethodChange, restauranteId, onProofSelect }) {
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [comprobantePreview, setComprobantePreview] = useState('');

  useEffect(() => {
    if (restauranteId) {
      loadPaymentConfig();
    }
  }, [restauranteId]);

  const loadPaymentConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payments/config/${restauranteId}`);
      setPaymentConfig(response.data.configuracion);
    } catch (err) {
      console.error('Error cargando configuración de pagos:', err);
      setError('No se pudo cargar la configuración de pagos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5MB');
      return;
    }

    setError('');
    setComprobanteFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setComprobantePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setComprobanteFile(null);
    setComprobantePreview('');
    if (onProofSelect) onProofSelect(null);
  };

  const handleProofSelect = () => {
    if (comprobanteFile && onProofSelect) {
      onProofSelect(comprobanteFile);
    }
  };

  useEffect(() => {
    if (comprobanteFile && onProofSelect) {
      onProofSelect(comprobanteFile);
    }
  }, [comprobanteFile, onProofSelect]);

  const methods = [
    {
      id: 'contra_entrega',
      name: 'Contra Entrega',
      description: 'Pagas en efectivo al recibir tu pedido',
      icon: Banknote,
      color: 'var(--success-text)',
      bgColor: 'var(--success-bg)',
      borderColor: 'var(--success-border)'
    },
    {
      id: 'nequi',
      name: 'Nequi',
      description: 'Transfiere y envía el comprobante',
      icon: Smartphone,
      color: 'var(--accent-purple-text)',
      bgColor: 'var(--accent-purple-bg)',
      borderColor: 'var(--border-subtle)'
    },
    {
      id: 'daviplata',
      name: 'Daviplata',
      description: 'Transfiere y envía el comprobante',
      icon: Wallet,
      color: 'var(--danger-text)',
      bgColor: 'var(--danger-bg)',
      borderColor: 'var(--danger-border)'
    },
    {
      id: 'bre_b',
      name: 'BRE-B',
      description: 'Transfiere y envía el comprobante',
      icon: QrCode,
      color: 'var(--info-text)',
      bgColor: 'var(--info-bg)',
      borderColor: 'var(--info-border)'
    }
  ];

  const selectedMethodData = methods.find(m => m.id === selectedMethod);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-[color:var(--text-primary)] mb-4">Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onMethodChange(method.id)}
                className="p-4 rounded-xl border-2 transition-all text-left"
                style={isSelected
                  ? { borderColor: method.borderColor, backgroundColor: method.bgColor, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                  : { borderColor: 'var(--border-default)' }
                }
                onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'; } }}
                onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: method.bgColor }}
                  >
                    <Icon size={20} style={{ color: method.color }} />
                  </div>
                  <span className="font-bold text-[color:var(--text-primary)]">{method.name}</span>
                </div>
                <p className="text-xs text-[color:var(--text-secondary)]">{method.description}</p>
                {isSelected && (
                  <div
                    className="mt-2 flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--success-text)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success-text)' }}></div>
                    <span>Seleccionado</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedMethod && selectedMethod !== 'contra_entrega' && paymentConfig && (
        <div className={`p-6 rounded-xl border-2 ${selectedMethodData?.bgColor} ${selectedMethodData?.borderColor}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className={selectedMethodData?.color} />
            <h4 className="font-bold text-[color:var(--text-primary)]">Instrucciones para pagar con {selectedMethodData?.name}</h4>
          </div>

          <div className="space-y-4">
            {paymentConfig[selectedMethod]?.telefono || paymentConfig[selectedMethod]?.clave ? (
              <div className="space-y-4">
                {paymentConfig[selectedMethod]?.telefono && (
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-4">
                    <p className="text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Número de {selectedMethod}:</p>
                    <p className="text-lg font-bold text-[color:var(--text-primary)]">{paymentConfig[selectedMethod].telefono}</p>
                  </div>
                )}

                {paymentConfig[selectedMethod]?.clave && (
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-4">
                    <p className="text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Clave BRE-B:</p>
                    <p className="text-lg font-bold text-[color:var(--text-primary)]">{paymentConfig[selectedMethod].clave}</p>
                  </div>
                )}

                {paymentConfig[selectedMethod]?.titular && (
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-4">
                    <p className="text-sm font-semibold text-[color:var(--text-secondary)] mb-1">Titular:</p>
                    <p className="text-lg font-bold text-[color:var(--text-primary)]">{paymentConfig[selectedMethod].titular}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[color:var(--bg-elevated)] rounded-lg p-4 text-center text-[color:var(--text-muted)]">
                <p>El restaurante no ha configurado este método de pago.</p>
                <p className="text-sm mt-1">Selecciona otro método o contacta al restaurante.</p>
              </div>
            )}

            {(paymentConfig[selectedMethod]?.telefono || paymentConfig[selectedMethod]?.clave) && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-[color:var(--text-secondary)] mb-2">
                  Subir Comprobante de Pago *
                </label>
                <div className="relative w-full h-40 rounded-xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] flex items-center justify-center overflow-hidden">
                  {comprobantePreview ? (
                    <>
                      <img
                        src={comprobantePreview}
                        alt="Comprobante"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveProof}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <Upload size={16} className="rotate-180" />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[color:var(--bg-subtle)] transition-colors">
                      <Upload size={32} className="text-[color:var(--text-subtle)] mb-2" />
                      <span className="text-xs text-[color:var(--text-muted)] font-medium">Click para subir comprobante</span>
                      <span className="text-[10px] text-[color:var(--text-subtle)] mt-1">JPG, PNG - Max 5MB</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
                {comprobanteFile && (
                  <div
                    className="text-xs mt-2 flex items-center gap-1"
                    style={{ color: 'var(--success-text)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success-text)' }}></div>
                    <span>Archivo seleccionado: {comprobanteFile.name}</span>
                  </div>
                )}
                {error && (
                  <div
                    className="text-xs mt-2 flex items-center gap-1"
                    style={{ color: 'var(--danger-text)' }}
                  >
                    <AlertCircle size={12} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedMethod === 'contra_entrega' && (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--success-bg)', border: '2px solid var(--success-border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={20} style={{ color: 'var(--success-text)' }} />
            <h4 className="font-bold text-[color:var(--text-primary)]">Pago Contra Entrega</h4>
          </div>
          <p className="text-sm text-[color:var(--text-secondary)]">
            No necesitas pagar ahora. Prepara el monto exacto o pregunta si el repartidor tiene cambio.
          </p>
          <p className="text-xs text-[color:var(--text-muted)] mt-2">
            Tu pedido tendrá el estado "Pendiente de Confirmación" hasta que el restaurante lo acepte.
          </p>
        </div>
      )}
    </div>
  );
}
