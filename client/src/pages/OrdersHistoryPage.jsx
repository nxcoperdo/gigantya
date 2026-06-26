import { useState, useEffect } from 'react';
import { Clock, CheckCircle, TrendingUp, Package, Star, Eye, RefreshCcw } from 'lucide-react';
import api from '../services/api';
import Loading from '../components/Loading';
import RatingModal from '../components/RatingModal';
import ThankYouModal from '../components/ThankYouModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { ratingService } from '../services/api';

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [ratingModal, setRatingModal] = useState({ isOpen: false, pedidoId: null, restauranteId: null, restauranteNombre: '' });
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRateRestaurant = (pedido_id, restaurante_id, restaurante_nombre) => {
    setRatingModal({ isOpen: true, pedidoId: pedido_id, restauranteId: restaurante_id, restauranteNombre: restaurante_nombre });
  };

  const handleViewOrderDetails = (order) => {
    setSelectedOrderForDetails(order);
    setIsOrderDetailsModalOpen(true);
  };

  const submitRating = async ({ rating, comment }) => {
    try {
      await ratingService.rateRestaurant({
        pedido_id: ratingModal.pedidoId,
        restaurante_id: ratingModal.restauranteId,
        puntuacion: rating,
        comentario: comment
      });
      // Cerrar modal de calificación y abrir modal de agradecimiento animado
      setRatingModal({ ...ratingModal, isOpen: false });
      setThankYouOpen(true);
      // Cerrar automáticamente tras 2.5s
      setTimeout(() => setThankYouOpen(false), 2500);
    } catch (error) {
      throw error;
    }
  };

  const fetchOrders = async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const response = await api.get('/orders/client/my-orders');
      setOrders(response.data.pedidos || []);
      setLastRefreshedAt(new Date());
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      if (showSpinner) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      fetchOrders({ showSpinner: false });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pendiente':
        return <Clock style={{ color: 'var(--warning-text)' }} size={24} />;
      case 'Preparando':
        return <TrendingUp style={{ color: 'var(--info-text)' }} size={24} />;
      case 'Listo':
        return <Package style={{ color: 'var(--accent-purple-text)' }} size={24} />;
      case 'Entregado':
        return <CheckCircle style={{ color: 'var(--success-text)' }} size={24} />;
      default:
        return <Clock size={24} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pendiente':
        return { backgroundColor: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)' };
      case 'Preparando':
        return { backgroundColor: 'var(--info-bg)', borderColor: 'var(--info-border)', color: 'var(--info-text)' };
      case 'Listo':
        return { backgroundColor: 'var(--accent-purple-bg)', borderColor: 'var(--border-subtle)', color: 'var(--accent-purple-text)' };
      case 'Entregado':
        return { backgroundColor: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' };
      default:
        return { backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' };
    }
  };

  const filteredOrders = selectedStatus
    ? orders.filter(order => order.estado === selectedStatus)
    : orders;

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-[color:var(--bg-subtle)] py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-[color:var(--text-primary)]">
            Mis Pedidos
          </h1>
          <div className="flex flex-col items-start md:items-end gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="btn btn-outline inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Refrescar pedidos"
            >
              <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualizando…' : 'Refrescar'}
            </button>
            {lastRefreshedAt && (
              <span className="text-xs text-[color:var(--text-muted)]">
                Última actualización: {lastRefreshedAt.toLocaleString('es-CO')}
              </span>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedStatus(null)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-300 ${
              selectedStatus === null
                ? 'bg-primary text-white shadow-lg'
                : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-2 border-[color:var(--border-default)] hover:border-primary'
            }`}
          >
            Todos ({orders.length})
          </button>
          {['Pendiente', 'Preparando', 'Listo', 'Entregado'].map(status => {
            const count = orders.filter(o => o.estado === status).length;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-300 ${
                  selectedStatus === status
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-2 border-[color:var(--border-default)] hover:border-primary'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className="card-lg hover:shadow-lg animate-slideUp cursor-pointer transition-all duration-300 hover:transform hover:translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-[color:var(--text-primary)] mb-1">
                      Pedido #{order.id}
                    </h3>
                    <p className="text-[color:var(--text-secondary)]">
                      {order.restaurante_nombre}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold border-2"
                      style={getStatusColor(order.estado)}
                    >
                      {getStatusIcon(order.estado)}
                      <span>{order.estado}</span>
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-[color:var(--text-muted)] mb-1">Fecha</p>
                    <p className="font-semibold text-[color:var(--text-primary)]">
                      {new Date(order.creado_en).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[color:var(--text-muted)] mb-1">Hora</p>
                    <p className="font-semibold text-[color:var(--text-primary)]">
                      {new Date(order.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[color:var(--text-muted)] mb-1">Items</p>
                    <p className="font-semibold text-[color:var(--text-primary)]">{order.items_count} productos</p>
                  </div>
                  <div>
                    <p className="text-sm text-[color:var(--text-muted)] mb-1">Total</p>
                    <p className="text-2xl font-heading font-bold text-primary">
                      ${order.total?.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {order.notas && (
                  <>
                    <div className="divider" />
                    <div className="bg-[color:var(--bg-subtle)] p-3 rounded-lg">
                      <p className="text-sm text-[color:var(--text-secondary)]">
                        <strong>Notas:</strong> {order.notas}
                      </p>
                    </div>
                  </>
                )}

                <div className="mt-4 pt-4 border-t border-[color:var(--border-default)] flex justify-between items-center gap-3 flex-wrap">
                  <p className="text-sm text-[color:var(--text-muted)]">
                    Última actualización: {new Date(order.actualizado_en).toLocaleString('es-CO')}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewOrderDetails(order)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-all duration-300 active:scale-95 border border-[color:var(--border-default)]"
                      title="Ver detalles del pedido"
                    >
                      <Eye size={16} />
                      Detalles
                    </button>

                    {order.estado === 'Entregado' && (
                      <button
                        onClick={() => handleRateRestaurant(order.id, order.restaurante_id, order.restaurante_nombre)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-all duration-300 active:scale-95"
                      >
                        <Star size={16} fill="currentColor" />
                        Calificar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 card-lg">
            <Package size={80} className="text-primary mb-6 mx-auto opacity-30" />
            <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-2">
              No tienes pedidos
            </h2>
            <p className="text-[color:var(--text-secondary)] mb-6">
              {selectedStatus
                ? `No hay pedidos con estado "${selectedStatus}"`
                : 'Realiza tu primer pedido ahora'}
            </p>
            <a href="/" className="btn btn-primary">
              Explorar Restaurantes
            </a>
          </div>
        )}
      </div>

      <RatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ ...ratingModal, isOpen: false })}
        restaurantName={ratingModal.restauranteNombre}
        onSubmit={submitRating}
      />
      <ThankYouModal isOpen={thankYouOpen} onClose={() => setThankYouOpen(false)} />
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrderForDetails}
      />
    </div>
  );
}

