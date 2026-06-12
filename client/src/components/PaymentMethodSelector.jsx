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

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }

    // Validar tamaño (max 5MB)
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
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'nequi',
      name: 'Nequi',
      description: 'Transfiere y envía el comprobante',
      icon: Smartphone,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      id: 'daviplata',
      name: 'Daviplata',
      description: 'Transfiere y envía el comprobante',
      icon: Wallet,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      id: 'bre_b',
      name: 'BRE-B',
      description: 'Transfiere y envía el comprobante',
      icon: QrCode,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  ];

  const selectedMethodData = methods.find(m => m.id === selectedMethod);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-dark mb-4">Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onMethodChange(method.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? `${method.borderColor} ${method.bgColor} shadow-md`
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full ${method.bgColor} flex items-center justify-center`}>
                    <Icon size={20} className={method.color} />
                  </div>
                  <span className="font-bold text-dark">{method.name}</span>
                </div>
                <p className="text-xs text-gray-600">{method.description}</p>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-semibold">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span>Seleccionado</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instrucciones según método seleccionado */}
      {selectedMethod && selectedMethod !== 'contra_entrega' && paymentConfig && (
        <div className={`p-6 rounded-xl border-2 ${selectedMethodData?.bgColor} ${selectedMethodData?.borderColor}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className={selectedMethodData?.color} />
            <h4 className="font-bold text-dark">Instrucciones para pagar con {selectedMethodData?.name}</h4>
          </div>

          <div className="space-y-4">
            {paymentConfig[selectedMethod]?.telefono || paymentConfig[selectedMethod]?.clave ? (
              <div className="space-y-4">
                {paymentConfig[selectedMethod]?.telefono && (
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Número de {selectedMethod}:</p>
                    <p className="text-lg font-bold text-dark">{paymentConfig[selectedMethod].telefono}</p>
                  </div>
                )}

                {paymentConfig[selectedMethod]?.clave && (
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Clave BRE-B:</p>
                    <p className="text-lg font-bold text-dark">{paymentConfig[selectedMethod].clave}</p>
                  </div>
                )}

                {paymentConfig[selectedMethod]?.titular && (
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Titular:</p>
                    <p className="text-lg font-bold text-dark">{paymentConfig[selectedMethod].titular}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4 text-center text-gray-500">
                <p>El restaurante no ha configurado este método de pago.</p>
                <p className="text-sm mt-1">Selecciona otro método o contacta al restaurante.</p>
              </div>
            )}

            {/* Subida de comprobante */}
            {(paymentConfig[selectedMethod]?.telefono || paymentConfig[selectedMethod]?.clave) && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subir Comprobante de Pago *
                </label>
                <div className="relative w-full h-40 rounded-xl border-2 border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden">
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
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-50 transition-colors">
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500 font-medium">Click para subir comprobante</span>
                      <span className="text-[10px] text-gray-400 mt-1">JPG, PNG - Max 5MB</span>
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
                  <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span>Archivo seleccionado: {comprobanteFile.name}</span>
                  </div>
                )}
                {error && (
                  <div className="text-xs text-red-600 mt-2 flex items-center gap-1">
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
        <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={20} className="text-green-600" />
            <h4 className="font-bold text-dark">Pago Contra Entrega</h4>
          </div>
          <p className="text-sm text-gray-600">
            No necesitas pagar ahora. Prepara el monto exacto o pregunta si el repartidor tiene cambio.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Tu pedido tendrá el estado "Pendiente de Confirmación" hasta que el restaurante lo acepte.
          </p>
        </div>
      )}
    </div>
  );
}
