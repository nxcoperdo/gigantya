import { useState, useEffect } from 'react';
import { ShoppingBag, Calendar, DollarSign, TrendingUp, Eye } from 'lucide-react';
import { orderService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../utils/dateHelper';

export default function PurchaseHistoryTab() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('todos');

  const statusColors = {
    'Pendiente':  { backgroundColor: 'var(--warning-bg)',       color: 'var(--warning-text)' },
    'Preparando': { backgroundColor: 'var(--info-bg)',          color: 'var(--info-text)' },
    'Listo':      { backgroundColor: 'var(--accent-purple-bg)', color: 'var(--accent-purple-text)' },
    'Entregado':  { backgroundColor: 'var(--success-bg)',       color: 'var(--success-text)' },
    'Cancelado':  { backgroundColor: 'var(--danger-bg)',        color: 'var(--danger-text)' }
  };

  // Cargar pedidos
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await orderService.getClientOrders();
      setOrders(res.data.pedidos || []);
      setError('');
    } catch (err) {
      setError('Error cargando historial de compras');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pedidos
  const filteredOrders = filter === 'todos' 
    ? orders
    : orders.filter(order => order.estado === filter);

  // Estadísticas
  const stats = {
    total: orders.length,
    gastado: orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0),
    promedio: orders.length > 0 
      ? (orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0) / orders.length).toFixed(2)
      : 0,
    ultimos30: orders.filter(order => {
      const daysDiff = (new Date() - new Date(order.creado_en)) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[color:var(--text-primary)] mb-6 flex items-center gap-2">
        <ShoppingBag className="text-primary" size={24} />
        Historial de Compras
      </h2>

      {error && (
        <div className="alert alert-error animate-slideDown">
          ✕ {error}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-lg bg-gradient-to-br from-primary to-primaryDark text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Pedidos</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <ShoppingBag size={40} className="opacity-30" />
          </div>
        </div>

        <div className="card-lg bg-gradient-to-br from-green-500 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Gastado Total</p>
              <p className="text-3xl font-bold">
                ${stats.gastado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign size={40} className="opacity-30" />
          </div>
        </div>

        <div className="card-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Promedio Pedido</p>
              <p className="text-3xl font-bold">
                ${parseFloat(stats.promedio).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <TrendingUp size={40} className="opacity-30" />
          </div>
        </div>

        <div className="card-lg bg-gradient-to-br from-purple-500 to-purple-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Últimos 30 Días</p>
              <p className="text-3xl font-bold">{stats.ultimos30}</p>
            </div>
            <Calendar size={40} className="opacity-30" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos', 'Pendiente', 'Preparando', 'Listo', 'Entregado'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`btn text-sm ${
              filter === status
                ? 'btn-primary'
                : 'btn-outline'
            }`}
          >
            {status === 'todos' ? '📋 Todos' : status}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-[color:var(--bg-subtle)] rounded-lg">
            <ShoppingBag className="w-16 h-16 mx-auto text-[color:var(--text-subtle)] mb-4" />
            <p className="text-[color:var(--text-secondary)]">
              {orders.length === 0 
                ? 'Aún no has realizado ningún pedido'
                : `No hay pedidos con estado "${filter}"`}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="card-lg hover:shadow-lg transition-shadow">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] px-3 py-1 rounded">
                      Pedido #{order.id}
                    </span>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded"
                      style={statusColors[order.estado] || { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
                    >
                      {order.estado}
                    </span>
                  </div>

                  <p className="text-sm text-[color:var(--text-secondary)] mb-1">
                    📅 {formatDateTime(order.creado_en)}
                  </p>

                  {order.direccion_entrega && (
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      📍 {order.direccion_entrega}
                    </p>
                  )}
                </div>

                <div className="md:text-right">
                  <p className="text-2xl font-bold text-primary">
                    ${parseFloat(order.total).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                  <button
                    onClick={() => navigate(`/orders`)}
                    className="btn btn-ghost text-xs mt-2 flex items-center gap-2 justify-end"
                  >
                    <Eye size={16} />
                    Ver Detalles
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

