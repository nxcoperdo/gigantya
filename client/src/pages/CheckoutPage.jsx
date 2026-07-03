import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api, { paymentService, couponService, addressService, zonaService, restaurantService } from '../services/api';
import { CheckCircle, MapPin, Plus, Tag, X, Store, Truck } from 'lucide-react';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import ErrorMessageModal from '../components/ErrorMessageModal';
// Sin AddressAutocomplete: el usuario escribe la dirección como texto libre.
// El restaurante la geocodifica en el iframe de embed de Google Maps
// (AddressMapPreview.jsx hace fallback por texto).

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
  // Objeto restaurante completo (necesario para leer ofrece_domicilio
  // y bloquear el submit si el local solo retiro en local).
  const [restaurante, setRestaurante] = useState(null);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [taxConfig, setTaxConfig] = useState({ activo: true, porcentaje: 8 });
  const [shippingConfig, setShippingConfig] = useState({ activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 });
  const [configLoaded, setConfigLoaded] = useState(false);

  // Catálogos de zonas
  const [sectores, setSectores] = useState([]);
  const [barriosBySector, setBarriosBySector] = useState({});
  const [sectoresLoading, setSectoresLoading] = useState(false);

  // Información de envío por barrio del restaurante actual
  const [envioInfo, setEnvioInfo] = useState(null); // { costo, sector_id, sector_nombre, ... }

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
    sector_id: '',
    barrio_id: '',
  });

  // Modalidad del pedido: 'envio' (a domicilio) o 'retiro' (en mostrador).
  // - Si el local NO ofrece domicilio (ofrece_domicilio=0), la modalidad
  //   queda forzada a 'retiro' y no se muestra el selector.
  // - Si el local SÍ ofrece domicilio, el cliente elige en este paso.
  //   Default: 'envio' (lo más común).
  const [modalidad, setModalidad] = useState('envio');
  const [modalidadInicializada, setModalidadInicializada] = useState(false);

  // Carga inicial: direcciones y sectores
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const response = await addressService.getAll();
        const addressList = response.data.addresses || [];
        setAddresses(addressList);
        const defaultAddress = addressList.find(addr => addr.es_default);
        const applyAddressToForm = (addr) => {
          setFormData(prev => ({
            ...prev,
            direccion_entrega: addr.direccion,
            telefono_contacto: addr.telefono || prev.telefono_contacto,
            sector_id: addr.sector_id ? String(addr.sector_id) : '',
            barrio_id: addr.barrio_id ? String(addr.barrio_id) : '',
          }));
        };
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          applyAddressToForm(defaultAddress);
        } else if (addressList.length > 0) {
          setSelectedAddressId(addressList[0].id);
          applyAddressToForm(addressList[0]);
        } else {
          setUseNewAddress(true);
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
        setUseNewAddress(true);
      } finally {
        setAddressesLoading(false);
      }
    };

    const loadSectores = async () => {
      try {
        setSectoresLoading(true);
        const res = await zonaService.getSectores();
        setSectores(res.data.sectores || []);
      } catch (err) {
        console.error('Error cargando sectores:', err);
      } finally {
        setSectoresLoading(false);
      }
    };

    loadAddresses();
    loadSectores();
  }, []);

  // Cargar barrios del sector seleccionado (para dirección nueva)
  useEffect(() => {
    if (!useNewAddress) return;
    if (!formData.sector_id) return;
    if (barriosBySector[formData.sector_id]) return;

    const fetchBarrios = async () => {
      try {
        const res = await zonaService.getBarrios(formData.sector_id);
        setBarriosBySector(prev => ({
          ...prev,
          [formData.sector_id]: res.data.barrios || []
        }));
      } catch (err) {
        console.error('Error cargando barrios:', err);
      }
    };
    fetchBarrios();
  }, [formData.sector_id, useNewAddress]);

  // Cargar configuración del restaurante cuando cambia el carrito
  useEffect(() => {
    const loadRestaurantConfig = async () => {
      const restaurante_id = cart[0]?.restaurante_id;
      if (!restaurante_id) return;

      try {
        const response = await restaurantService.getById(restaurante_id);
        const restaurant = response.data.restaurante;

        const defaultTax = { activo: true, porcentaje: 8 };
        const defaultShipping = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };

        let tax = defaultTax;
        let shipping = defaultShipping;

        if (restaurant.configuracion_impuestos) {
          tax = typeof restaurant.configuracion_impuestos === 'string'
            ? JSON.parse(restaurant.configuracion_impuestos)
            : restaurant.configuracion_impuestos;
        }

        if (restaurant.configuracion_envios) {
          shipping = typeof restaurant.configuracion_envios === 'string'
            ? JSON.parse(restaurant.configuracion_envios)
            : restaurant.configuracion_envios;
        }

        setTaxConfig(tax);
        setShippingConfig(shipping);
        setRestaurante(restaurant);
        // Si el local NO ofrece domicilio, la modalidad queda forzada a
        // retiro y el cliente no puede cambiarla. Si ofrece, default = envio.
        const ofrece = restaurant.ofrece_domicilio === undefined
          ? true
          : Boolean(Number(restaurant.ofrece_domicilio));
        setModalidad(ofrece ? 'envio' : 'retiro');
        setModalidadInicializada(true);
        setConfigLoaded(true);
      } catch (error) {
        console.error('Error cargando configuración del restaurante:', error);
        setTaxConfig({ activo: true, porcentaje: 8 });
        setShippingConfig({ activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 });
        setRestaurante(null);
        setConfigLoaded(false);
      }
    };

    loadRestaurantConfig();
  }, [cart]);

  // Resolver el envío para el barrio seleccionado / dirección seleccionada
  useEffect(() => {
    const restaurante_id = cart[0]?.restaurante_id;
    if (!restaurante_id) {
      setEnvioInfo(null);
      return;
    }

    let cancelled = false;

    const resolveEnvio = async () => {
      let barrioId = null;
      if (!useNewAddress && selectedAddressId) {
        const addr = addresses.find(a => a.id === selectedAddressId);
        if (addr && addr.barrio_id) barrioId = addr.barrio_id;
      } else if (useNewAddress && formData.barrio_id) {
        barrioId = formData.barrio_id;
      }

      try {
        if (barrioId) {
          const res = await restaurantService.getById(restaurante_id, { barrio_id: barrioId });
          if (!cancelled) {
            setEnvioInfo(res.data.envio_para_barrio || null);
          }
        } else {
          // Sin barrio, no podemos resolver por sector: usamos el costo_fijo global
          if (!cancelled) setEnvioInfo(null);
        }
      } catch (err) {
        console.error('Error resolviendo envío por barrio:', err);
        if (!cancelled) setEnvioInfo(null);
      }
    };

    resolveEnvio();
    return () => { cancelled = true; };
  }, [cart, selectedAddressId, useNewAddress, formData.barrio_id, addresses]);

  const subtotal = total;
  const descuento = discountAmount;
  const subtotalConDescuento = subtotal - descuento;

  const taxAmount = taxConfig.activo && taxConfig.porcentaje > 0
    ? subtotalConDescuento * (taxConfig.porcentaje / 100)
    : 0;

  // La modalidad del pedido la elige el cliente en este paso (si el local
  // ofrece domicilio). Si el local NO ofrece domicilio, modalidad queda
  // forzada a 'retiro' desde el useEffect que carga la config.
  const esRetiroLocal = modalidad === 'retiro';

  // Determinar el costo de envío efectivo:
  // - Si es retiro en local → 0
  // - Si hay envioInfo (barrio resuelto) → usar su costo
  // - Si no, fallback al costo_fijo global
  // - Si envío gratis está activo y el subtotalConDescuento lo supera → 0
  const envioGratisCorresponde = !esRetiroLocal && (
    shippingConfig.activo &&
    shippingConfig.envio_gratis_activo === true &&
    Number(shippingConfig.envio_gratis_desde) > 0 &&
    subtotalConDescuento > Number(shippingConfig.envio_gratis_desde)
  );

  const calculatedShippingAmount = esRetiroLocal
    ? 0
    : envioGratisCorresponde
      ? 0
      : (envioInfo && envioInfo.costo !== undefined
          ? Number(envioInfo.costo) || 0
          : (shippingConfig.activo ? (Number(shippingConfig.costo_fijo) || 0) : 0));

  const envioSectorTexto = envioInfo
    ? envioInfo.envio_gratis_aplicado
      ? 'Gratis'
      : envioInfo.sector_nombre
        ? `$${Number(envioInfo.costo || 0).toLocaleString('es-CO')} (${envioInfo.sector_nombre})`
        : `$${Number(envioInfo.costo || 0).toLocaleString('es-CO')}`
    : null;

  const finalTotal = subtotalConDescuento + taxAmount + calculatedShippingAmount;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Si cambia el sector, limpiamos el barrio
      if (name === 'sector_id') {
        next.barrio_id = '';
      }
      return next;
    });
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
        sector_id: selected.sector_id ? String(selected.sector_id) : '',
        barrio_id: selected.barrio_id ? String(selected.barrio_id) : '',
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
      sector_id: '',
      barrio_id: '',
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
        setCouponError('No se pudo identificar el local');
        return;
      }

      const response = await couponService.validate(couponCode.toUpperCase(), restaurante_id, total);

      if (response.data.valido) {
        const cupon = response.data.cupon;
        setAppliedCoupon(cupon);
        setCouponError('');

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
        setLoading(false);
        return;
      }

      if (!configLoaded) {
        alert('Cargando configuración del local, por favor espera un momento...');
        setLoading(false);
        return;
      }

      // Si el usuario eligió una dirección guardada, listo. Si está tipeando
      // una nueva, basta con que el campo de dirección no esté vacío.

      // Modalidad del pedido: si el restaurante es "solo retiro en mostrador"
      // (ofrece_domicilio=0), NO exigimos dirección ni barrio y enviamos
      // costo_envio=0. El backend igual va a forzar los nulls aunque el
      // body los traiga poblados, pero los mandamos limpios desde acá para
      // evitar inconsistencias y para que el cliente no vea formularios
      // que no aplican.
      // (esRetiroLocal ya está calculado al tope del componente)

      const restaurante_id = cart[0].restaurante_id || 1;
      setRestauranteId(restaurante_id);

      if ((paymentMethod === 'nequi' || paymentMethod === 'daviplata' || paymentMethod === 'bre_b') && !comprobanteFile) {
        alert('Debes subir el comprobante de pago para continuar');
        setLoading(false);
        return;
      }

      // Determinar barrio_id a enviar al backend. Sin autocompletado de mapa:
      // las coordenadas las genera el restaurante al ver el pedido
      // (AddressMapPreview.jsx geocodifica el texto).
      // Para pedidos de retiro en mostrador, no se necesita dirección
      // ni barrio: el cliente retira en el mostrador del local.
      let barrioIdEnviar = null;

      if (!esRetiroLocal) {
        if (!useNewAddress && selectedAddressId) {
          const addr = addresses.find(a => a.id === selectedAddressId);
          if (addr && addr.barrio_id) barrioIdEnviar = Number(addr.barrio_id);
        } else if (useNewAddress) {
          if (formData.barrio_id) barrioIdEnviar = Number(formData.barrio_id);
        }
      }

      // Para que el backend pueda calcular el envío, la dirección debe tener
      // barrio_id (catálogo de zonas). Esto NO aplica a pedidos de retiro.
      if (!esRetiroLocal && !barrioIdEnviar) {
        const mensaje = useNewAddress
          ? 'Para calcular el envío, elegí un sector y barrio de la lista.'
          : 'La dirección seleccionada no tiene barrio. Edítala para precisar la ubicación.';
        setErrorModal({ isOpen: true, message: mensaje });
        setLoading(false);
        return;
      }

      const subtotalOrder = total;
      const descuentoOrder = discountAmount;
      const subtotalConDescuentoOrder = subtotalOrder - descuentoOrder;

      const taxAmountOrder = taxConfig.activo && taxConfig.porcentaje > 0
        ? subtotalConDescuentoOrder * (taxConfig.porcentaje / 100)
        : 0;

      const envioGratisOrder = !esRetiroLocal && (
        shippingConfig.activo &&
        shippingConfig.envio_gratis_activo === true &&
        Number(shippingConfig.envio_gratis_desde) > 0 &&
        subtotalConDescuentoOrder > Number(shippingConfig.envio_gratis_desde)
      );

      // Para pedidos de retiro en mostrador el envío siempre es 0, sin
      // importar la config de `shippingConfig` del local (la config
      // sigue activa porque el local la configuró por si en algún
      // momento futuro ofrece domicilios, pero no aplica al retiro).
      const costoEnvio = esRetiroLocal
        ? 0
        : envioGratisOrder
          ? 0
          : (envioInfo && envioInfo.costo !== undefined
              ? Number(envioInfo.costo) || 0
              : (shippingConfig.activo ? (Number(shippingConfig.costo_fijo) || 0) : 0));

      const totalOrder = subtotalConDescuentoOrder + taxAmountOrder + costoEnvio;

      // En pedidos de retiro mandamos dirección/barrio/coordenadas null
      // y costo_envio=0. El backend igual los va a forzar nulls, pero
      // los mandamos limpios para que el payload refleje la intención.
      const orderData = {
        restaurante_id,
        items: cart.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
        })),
        cupon_codigo: appliedCoupon?.codigo || null,
        notas: formData.notas,
        direccion_entrega: esRetiroLocal ? null : formData.direccion_entrega,
        telefono_contacto: formData.telefono_contacto,
        metodo_pago: paymentMethod,
        costo_envio: costoEnvio,
        barrio_id: esRetiroLocal ? null : barrioIdEnviar,
        // Sin autocompletado de mapa en el cliente: latitud/longitud las
        // genera el restaurante al ver el pedido (AddressMapPreview.jsx
        // geocodifica el texto en el iframe de embed).
        latitud: null,
        longitud: null,
        direccion_formateada: null,
        place_id: null,
        // El cliente eligió la modalidad en el checkout (si el local
        // ofrece domicilio). Si no, viene forzada a true desde la carga
        // de la config del restaurante. El backend lo persiste en
        // pedidos.es_retiro_local.
        es_retiro_local: esRetiroLocal,
        total: totalOrder,
      };

      const response = await api.post('/orders', orderData);
      const pedido = response.data.pedido;

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
      <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[color:var(--text-primary)] mb-4">Carrito vacío</h1>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center">
        <div className="text-center py-12 animate-scaleIn">
          <CheckCircle size={80} className="text-green-500 mb-6 mx-auto" />
          <h1 className="text-4xl font-heading font-bold text-[color:var(--text-primary)] mb-3">
            ¡Pedido Confirmado!
          </h1>
          <p className="text-[color:var(--text-secondary)] text-lg mb-8">
            Tu pedido ha sido recibido correctamente. Te redireccionaremos a tus pedidos...
          </p>
          <div className="animate-pulse">
            <div className="spinner spinner-md mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  const barriosDelSectorNuevo = formData.sector_id
    ? (barriosBySector[formData.sector_id] || [])
    : [];

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-6 sm:py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-4 md:px-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-[color:var(--text-primary)] mb-6 sm:mb-8">
          Confirmar Pedido
        </h1>

        {/* Selector de modalidad: visible solo si el local ofrece
            domicilio. Si el local es solo-retiro (ofrece_domicilio=0),
            la modalidad ya queda forzada a 'retiro' y este bloque
            no se renderiza. */}
        {restaurante && restaurante.ofrece_domicilio !== undefined && Boolean(Number(restaurante.ofrece_domicilio)) && (
          <div className="mb-6 card-lg">
            <h2 className="text-lg font-heading font-bold text-[color:var(--text-primary)] mb-3">
              ¿Cómo querés recibir tu pedido?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModalidad('envio')}
                className={`p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                  modalidad === 'envio'
                    ? 'border-primary bg-primary/5'
                    : 'border-[color:var(--border-default)] hover:border-primary/50'
                }`}
                style={modalidad === 'envio' ? { backgroundColor: 'var(--primary-bg)' } : undefined}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck size={20} className="text-primary" />
                  <span className="font-bold text-[color:var(--text-primary)]">Envío a domicilio</span>
                </div>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Te lo llevamos a la dirección que indiques. Tiene costo de envío.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setModalidad('retiro')}
                className={`p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                  modalidad === 'retiro'
                    ? 'border-primary bg-primary/5'
                    : 'border-[color:var(--border-default)] hover:border-primary/50'
                }`}
                style={modalidad === 'retiro' ? { backgroundColor: 'var(--primary-bg)' } : undefined}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Store size={20} className="text-primary" />
                  <span className="font-bold text-[color:var(--text-primary)]">Retiro en mostrador</span>
                </div>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Pasás a buscarlo al local cuando esté listo. Sin costo de envío.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Banner informativo: si la modalidad elegida es retiro, se lo
            recordamos al cliente. NO es un bloqueo. */}
        {esRetiroLocal && (
          <div
            className="mb-6 p-4 rounded-xl flex items-start gap-3"
            style={{
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              color: 'var(--warning-text)',
            }}
          >
            <Store size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Este pedido es para retirar en el mostrador del local</p>
              <p className="text-sm opacity-90">
                No hace falta dirección de envío. Te avisaremos cuando esté listo
                para que pases a buscarlo.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 animate-slideUp">
              <div className="card-lg">
                <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)] mb-5 sm:mb-6">Información de Entrega</h2>

               <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-semibold mb-1.5">Nombre Completo</label>
                     <input
                       type="text"
                       name="nombre"
                       value={formData.nombre}
                       onChange={handleChange}
                       readOnly
                       className="input opacity-75 bg-gray-50 min-h-[44px]"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-semibold mb-1.5">Email</label>
                     <input
                       type="email"
                       name="email"
                       value={formData.email}
                       onChange={handleChange}
                       readOnly
                       className="input opacity-75 bg-gray-50 min-h-[44px]"
                     />
                   </div>

                   {/* Seleccionar Dirección Guardada */}
                   {!addressesLoading && addresses.length > 0 && (
                     <div>
                       <label className="block mb-3 font-semibold text-[color:var(--text-primary)]">
                         Mis Direcciones Guardadas
                       </label>
                       <div className="space-y-2.5 mb-4">
                         {addresses.map(addr => (
                           <button
                             key={addr.id}
                             type="button"
                             onClick={() => handleSelectAddress(addr.id)}
                             className={`w-full text-left p-3 sm:p-4 border-2 rounded-xl transition-all active:scale-98 touch-feedback ${
                               selectedAddressId === addr.id && !useNewAddress
                                 ? 'border-primary'
                                 : 'border-[color:var(--border-default)] hover:border-[color:var(--border-strong)]'
                             }`}
                             style={selectedAddressId === addr.id && !useNewAddress ? { backgroundColor: 'var(--bg-subtle)' } : undefined}
                           >
                             <div className="flex items-start justify-between gap-3">
                               <div className="flex-1 min-w-0">
                                 <p className="font-semibold text-[color:var(--text-primary)] flex items-center gap-2 flex-wrap">
                                   <MapPin size={16} className="text-primary flex-shrink-0" />
                                   {addr.tipo.charAt(0).toUpperCase() + addr.tipo.slice(1)}
                                   {addr.es_default && (
                                     <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full flex-shrink-0">
                                       Por Defecto
                                     </span>
                                   )}
                                   {addr.sector_nombre && (
                                     <span
                                       className="text-xs px-2 py-0.5 rounded-full"
                                       style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}
                                     >
                                       {addr.sector_nombre}{addr.barrio_nombre ? ` · ${addr.barrio_nombre}` : ''}
                                     </span>
                                   )}
                                 </p>
                                 <p className="text-sm text-[color:var(--text-secondary)] mt-1 break-words">{addr.direccion}</p>
                                 {addr.telefono && (
                                   <p className="text-xs text-[color:var(--text-muted)] mt-1">Tel: {addr.telefono}</p>
                                 )}
                               </div>
                               <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${
                                 selectedAddressId === addr.id && !useNewAddress
                                   ? 'border-primary bg-primary'
                                   : 'border-[color:var(--border-strong)]'
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
                         className={`w-full p-3 sm:p-4 border-2 border-dashed rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 touch-feedback ${
                           useNewAddress
                             ? 'border-primary'
                             : 'border-[color:var(--border-strong)] hover:border-primary text-[color:var(--text-secondary)]'
                         }`}
                         style={useNewAddress ? { backgroundColor: 'var(--bg-subtle)' } : undefined}
                       >
                         <Plus size={18} />
                         Usar Nueva Dirección
                       </button>
                     </div>
                   )}

                   {/* Selector de sector + barrio para dirección nueva */}
                   {useNewAddress && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-semibold mb-1.5">Sector *</label>
                         <select
                           name="sector_id"
                           value={formData.sector_id}
                           onChange={handleChange}
                           className="input min-h-[44px]"
                           required
                           disabled={sectoresLoading}
                         >
                           <option value="">
                             {sectoresLoading ? 'Cargando sectores…' : 'Selecciona un sector'}
                           </option>
                           {sectores.map(s => (
                             <option key={s.id} value={s.id}>{s.nombre}</option>
                           ))}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-semibold mb-1.5">Barrio *</label>
                         <select
                           name="barrio_id"
                           value={formData.barrio_id}
                           onChange={handleChange}
                           className="input min-h-[44px]"
                           required
                           disabled={!formData.sector_id}
                         >
                           <option value="">
                             {formData.sector_id ? 'Selecciona un barrio' : 'Primero selecciona un sector'}
                           </option>
                           {barriosDelSectorNuevo.map(b => (
                             <option key={b.id} value={b.id}>{b.nombre}</option>
                           ))}
                         </select>
                       </div>
                     </div>
                   )}

                   <div>
                     <label className="block text-sm font-semibold mb-1.5">Teléfono de Contacto *</label>
                     <input
                       type="tel"
                       name="telefono_contacto"
                       value={formData.telefono_contacto}
                       onChange={handleChange}
                       required
                       placeholder="+57..."
                       className="input min-h-[44px]"
                     />
                   </div>

                   {(useNewAddress || addresses.length === 0) && (
                     <div>
                       <label className="block text-sm font-semibold mb-1.5">Dirección de Entrega (calle/carrera/número) *</label>
                       <input
                         type="text"
                         name="direccion_entrega"
                         value={formData.direccion_entrega}
                         onChange={handleChange}
                         placeholder="Calle 5 #12-45, Apto 301"
                         className="input min-h-[44px]"
                         autoComplete="street-address"
                         required
                       />
                     </div>
                   )}

                   {!useNewAddress && addresses.length > 0 && selectedAddressId && (
                     <div>
                       <label className="block text-sm font-semibold mb-1.5">Dirección de Entrega</label>
                       <input
                         type="text"
                         value={formData.direccion_entrega}
                         readOnly
                         className="input opacity-75 bg-gray-50 min-h-[44px]"
                       />
                     </div>
                   )}

                   <div>
                     <label className="block text-sm font-semibold mb-1.5">Notas Adicionales (Opcional)</label>
                     <textarea
                       name="notas"
                       value={formData.notas}
                       onChange={handleChange}
                       placeholder="Ej: Sin cebolla, cambios especiales, instrucciones..."
                       className="textarea"
                       rows={3}
                     />
                   </div>
                 </div>
              </div>

              {/* Método de Pago */}
              <div className="card-lg">
                <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)] mb-5 sm:mb-6">Método de Pago</h2>
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
                className="btn btn-primary btn-lg btn-block min-h-[48px] w-full"
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
            <div className="card-lg sticky top-20 animate-slideUp">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-[color:var(--text-primary)] mb-4 sm:mb-6">
                Resumen
              </h2>

              <div className="space-y-2 sm:space-y-3 mb-4 pb-4 border-b border-[color:var(--border-default)] max-h-48 sm:max-h-64 overflow-y-auto custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-sm text-[color:var(--text-secondary)]">
                    <span className="truncate pr-2">{item.nombre} x {item.cantidad}</span>
                    <span className="flex-shrink-0">${(item.precio * item.cantidad).toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>

              {/* Cupón */}
              <div className="mb-4 pb-4 border-b border-[color:var(--border-default)]">
                {!appliedCoupon ? (
                  <div>
                    <label className="block text-sm font-semibold text-[color:var(--text-primary)] mb-2">
                      ¿Tienes un cupón?
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" size={18} />
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="CÓDIGO"
                          className="input pl-10 min-h-[44px]"
                          disabled={couponLoading}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="btn btn-primary px-3 sm:px-4 min-h-[44px] flex-shrink-0"
                      >
                        {couponLoading ? (
                          <div className="spinner spinner-sm"></div>
                        ) : (
                          'Aplicar'
                        )}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-xs mt-2" style={{ color: 'var(--danger-text)' }}>{couponError}</p>
                    )}
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-3"
                    style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold flex items-center gap-2" style={{ color: 'var(--success-text)' }}>
                          <Tag size={16} />
                          <span className="truncate">{appliedCoupon.codigo}</span>
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--success-text)' }}>
                          {appliedCoupon.tipo_descuento === 'porcentaje'
                            ? `${appliedCoupon.descuento}% de descuento`
                            : `$${appliedCoupon.descuento.toLocaleString('es-CO')} de descuento`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="flex-shrink-0 active:scale-95 touch-feedback"
                        style={{ color: 'var(--danger-text)' }}
                        title="Remover cupón"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-[color:var(--border-default)]">
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Subtotal:</span>
                  <span>${total.toLocaleString('es-CO')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between font-semibold text-sm sm:text-base" style={{ color: 'var(--success-text)' }}>
                    <span>Descuento:</span>
                    <span>-${discountAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Impuestos{taxConfig.activo ? ` (${taxConfig.porcentaje}%)` : ''}:</span>
                  <span>
                    {taxConfig.activo && taxConfig.porcentaje > 0
                      ? `$${taxAmount.toLocaleString('es-CO')}`
                      : '$0'}
                  </span>
                </div>
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>{esRetiroLocal ? 'Retiro en mostrador:' : `Envío${envioInfo && envioInfo.sector_nombre ? ` (${envioInfo.sector_nombre})` : ''}:`}</span>
                  <span
                    className={calculatedShippingAmount === 0 ? 'font-semibold' : ''}
                    style={calculatedShippingAmount === 0 ? { color: 'var(--success-text)' } : undefined}
                  >
                    {esRetiroLocal
                      ? 'Gratis'
                      : envioGratisCorresponde
                        ? 'Gratis'
                        : calculatedShippingAmount === 0
                          ? 'Gratis'
                          : envioSectorTexto || `$${calculatedShippingAmount.toLocaleString('es-CO')}`}
                  </span>
                </div>
                {shippingConfig.envio_gratis_activo && Number(shippingConfig.envio_gratis_desde) > 0 && subtotalConDescuento <= Number(shippingConfig.envio_gratis_desde) && (
                  <p className="text-xs text-[color:var(--text-muted)] italic">
                    ¡Envío gratis si tu pedido supera ${Number(shippingConfig.envio_gratis_desde).toLocaleString('es-CO')}!
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <span className="text-base sm:text-lg font-bold text-[color:var(--text-primary)]">Total:</span>
                <span className="text-2xl sm:text-3xl font-heading font-bold text-primary">
                  ${finalTotal.toLocaleString('es-CO')}
                </span>
              </div>

              <p className="text-xs text-[color:var(--text-muted)] text-center">
                Subtotal: ${subtotal.toLocaleString('es-CO')} + Impuestos: ${taxAmount.toLocaleString('es-CO')} + Envío: ${calculatedShippingAmount.toLocaleString('es-CO')} = ${finalTotal.toLocaleString('es-CO')}
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