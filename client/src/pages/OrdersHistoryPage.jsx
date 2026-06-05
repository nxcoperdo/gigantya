import { useState, useEffect } from 'react';
import { Clock, CheckCircle, TrendingUp, Package, Star, Eye } from 'lucide-react';
import api from '../services/api';
import Loading from '../components/Loading';
import RatingModal from '../components/RatingModal';
import ThankYouModal from '../components/ThankYouModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { ratingService } from '../services/api';

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const fetchOrders = async () => {
    try {
      setLoading(true);
       const response = await api.get('/orders/client/my-orders');
      setOrders(response.data.pedidos || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pendiente':
        return <Clock className="text-yellow-500" size={24} />;
      case 'Preparando':
        return <TrendingUp className="text-blue-500" size={24} />;
      case 'Listo':
        return <Package className="text-purple-500" size={24} />;
      case 'Entregado':
        return <CheckCircle className="text-green-500" size={24} />;
      default:
        return <Clock size={24} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pendiente':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'Preparando':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'Listo':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'Entregado':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const filteredOrders = selectedStatus
    ? orders.filter(order => order.estado === selectedStatus)
    : orders;

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-light py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-8">
          Mis Pedidos
        </h1>

        {/* Status Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedStatus(null)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-300 ${
              selectedStatus === null
                ? 'bg-primary text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-primary'
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
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-primary'
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
                    <h3 className="text-2xl font-bold text-dark mb-1">
                      Pedido #{order.id}
                    </h3>
                    <p className="text-gray-600">
                      {order.restaurante_nombre}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold border-2 ${getStatusColor(order.estado)}`}>
                      {getStatusIcon(order.estado)}
                      <span>{order.estado}</span>
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Fecha</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(order.creado_en).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Hora</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(order.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Items</p>
                    <p className="font-semibold text-gray-800">{order.items_count} productos</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total</p>
                    <p className="text-2xl font-heading font-bold text-primary">
                      ${order.total?.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {order.notas && (
                  <>
                    <div className="divider" />
                    <div className="bg-light p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Notas:</strong> {order.notas}
                      </p>
                    </div>
                  </>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center gap-3 flex-wrap">
                  <p className="text-sm text-gray-500">
                    Última actualización: {new Date(order.actualizado_en).toLocaleString('es-CO')}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewOrderDetails(order)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all duration-300 active:scale-95 border border-gray-200"
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
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              No tienes pedidos
            </h2>
            <p className="text-gray-600 mb-6">
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

