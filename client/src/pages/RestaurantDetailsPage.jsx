import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Star, MapPin, Clock, Phone, Plus, Minus } from 'lucide-react';
import Loading from '../components/Loading';
import AddToCartModal from '../components/AddToCartModal';
import api from '../services/api';
import { useCart } from '../context/CartContext';

export default function RestaurantDetailsPage() {
  const { id } = useParams();
  const [restaurante, setRestaurante] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [productAdded, setProductAdded] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchRestaurant();
    fetchProductos();
  }, [id]);

   const fetchRestaurant = async () => {
     try {
       const res = await api.get(`/restaurants/${id}`);
       setRestaurante(res.data.restaurante);
     } catch (error) {
       console.error('Error fetching restaurant:', error);
     }
   };

   const fetchProductos = async () => {
     try {
       setLoading(true);
       const res = await api.get(`/products/restaurant/${id}`);
       setProductos(res.data.productos || []);
       if (res.data.productos?.length > 0) {
         const categorias = [...new Set(res.data.productos.map(p => p.categoria_id))];
         setSelectedCategory(categorias[0]);
       }
     } catch (error) {
       console.error('Error fetching products:', error);
     } finally {
       setLoading(false);
     }
   };

  const filteredProductos = selectedCategory
    ? productos.filter(p => p.categoria_id === selectedCategory)
    : productos;

  const categorias = [...new Map(productos.map(p => [p.categoria_id, p.categoria_nombre])).entries()];

   const handleAddToCart = (producto) => {
     addToCart(producto);
     const nuevaCantidad = (cantidades[producto.id] || 0) + 1;
     setCantidades(prev => ({ ...prev, [producto.id]: nuevaCantidad }));
     setProductAdded({ ...producto, cantidad: nuevaCantidad });
     setShowModal(true);
   };

  if (loading) return <Loading />;

  if (!restaurante) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Restaurante no encontrado</h1>
          <a href="/" className="btn btn-primary">Volver al inicio</a>
        </div>
      </div>
    );
  }

   return (
     <div className="min-h-screen bg-light">
       {/* Modal de Confirmación */}
       <AddToCartModal
         isOpen={showModal}
         onClose={() => setShowModal(false)}
         producto={productAdded}
         cantidad={productAdded?.cantidad || 1}
       />

       {/* Hero Section */}
      <div className="relative h-64 md:h-80 bg-gradient-warm overflow-hidden">
        {restaurante.imagen_url ? (
          <img
            src={restaurante.imagen_url}
            alt={restaurante.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-16 relative z-10">
        <div className="card-lg bg-white">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-3">
            {restaurante.nombre}
          </h1>
          
          <p className="text-gray-600 text-lg mb-6 max-w-2xl">
            {restaurante.descripcion}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="flex items-start gap-3">
              <Star className="text-primary mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-500">Calificación</p>
                <p className="text-xl font-bold text-gray-800">{restaurante.calificacion || '5.0'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="text-primary mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-500">Horario</p>
                <p className="text-lg font-semibold text-gray-800">
                  {restaurante.horario_apertura?.slice(0, 5)} - {restaurante.horario_cierre?.slice(0, 5)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="text-primary mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="text-lg font-semibold text-gray-800">{restaurante.telefono}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="text-primary mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-500">Ubicación</p>
                <p className="text-lg font-semibold text-gray-800">{restaurante.ciudad}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-8 text-dark">Menú</h2>

        {/* Category Filter */}
        {categorias.length > 0 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {categorias.map(([catId, catName]) => (
              <button
                key={catId}
                onClick={() => setSelectedCategory(catId)}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === catId
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-primary hover:bg-light'
                }`}
              >
                {catName}
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {filteredProductos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProductos.map(producto => (
              <div key={producto.id} className="card group hover:shadow-lg">
                <div className="relative mb-4 overflow-hidden rounded-lg bg-light">
                  {producto.imagen_url ? (
                    <img
                      src={producto.imagen_url}
                      alt={producto.nombre}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-4xl">
                      🍽️
                    </div>
                  )}
                  {!producto.disponible && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="badge badge-error">No disponible</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-dark mb-2">
                  {producto.nombre}
                </h3>
                <p className="text-gray-600 text-sm mb-4 text-ellipsis-2">
                  {producto.descripcion}
                </p>

                <div className="flex justify-between items-end">
                  <p className="text-2xl font-heading font-bold text-primary">
                    ${producto.precio?.toLocaleString('es-CO')}
                  </p>
                </div>

                <button
                  onClick={() => handleAddToCart(producto)}
                  disabled={!producto.disponible}
                  className="btn btn-primary w-full mt-4 disabled:opacity-50"
                >
                  <Plus size={18} className="inline mr-2" />
                  Agregar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay productos en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}

