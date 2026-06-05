import { X, Clock, MapPin, Phone, User, DollarSign, Package, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { orderService } from '../services/api';

const ORDER_STATE_STYLES = {
  Pendiente: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  Preparando: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Listo: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Entregado: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  Cancelado: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

export default function OrderDetailsModal({ isOpen, onClose, order }) {
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

  if (!isOpen || !order) return null;

  const displayOrder = fullOrderData || order;
  const styleClasses = ORDER_STATE_STYLES[displayOrder.estado] || ORDER_STATE_STYLES.Pendiente;
  const items = Array.isArray(displayOrder.items) ? displayOrder.items : displayOrder.detalles || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`${styleClasses.bg} ${styleClasses.border} border-b-2 p-6`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark">
                  Pedido #{displayOrder.id}
                </h2>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${styleClasses.bg} ${styleClasses.text} ${styleClasses.border}`}>
                  {displayOrder.estado}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/10 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Fecha: {displayOrder.creado_en ? new Date(displayOrder.creado_en).toLocaleString('es-CO') : 'No disponible'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="py-8 text-center">
              <Loader size={32} className="mx-auto text-primary animate-spin mb-3" />
              <p className="text-gray-600">Cargando detalles del pedido...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Cliente Info */}
              <section className="bg-light rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-dark text-lg flex items-center gap-2">
                  <User size={18} className="text-primary" />
                  Información del Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Nombre</p>
                    <p className="text-dark font-semibold mt-1">{displayOrder.cliente_nombre || 'No disponible'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1">
                      <Phone size={14} />
                      Teléfono
                    </p>
                    <p className="text-dark font-semibold mt-1">{displayOrder.cliente_telefono || 'No disponible'}</p>
                  </div>
                </div>
              </section>

              {/* Dirección */}
              {(displayOrder.direccion_entrega || displayOrder.direccion) && (
                <section className="bg-light rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-dark text-lg flex items-center gap-2">
                    <MapPin size={18} className="text-primary" />
                    Dirección de Entrega
                  </h3>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-dark">{displayOrder.direccion_entrega || displayOrder.direccion}</p>
                  </div>
                </section>
              )}

              {/* Productos */}
              <section className="bg-light rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-dark text-lg flex items-center gap-2">
                  <Package size={18} className="text-primary" />
                  Productos ({items.length || displayOrder.items_count || 0})
                </h3>
                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-dark truncate">{item.nombre || item.producto_nombre || 'Producto sin nombre'}</p>
                          <p className="text-sm text-gray-600">
                            {item.descripcion || item.producto_descripcion || 'Sin descripción'}
                          </p>
                          {item.especificaciones && (
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">Especificaciones:</span> {item.especificaciones}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-600">
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
                  <p className="text-gray-500 text-sm bg-white rounded-lg p-3">No hay detalles de productos disponibles</p>
                )}
              </section>

              {/* Resumen */}
              <section className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 space-y-3 border border-primary/20">
                <h3 className="font-bold text-dark text-lg">Resumen del Pedido</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold text-dark">${Number(displayOrder.subtotal || 0).toLocaleString('es-CO')}</span>
                  </div>
                  {displayOrder.descuento > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Descuento:</span>
                      <span className="font-semibold text-red-600">-${Number(displayOrder.descuento).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  {displayOrder.costo_envio > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Costo de envío:</span>
                      <span className="font-semibold text-dark">${Number(displayOrder.costo_envio).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 mt-2 flex items-center justify-between">
                    <span className="font-bold text-dark flex items-center gap-2">
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
                <section className="bg-light rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-dark">Notas del Pedido</h3>
                  <p className="text-gray-700 bg-white rounded-lg p-3 border border-gray-200">{displayOrder.notas}</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-light flex gap-3 justify-end">
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

