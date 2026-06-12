import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api, { paymentService, couponService } from '../services/api';
import { addressService } from '../services/api';
import { CheckCircle, MapPin, Plus, Tag, X } from 'lucide-react';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import ErrorMessageModal from '../components/ErrorMessageModal';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, total, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('contra_entrega');
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [restauranteId, setRestauranteId] = useState(null);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });

  // Estado para cupones
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    telefono_contacto: user?.telefono || '',
    direccion_entrega: '',
    notas: '',
  });

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        console.log('Loading addresses...');
        const response = await addressService.getAll();
        console.log('Addresses response:', response);
        const addressList = response.data.addresses || [];
        console.log('Addresses loaded:', addressList);
        setAddresses(addressList);
        // Seleccionar la dirección default automáticamente si existe
        const defaultAddress = addressList.find(addr => addr.es_default);
        if (defaultAddress) {
          console.log('Using default address:', defaultAddress);
          setSelectedAddressId(defaultAddress.id);
          setFormData(prev => ({
            ...prev,
            direccion_entrega: defaultAddress.direccion,
            telefono_contacto: defaultAddress.telefono || prev.telefono_contacto,
          }));
        } else if (addressList.length > 0) {
          // Si no hay default, seleccionar la primera
          console.log('Using first address:', addressList[0]);
          setSelectedAddressId(addressList[0].id);
          setFormData(prev => ({
            ...prev,
            direccion_entrega: addressList[0].direccion,
            telefono_contacto: addressList[0].telefono || prev.telefono_contacto,
          }));
        } else {
          console.log('No addresses found, using new address mode');
          setUseNewAddress(true);
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
        setUseNewAddress(true);
      } finally {
        setAddressesLoading(false);
      }
    };
    loadAddresses();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId);
    setUseNewAddress(false);
    const selected = addresses.find(addr => addr.id === addressId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        direccion_entrega: selected.direccion,
        telefono_contacto: selected.telefono || prev.telefono_contacto,
      }));
    }
  };

  const handleNewAddress = () => {
    setUseNewAddress(true);
    setSelectedAddressId(null);
    setFormData(prev => ({
      ...prev,
      direccion_entrega: '',
      telefono_contacto: prev.telefono_contacto,
    }));
  };

  // Manejar aplicación de cupón
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      const restaurante_id = cart[0]?.restaurante_id;
      if (!restaurante_id) {
        setCouponError('No se pudo identificar el restaurante');
        return;
      }

      const response = await couponService.validate(couponCode.toUpperCase(), restaurante_id, total);

      if (response.data.valido) {
        const cupon = response.data.cupon;
        setAppliedCoupon(cupon);
        setCouponError('');

        // Calcular descuento
        let descuento = 0;
        if (cupon.tipo_descuento === 'porcentaje') {
          descuento = (total * cupon.descuento) / 100;
        } else {
          descuento = cupon.descuento;
        }
        setDiscountAmount(descuento);
        setCouponCode('');
      }
    } catch (error) {
      setCouponError(error.response?.data?.error || 'Cupón inválido');
      setAppliedCoupon(null);
      setDiscountAmount(0);
    } finally {
      setCouponLoading(false);
    }
  };

  // Manejar remoción de cupón
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
      }

      const restaurante_id = cart[0].restaurante_id || 1;
      setRestauranteId(restaurante_id);

      // Validar comprobante para pagos electrónicos (Nequi, Daviplata, BRE-B)
      if ((paymentMethod === 'nequi' || paymentMethod === 'daviplata' || paymentMethod === 'bre_b') && !comprobanteFile) {
        alert('Debes subir el comprobante de pago para continuar');
        setLoading(false);
        return;
      }

      const orderData = {
        restaurante_id,
        items: cart.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
        })),
        cupon_codigo: appliedCoupon?.codigo || null,
        notas: formData.notas,
        direccion_entrega: formData.direccion_entrega,
        telefono_contacto: formData.telefono_contacto,
        metodo_pago: paymentMethod,
      };

      const response = await api.post('/orders', orderData);
      const pedido = response.data.pedido;

      // Si hay comprobante, subirlo después de crear el pedido
      if (comprobanteFile && pedido?.id) {
        const proofFormData = new FormData();
        proofFormData.append('comprobante', comprobanteFile);
        proofFormData.append('pedido_id', pedido.id);
        proofFormData.append('metodo_pago', paymentMethod);

        await paymentService.uploadProof(proofFormData);
      }

      setSuccess(true);
      clearCart();

      setTimeout(() => {
        navigate('/orders');
      }, 2000);
    } catch (error) {
      console.error('Error creating order:', error);
      setErrorModal({
        isOpen: true,
        message: error.response?.data?.detalles || error.response?.data?.error || error.message || 'Error al crear el pedido'
      });
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !success) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Carrito vacío</h1>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-center py-12 animate-scaleIn">
          <CheckCircle size={80} className="text-green-500 mb-6 mx-auto" />
          <h1 className="text-4xl font-heading font-bold text-dark mb-3">
            ¡Pedido Confirmado!
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Tu pedido ha sido recibido correctamente. Te redireccionaremos a tus pedidos...
          </p>
          <div className="animate-pulse">
            <div className="spinner spinner-md mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-8">
          Confirmar Pedido
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6 animate-slideUp">
              <div className="card-lg">
                <h2 className="text-2xl font-bold text-dark mb-6">Información de Entrega</h2>

               <div className="space-y-4">
                   <div>
                     <label className="block">Nombre Completo</label>
                     <input
                       type="text"
                       name="nombre"
                       value={formData.nombre}
                       onChange={handleChange}
                       readOnly
                       className="input opacity-75 bg-gray-50"
                     />
                   </div>

                   <div>
                     <label className="block">Email</label>
                     <input
                       type="email"
                       name="email"
                       value={formData.email}
                       onChange={handleChange}
                       readOnly
                       className="input opacity-75 bg-gray-50"
                     />
                   </div>

                   {/* Seleccionar Dirección Guardada */}
                   {!addressesLoading && addresses.length > 0 && (
                     <div>
                       <label className="block mb-3 font-semibold text-dark">
                         Mis Direcciones Guardadas
                       </label>
                       <div className="space-y-2 mb-4">
                         {addresses.map(addr => (
                           <button
                             key={addr.id}
                             type="button"
                             onClick={() => handleSelectAddress(addr.id)}
                             className={`w-full text-left p-3 border-2 rounded-lg transition-all ${
                               selectedAddressId === addr.id && !useNewAddress
                                 ? 'border-primary bg-red-50'
                                 : 'border-gray-200 hover:border-gray-300'
                             }`}
                           >
                             <div className="flex items-start justify-between">
                               <div className="flex-1">
                                 <p className="font-semibold text-dark flex items-center gap-2">
                                   <MapPin size={16} className="text-primary" />
                                   {addr.tipo.charAt(0).toUpperCase() + addr.tipo.slice(1)}
                                   {addr.es_default && (
                                     <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                                       Por Defecto
                                     </span>
                                   )}
                                 </p>
                                 <p className="text-sm text-gray-600 mt-1">{addr.direccion}</p>
                                 {addr.telefono && (
                                   <p className="text-xs text-gray-500 mt-1">Tel: {addr.telefono}</p>
                                 )}
                               </div>
                               <div className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center ${
                                 selectedAddressId === addr.id && !useNewAddress
                                   ? 'border-primary bg-primary'
                                   : 'border-gray-300'
                               }`}>
                                 {selectedAddressId === addr.id && !useNewAddress && (
                                   <div className="w-2 h-2 bg-white rounded-full"></div>
                                 )}
                               </div>
                             </div>
                           </button>
                         ))}
                       </div>
                       <button
                         type="button"
                         onClick={handleNewAddress}
                         className={`w-full p-3 border-2 border-dashed rounded-lg transition-all flex items-center justify-center gap-2 ${
                           useNewAddress
                             ? 'border-primary bg-red-50'
                             : 'border-gray-300 hover:border-primary text-gray-600'
                         }`}
                       >
                         <Plus size={18} />
                         Usar Nueva Dirección
                       </button>
                     </div>
                   )}

                   <div>
                     <label className="block">Teléfono de Contacto *</label>
                     <input
                       type="tel"
                       name="telefono_contacto"
                       value={formData.telefono_contacto}
                       onChange={handleChange}
                       required
                       placeholder="+57..."
                       className="input"
                     />
                   </div>

                   {(useNewAddress || addresses.length === 0) && (
                     <div>
                       <label className="block">Dirección de Entrega *</label>
                       <input
                         type="text"
                         name="direccion_entrega"
                         value={formData.direccion_entrega}
                         onChange={handleChange}
                         required
                         placeholder="Calle, número, apto/casa"
                         className="input"
                       />
                     </div>
                   )}

                   {!useNewAddress && addresses.length > 0 && selectedAddressId && (
                     <div>
                       <label className="block">Dirección de Entrega</label>
                       <input
                         type="text"
                         value={formData.direccion_entrega}
                         readOnly
                         className="input opacity-75 bg-gray-50"
                       />
                     </div>
                   )}

                   <div>
                     <label className="block">Notas Adicionales (Opcional)</label>
                     <textarea
                       name="notas"
                       value={formData.notas}
                       onChange={handleChange}
                       placeholder="Ej: Sin cebolla, cambios especiales, instrucciones..."
                       className="textarea"
                     />
                   </div>
                 </div>
              </div>

              {/* Método de Pago */}
              <div className="card-lg">
                <h2 className="text-2xl font-bold text-dark mb-6">Método de Pago</h2>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
                  onMethodChange={setPaymentMethod}
                  restauranteId={cart[0]?.restaurante_id}
                  onProofSelect={setComprobanteFile}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg btn-block"
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm inline mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  'Confirmar Pedido'
                )}
              </button>
            </form>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="card-lg bg-white sticky top-24 animate-slideUp">
              <h2 className="text-2xl font-heading font-bold text-dark mb-6">
                Resumen
              </h2>

              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200 max-h-64 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-600">
                    <span>{item.nombre} x {item.cantidad}</span>
                    <span>${(item.precio * item.cantidad).toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>

              {/* Cupón */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                {!appliedCoupon ? (
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-2">
                      ¿Tienes un cupón?
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="CÓDIGO"
                          className="input pl-10"
                          disabled={couponLoading}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="btn btn-primary px-4"
                      >
                        {couponLoading ? (
                          <div className="spinner spinner-sm"></div>
                        ) : (
                          'Aplicar'
                        )}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-red-600 text-xs mt-2">{couponError}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-green-800 flex items-center gap-2">
                          <Tag size={16} />
                          {appliedCoupon.codigo}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {appliedCoupon.tipo_descuento === 'porcentaje'
                            ? `${appliedCoupon.descuento}% de descuento`
                            : `$${appliedCoupon.descuento.toLocaleString('es-CO')} de descuento`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-red-500 hover:text-red-700"
                        title="Remover cupón"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>${total.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Impuestos (8%):</span>
                  <span>${(total * 0.08).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío:</span>
                  <span className="text-green-600 font-semibold">Gratis</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 font-semibold">
                    <span>Descuento:</span>
                    <span>-${discountAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-dark">Total:</span>
                <span className="text-3xl font-heading font-bold text-primary">
                  ${((total * 1.08) - discountAmount).toLocaleString('es-CO')}
                </span>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Se incluyen todos los impuestos
              </p>
            </div>
          </div>
        </div>
      </div>
      <ErrorMessageModal
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}

