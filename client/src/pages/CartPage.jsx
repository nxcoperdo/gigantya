import { useState, useEffect, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart, Store, Utensils } from 'lucide-react';
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

  // Calcular impuestos y envío.
  // - Impuestos: se muestran tal cual los configura el restaurante
  //   (son un % del subtotal, no dependen de la dirección).
  // - Envío: SIEMPRE 0 en el carrito. El costo real se calcula en el
  //   checkout cuando ya sabemos la dirección del cliente (y, si el
  //   local tiene envíos por sector, el barrio elegido). Mostrar el
  //   `costo_fijo` global acá generaba confusión: el cliente veía un
  //   número y al pasar al checkout (con su barrio/sector) le aparecía
  //   otro, distinto, dependiendo del sector. Por eso la línea de
  //   "Envío" en el cart dice "Gratis (se calcula en el checkout)"
  //   cuando el local ofrece envío, y "Gratis (retiro en local)" o
  //   "Gratis (consumo en el local)" cuando el local es solo-retiro o
  //   solo-consumo.
  // - Si el local es de SOLO RETIRO o SOLO CONSUMO en el local
  //   (ofrece_domicilio=0), el envío es 0 sin importar la
  //   configuracion_envios del restaurante.
  const esRetiroLocalCart = restaurante && restaurante.ofrece_domicilio !== undefined
    && !Boolean(Number(restaurante.ofrece_domicilio));

  // En el cart no sabemos todavía si el cliente va a elegir envío,
  // retiro o consumo en el local. Como en cualquier caso el cálculo
  // final del envío pasa en el checkout, acá siempre mostramos 0.
  const shippingAmount = 0;

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
                  key={item.line_id}
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
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent">
                        <Utensils size={36} className="text-white/80" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-primary)] truncate">{item.nombre}</h3>
                    <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">{formatCurrency(item.precio)}</p>

                    {/* Adiciones elegidas. Si la adición tiene
                        `grupo_nombre` (poblado por el ProductCustomizationModal
                        o por un pedido viejo que vino del backend), se
                        muestra como heading. Adiciones sueltas (sin
                        grupo) quedan sin heading. */}
                    {item.adiciones && item.adiciones.length > 0 && (() => {
                      const grupos = [];
                      const indexByGrupo = new Map();
                      for (const a of item.adiciones) {
                        const key = a.grupo_nombre || null;
                        if (!indexByGrupo.has(key)) {
                          indexByGrupo.set(key, grupos.length);
                          grupos.push({ grupo: key, items: [] });
                        }
                        grupos[indexByGrupo.get(key)].items.push(a);
                      }
                      return (
                        <ul className="mt-1 space-y-0.5">
                          {grupos.map((g, gi) => (
                            <Fragment key={`${item.line_id}-grupo-${gi}`}>
                              {g.grupo && (
                                <li className="text-[11px] font-semibold text-[color:var(--text-muted)] uppercase tracking-wide mt-1">
                                  {g.grupo}:
                                </li>
                              )}
                              {g.items.map((a) => (
                                <li
                                  key={a.adicion_id}
                                  className="text-xs text-[color:var(--text-secondary)] flex items-center gap-1"
                                >
                                  <Plus size={10} className="text-primary flex-shrink-0" aria-hidden="true" />
                                  <span>
                                    {a.cantidad > 1 ? `${a.cantidad}× ` : ''}{a.nombre}
                                    {a.precio_extra > 0 && (
                                      <span className="text-[color:var(--text-muted)]"> (+{formatCurrency(a.precio_extra * a.cantidad)})</span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </Fragment>
                          ))}
                        </ul>
                      );
                    })()}

                    {/* Ingredientes quitados */}
                    {item.removidos && item.removidos.length > 0 && (
                      <p className="text-xs text-[color:var(--text-muted)] mt-1">
                        <span className="font-semibold">Sin:</span>{' '}
                        <span className="line-through">
                          {item.removidos.map(r => r.nombre).join(', ')}
                        </span>
                      </p>
                    )}

                    {/* Nota libre */}
                    {item.nota && (
                      <p className="text-xs italic text-[color:var(--text-secondary)] mt-1">
                        "{item.nota}"
                      </p>
                    )}
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 bg-[color:var(--bg-subtle)] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.line_id, item.cantidad - 1)}
                      className="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[color:var(--bg-elevated)] shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-bold text-[color:var(--text-primary)] text-base">
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.line_id, item.cantidad + 1)}
                      className="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[color:var(--bg-elevated)] shadow-sm text-primary hover:text-primaryDark transition-colors active:scale-95 touch-feedback"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Subtotal y Eliminar */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 sm:gap-2 pt-3 mt-3 border-t border-[color:var(--border-subtle)] sm:border-0 sm:pt-0 sm:mt-0">
                    <p className="text-xl sm:text-2xl font-heading font-bold text-primary">
                      {formatCurrency((item.precio_unitario_final || item.precio) * item.cantidad)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.line_id)}
                      className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-colors active:scale-95 touch-feedback"
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
                    {!configLoaded ? (
                      <span className="skeleton inline-block h-3 w-24 align-middle" />
                    ) : esRetiroLocalCart
                      ? 'Gratis (retiro en local)'
                      : '(se calcula en el checkout)'}
                  </span>
                </div>
                <div className="flex justify-between text-[color:var(--text-secondary)] text-sm sm:text-base">
                  <span>Impuestos{taxConfig.activo ? ` (${taxConfig.porcentaje}%)` : ''}:</span>
                  {!configLoaded ? (
                    <span className="skeleton inline-block h-3 w-16 align-middle" />
                  ) : (
                    <span>{formatCurrency(taxAmount)}</span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <span className="text-base sm:text-lg font-bold text-[color:var(--text-primary)]">Total:</span>
                <span className="text-2xl sm:text-3xl font-heading font-bold text-primary">
                  {formatCurrency(totalWithTaxesAndShipping)}
                </span>
              </div>

              {/* Aviso de modalidad: si el restaurante es "solo retiro en mostrador",
                  dejamos un cartel informativo y permitimos avanzar al checkout.
                  El checkout y el backend se encargan de forzar nulls en la
                  dirección y costo_envio=0. */}
              {restaurante && restaurante.ofrece_domicilio !== undefined && !Boolean(Number(restaurante.ofrece_domicilio)) && (
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
                    Este local solo ofrece retiro en mostrador. No hace falta
                    dirección de envío: retirás tu pedido en el local.
                  </span>
                </div>
              )}

              <Link
                to="/checkout"
                className="btn btn-primary btn-lg btn-block min-h-[48px]"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                Proceder al Pago
              </Link>

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

