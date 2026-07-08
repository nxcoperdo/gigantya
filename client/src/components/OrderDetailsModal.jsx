import { X, Clock, MapPin, Phone, User, DollarSign, Package, Loader, Tag, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { orderService } from '../services/api';
import AddressMapPreview from './AddressMapPreview';
import { formatDateTime } from '../utils/dateHelper';

const ORDER_STATE_STYLES = {
  Pendiente:  { bg: 'var(--warning-bg)',         text: 'var(--warning-text)',         border: 'var(--warning-border)' },
  Preparando: { bg: 'var(--info-bg)',            text: 'var(--info-text)',            border: 'var(--info-border)' },
  Listo:      { bg: 'var(--accent-purple-bg)',   text: 'var(--accent-purple-text)',   border: 'var(--border-subtle)' },
  Entregado:  { bg: 'var(--success-bg)',         text: 'var(--success-text)',         border: 'var(--success-border)' },
  Cancelado:  { bg: 'var(--danger-bg)',          text: 'var(--danger-text)',          border: 'var(--danger-border)' },
};

const PAYMENT_METHOD_LABELS = {
  contra_entrega: 'Contra entrega',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bre_b: 'BreezB',
};

export default function OrderDetailsModal({ isOpen, onClose, order, autoPrint = false }) {
  const [fullOrderData, setFullOrderData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && order?.id && !order.items) {
      // Si el order no tiene items, hacer un call a la API para obtener los detalles completos
      const fetchOrderDetails = async () => {
        try {
          setLoading(true);
          const response = await orderService.getById(order.id);
          setFullOrderData(response.data?.pedido || response.data);
        } catch (err) {
          console.error('Error cargando detalles del pedido:', err);
          setFullOrderData(order);
        } finally {
          setLoading(false);
        }
      };

      fetchOrderDetails();
    } else if (isOpen && order) {
      setFullOrderData(order);
      setLoading(false);
    }
  }, [isOpen, order]);

  // Si llega con autoPrint=true, disparamos window.print() una vez que
  // los datos estén listos. Marcamos el body con `printing-order` para que
  // el CSS @media print oculte el chrome del modal y muestre solo el
  // contenido. Limpiamos al cerrar (afterprint o unmount).
  useEffect(() => {
    if (!isOpen || !autoPrint) return undefined;
    if (loading) return undefined;

    document.body.classList.add('printing-order');
    const afterPrint = () => {
      document.body.classList.remove('printing-order');
    };
    window.addEventListener('afterprint', afterPrint);

    // Pequeño delay para que el navegador renderice el modal con el contenido
    // completo antes de abrir el diálogo de impresión.
    const timer = setTimeout(() => {
      window.print();
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', afterPrint);
      document.body.classList.remove('printing-order');
    };
  }, [isOpen, autoPrint, loading]);

  if (!isOpen || !order) return null;

  const displayOrder = fullOrderData || order;
  const styleClasses = ORDER_STATE_STYLES[displayOrder.estado] || ORDER_STATE_STYLES.Pendiente;
  const items = Array.isArray(displayOrder.items) ? displayOrder.items : displayOrder.detalles || [];
  const stateStyle = {
    backgroundColor: styleClasses.bg,
    borderColor: styleClasses.border
  };
  const stateBadgeStyle = {
    backgroundColor: styleClasses.bg,
    color: styleClasses.text,
    borderColor: styleClasses.border
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn printing-modal-backdrop">
      <div className="printing-modal-wrapper bg-[color:var(--bg-elevated)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] overflow-y-auto">
        <div className="order-print-content">
        {/* Header */}
        <div className="border-b-2 p-6" style={stateStyle}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[color:var(--text-primary)]">
                  Pedido #{displayOrder.id}
                </h2>
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2"
                  style={stateBadgeStyle}
                >
                  {displayOrder.estado}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/10 rounded-lg transition-colors no-print"
              aria-label="Cerrar"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-sm text-[color:var(--text-secondary)]">
            Fecha: {displayOrder.creado_en ? formatDateTime(displayOrder.creado_en) : 'No disponible'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="py-8 text-center">
              <Loader size={32} className="mx-auto text-primary animate-spin mb-3" />
              <p className="text-[color:var(--text-secondary)]">Cargando detalles del pedido...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Cliente Info */}
              <section className="bg-[color:var(--bg-subtle)] rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[color:var(--text-primary)] text-lg flex items-center gap-2">
                  <User size={18} className="text-primary" />
                  Información del Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)]">
                    <p className="text-xs text-[color:var(--text-muted)] font-semibold uppercase">Nombre</p>
                    <p className="text-[color:var(--text-primary)] font-semibold mt-1">{displayOrder.cliente_nombre || 'No disponible'}</p>
                  </div>
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)]">
                    <p className="text-xs text-[color:var(--text-muted)] font-semibold uppercase flex items-center gap-1">
                      <Phone size={14} />
                      Teléfono
                    </p>
                    <p className="text-[color:var(--text-primary)] font-semibold mt-1">{displayOrder.cliente_telefono || 'No disponible'}</p>
                  </div>
                  <div className="bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)]">
                    <p className="text-xs text-[color:var(--text-muted)] font-semibold uppercase flex items-center gap-1">
                      <DollarSign size={14} />
                      Método de Pago
                    </p>
                    <p className="text-[color:var(--text-primary)] font-semibold mt-1">
                      {PAYMENT_METHOD_LABELS[displayOrder.metodo_pago] || displayOrder.metodo_pago || 'No definido'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Dirección */}
              {(displayOrder.direccion_entrega || displayOrder.direccion) && (
                <section className="bg-[color:var(--bg-subtle)] rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-[color:var(--text-primary)] text-lg flex items-center gap-2">
                    <MapPin size={18} className="text-primary" />
                    Dirección de Entrega
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)]">
                      <p className="text-[color:var(--text-primary)] font-semibold">
                        {displayOrder.direccion_formateada || displayOrder.direccion_entrega || displayOrder.direccion}
                      </p>
                      {displayOrder.direccion_formateada && displayOrder.direccion_entrega && displayOrder.direccion_formateada !== displayOrder.direccion_entrega && (
                        <p className="text-xs text-[color:var(--text-muted)] mt-1">
                          Referencia cliente: {displayOrder.direccion_entrega}
                        </p>
                      )}
                    </div>

                    {/*
                      AddressMapPreview muestra el mapa con coordenadas si
                      existen; si no, geocodifica el texto de la dirección
                      (siempre anclado a "Gigante, Huila, Colombia"). Así el
                      restaurante siempre ve el mapita, incluso para pedidos
                      hechos con fallback manual sin coordenadas.
                      Se oculta al imprimir (no-print) porque no tiene sentido
                      en un ticket.
                    */}
                    <div className="no-print">
                      <AddressMapPreview
                        latitud={displayOrder.latitud}
                        longitud={displayOrder.longitud}
                        direccion={
                          displayOrder.direccion_formateada ||
                          displayOrder.direccion_entrega ||
                          displayOrder.direccion
                        }
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Productos */}
              <section className="bg-[color:var(--bg-subtle)] rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-[color:var(--text-primary)] text-lg flex items-center gap-2">
                  <Package size={18} className="text-primary" />
                  Productos ({items.length || displayOrder.items_count || 0})
                </h3>
                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)] flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[color:var(--text-primary)] truncate">{item.nombre || item.producto_nombre || 'Producto sin nombre'}</p>
                          <p className="text-sm text-[color:var(--text-secondary)]">
                            {item.descripcion || item.producto_descripcion || 'Sin descripción'}
                          </p>
                          {item.especificaciones && (
                            <p className="text-xs text-[color:var(--text-muted)] mt-1">
                              <span className="font-medium">Especificaciones:</span> {item.especificaciones}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-[color:var(--text-secondary)]">
                            {item.cantidad || 1}x
                          </p>
                          <p className="font-bold text-primary text-lg">
                            ${Number(item.subtotal || item.precio || 0).toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[color:var(--text-muted)] text-sm bg-[color:var(--bg-elevated)] rounded-lg p-3">No hay detalles de productos disponibles</p>
                )}
              </section>

              {/* Resumen */}
              <section className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 space-y-3 border border-primary/20">
                <h3 className="font-bold text-[color:var(--text-primary)] text-lg">Resumen del Pedido</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--text-secondary)]">Subtotal:</span>
                    <span className="font-semibold text-[color:var(--text-primary)]">${Number(displayOrder.subtotal || 0).toLocaleString('es-CO')}</span>
                  </div>
                  {displayOrder.cupon_codigo && (
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--success-bg)' }}
                    >
                      <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--success-text)' }}>
                        <Tag size={16} />
                        Cupón: {displayOrder.cupon_codigo}
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--success-text)' }}>
                        {displayOrder.cupon_tipo_descuento === 'porcentaje'
                          ? `${displayOrder.cupon_descuento}%`
                          : `$${Number(displayOrder.cupon_descuento).toLocaleString('es-CO')}`}
                      </span>
                    </div>
                  )}
                  {displayOrder.descuento > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[color:var(--text-secondary)]">Descuento:</span>
                      <span className="font-semibold" style={{ color: 'var(--danger-text)' }}>-${Number(displayOrder.descuento).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--text-secondary)]">Envío:</span>
                    <span
                      className={displayOrder.costo_envio === 0 ? 'font-semibold' : ''}
                      style={displayOrder.costo_envio === 0 ? { color: 'var(--success-text)' } : undefined}
                    >
                      {displayOrder.costo_envio === 0 ? 'Gratis' : `$${Number(displayOrder.costo_envio).toLocaleString('es-CO')}`}
                    </span>
                  </div>
                  <div className="border-t border-[color:var(--border-default)] pt-2 mt-2 flex items-center justify-between">
                    <span className="font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                      <DollarSign size={18} className="text-primary" />
                      Total:
                    </span>
                    <span className="text-2xl font-heading font-bold text-primary">
                      ${Number(displayOrder.total || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </section>

              {/* Notas */}
              {displayOrder.notas && (
                <section className="bg-[color:var(--bg-subtle)] rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-[color:var(--text-primary)]">Notas del Pedido</h3>
                  <p className="text-[color:var(--text-secondary)] bg-[color:var(--bg-elevated)] rounded-lg p-3 border border-[color:var(--border-default)]">{displayOrder.notas}</p>
                </section>
              )}
            </>
          )}
        </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[color:var(--border-default)] p-6 bg-[color:var(--bg-subtle)] flex gap-3 justify-end no-print">
          <button
            onClick={() => window.print()}
            className="btn btn-outline inline-flex items-center gap-2"
            title="Imprimir este pedido"
          >
            <Printer size={16} />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="btn btn-outline"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

