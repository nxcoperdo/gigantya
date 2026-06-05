import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Star, MapPin, Clock, Phone, Plus, Minus } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import Loading from '../components/Loading';
import AddToCartModal from '../components/AddToCartModal';
import FavoriteButton from '../components/FavoriteButton';
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
     } catch (error) {
       console.error('Error fetching products:', error);
     } finally {
       setLoading(false);
     }
   };

  const groupedProductos = productos.reduce((acc, product) => {
    const catId = product.categoria_id || 'sin-categoria';
    const catName = product.categoria_nombre || 'Otros';
    const catOrden = product.categoria_orden || 999;

    if (!acc[catId]) {
      acc[catId] = {
        nombre: catName,
        orden: catOrden,
        productos: []
      };
    }
    acc[catId].productos.push(product);
    return acc;
  }, {});

  const sortedCategories = Object.entries(groupedProductos)
    .sort(([, a], [, b]) => a.orden - b.orden);

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
             src={getImageUrl(restaurante.imagen_url)}
             alt={restaurante.nombre}
             className="w-full h-full object-cover"
           />
         ) : (
           <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
             <span className="text-6xl">🍽️</span>
           </div>
         )}
         <div className="absolute inset-0 bg-black bg-opacity-40" />

         {/* Botón de Favorito sobre la imagen */}
         <div className="absolute top-4 right-4">
           <FavoriteButton targetId={restaurante.id} tipo="restaurant" />
         </div>
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

         {sortedCategories.length > 0 ? (
           <div className="space-y-12">
             {sortedCategories.map(([catId, catData]) => (
               <div key={catId} className="space-y-6">
                 <div className="flex items-center gap-4">
                   <h3 className="text-2xl font-bold text-dark">{catData.nombre}</h3>
                   <div className="flex-1 h-px bg-gray-200"></div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {catData.productos.map(producto => (
                     <div key={producto.id} className="card group hover:shadow-lg">
                       <div className="relative mb-4 overflow-hidden rounded-lg bg-light">
                         {producto.imagen_url ? (
                           <img
                             src={getImageUrl(producto.imagen_url)}
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
                           {formatCurrency(producto.precio)}
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
               </div>
             ))}
           </div>
         ) : (
           <div className="text-center py-12">
             <p className="text-gray-500 text-lg">No hay productos disponibles en el menú</p>
           </div>
         )}
       </div>
     </div>
   );
}
