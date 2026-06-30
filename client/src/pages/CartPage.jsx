import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart, Store } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { useCart } from '../context/CartContext';
import api from '../services/api';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const [taxConfig, setTaxConfig] = useState({ activo: true, porcentaje: 8 });
  const [shippingConfig, setShippingConfig] = useState({ activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 });
  const [configLoaded, setConfigLoaded] = useState(false);
  // Estado del restaurante actual del carrito (necesario para detectar
  // si cambió a "solo retiro en local" después de agregar items).
  const [restaurante, setRestaurante] = useState(null);

  // Cargar configuración de impuestos y envíos del restaurante
  useEffect(() => {
    const loadRestaurantConfig = async () => {
      const restaurante_id = cart[0]?.restaurante_id;
      console.log('CartPage - restaurante_id:', restaurante_id);
      console.log('CartPage - cart:', cart);
      if (!restaurante_id) return;

      try {
        const response = await api.get(`/restaurants/${restaurante_id}`);
        console.log('CartPage - API response:', response.data);
        const restaurant = response.data.restaurante;

        console.log('CartPage - Restaurante config:', restaurant.configuracion_envios);

        const defaultTax = { activo: true, porcentaje: 8 };
        const defaultShipping = { activo: false, costo_fijo: 0, envio_gratis_activo: false, envio_gratis_desde: 0 };

        // Parsear configuración si viene como string JSON
        const taxConfigLoaded = restaurant.configuracion_impuestos
          ? (typeof restaurant.configuracion_impuestos === 'string'
              ? JSON.parse(restaurant.configuracion_impuestos)
              : restaurant.configuracion_impuestos)
          : defaultTax;

        const shippingConfigLoaded = restaurant.configuracion_envios
          ? (typeof restaurant.configuracion_envios === 'string'
              ? JSON.parse(restaurant.configuracion_envios)
              : restaurant.configuracion_envios)
          : defaultShipping;

        console.log('CartPage - Tax config:', taxConfigLoaded);
        console.log('CartPage - Shipping config:', shippingConfigLoaded);

        setTaxConfig(taxConfigLoaded);
        setShippingConfig(shippingConfigLoaded);
        setRestaurante(restaurant);
        setConfigLoaded(true);
      } catch (error) {
        console.error('Error cargando configuración del restaurante:', error);
      }
    };

    if (cart.length > 0) {
      loadRestaurantConfig();
    }
  }, [cart]);

  // Calcular impuestos y envío
  // El carrito muestra SIEMPRE el costo_fijo configurado por el restaurante
  // (sin aplicar envío gratis por umbral). El envío gratis y el cálculo
  // por sector del barrio se evalúan únicamente en el Checkout, donde ya
  // se conoce la dirección del usuario. Mostrar "Gratis" aquí generaba
  // inconsistencia: el cliente veía envío gratis en el carrito pero al
  // pasar al checkout (con su barrio/sector) le aparecía el costo real.
  const shippingAmount = useMemo(() => {
    if (!shippingConfig.activo) {
      return 0;
    }
    return Number(shippingConfig.costo_fijo) || 0;
  }, [shippingConfig]);

  const taxAmount = useMemo(() => {
    const amount = taxConfig.activo && taxConfig.porcentaje > 0
      ? total * (taxConfig.porcentaje / 100)
      : 0;
    return amount;
  }, [taxConfig, total]);

  const totalWithTaxesAndShipping = total + taxAmount + shippingAmount;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-subtle)] flex items-center justify-center px-4">
        <div className="text-center py-12 max-w-md">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-scaleIn">
            <ShoppingCart size={40} className="text-primary mx-auto" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-[color:var(--text-primary)] mb-3">
            Tu carrito está vacío
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm sm:text-base md:text-lg mb-8">
            Explora nuestros locales y agrega algunos productos
          </p>
          <Link to="/" className="btn btn-primary btn-lg min-h-[48px] px-8">
            Explorar Locales
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-6 sm:py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-4 md:px-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-[color:var(--text-primary)] mb-6 sm:mb-8">
          Mi Carrito
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Productos */}
          <div className="lg:col-span-2">
            <div className="card-lg space-y-3 sm:space-y-4">
              {cart.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-[color:var(--border-default)] last:border-0 last:pb-0 animate-slideUp"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Imagen */}
                  <div className="w-full sm:w-24 h-40 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-[color:var(--bg-subtle)]">
                    {item.imagen_url ? (
                      <img
                        src={getImageUrl(item.imagen_url)}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-primary)] truncate">{item.nombre}</h3>
                    <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">{formatCurrency(item.precio)}</p>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 bg-[color:var(--bg-subtle)] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl">
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[color:var(--bg-elevated)] shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-bold text-[color:var(--text-primary)] text-base">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[color:var(--bg-elevated)] shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Subtotal y Eliminar */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 sm:gap-2">
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      {formatCurrency(item.precio * item.cantidad)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center rounded-lg transition-colors active:scale-95 touch-feedback"
                      style={{ color: 'var(--danger-text)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      aria-label="Eliminar producto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <Link to="/" className="btn btn-ghost flex-1 min-h-[48px]">
                Seguir Comprando
              </Link>
              <button
                onClick={clearCart}
                className="btn btn-outline flex-1 sm:flex-none min-h-[48px]"
              >
                Limpiar Carrito
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="card-lg sticky top-20 animate-slideUp">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-[color:var(--text-primary)] mb-4 sm:mb-6">
                Resumen del Pedido
              </h2>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-[color:var(--border-default)]">
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Envío:</span>
                  <span className="font-medium">
                    {!shippingConfig.activo
                      ? 'Gratis'
                      : formatCurrency(shippingAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Impuestos{taxConfig.activo ? ` (${taxConfig.porcentaje}%)` : ''}:</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <span className="text-base sm:text-lg font-bold text-[color:var(--text-primary)]">Total:</span>
                <span className="text-2xl sm:text-3xl font-heading font-bold text-primary">
                  {formatCurrency(totalWithTaxesAndShipping)}
                </span>
              </div>

              {/* Aviso de modalidad: si el restaurante desactivó domicilios,
                  bloqueamos el paso al checkout y dejamos un camino claro al
                  usuario: vaciar el carrito o elegir otro restaurante. */}
              {restaurante && restaurante.ofrece_domicilio !== undefined && !Boolean(Number(restaurante.ofrece_domicilio)) ? (
                <>
                  <div
                    className="mb-4 p-3 rounded-xl flex items-start gap-2 text-sm"
                    style={{
                      backgroundColor: 'var(--warning-bg)',
                      border: '1px solid var(--warning-border)',
                      color: 'var(--warning-text)',
                    }}
                  >
                    <Store size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Este local solo ofrece retiro en local. No podemos procesar tu pedido a domicilio.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="btn btn-primary btn-lg btn-block min-h-[48px] disabled:opacity-50"
                  >
                    Proceder al Pago
                  </button>
                </>
              ) : (
                <Link to="/checkout" className="btn btn-primary btn-lg btn-block min-h-[48px]">
                  Proceder al Pago
                </Link>
              )}

              <p className="text-xs text-[color:var(--text-muted)] text-center mt-4">
                {shippingConfig.envio_gratis_activo && Number(shippingConfig.envio_gratis_desde) > 0
                  ? `¡Envío gratis si tu pedido supera ${formatCurrency(Number(shippingConfig.envio_gratis_desde))}!`
                  : taxConfig.activo
                    ? 'Se incluyen impuestos'
                    : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

