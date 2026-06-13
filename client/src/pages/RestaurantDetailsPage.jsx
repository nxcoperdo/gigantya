import { useParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { Star, MapPin, Clock, Phone, Plus, Minus, User } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import Loading from '../components/Loading';
import AddToCartModal from '../components/AddToCartModal';
import FavoriteButton from '../components/FavoriteButton';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { ratingService } from '../services/api';

export default function RestaurantDetailsPage() {
  const { id } = useParams();
  const [restaurante, setRestaurante] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [productAdded, setProductAdded] = useState(null);
  const [ratings, setRatings] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchRestaurant();
    fetchProductos();
    fetchRatings();
  }, [id]);

  const fetchRatings = async () => {
    try {
      const res = await ratingService.getRestaurantRatings(id);
      setRatings(res.data);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  };

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
     const result = addToCart(producto);

     if (!result.success) {
       alert(result.error);
       return;
     }

     const nuevaCantidad = (cantidades[producto.id] || 0) + 1;
     setCantidades(prev => ({ ...prev, [producto.id]: nuevaCantidad }));
     setProductAdded({ ...producto, cantidad: nuevaCantidad });
     setShowModal(true);
   };

  const radiusMap = {
    small: '4px',
    medium: '12px',
    large: '24px',
  };

  const dynamicStyles = useMemo(() => {
    if (!restaurante?.custom_config) return {};
    const config = restaurante.custom_config;
    return {
      '--color-primary': config.primaryColor || 'var(--color-primary)',
      '--color-secondary': config.secondaryColor || 'var(--color-secondary)',
      '--font-family': config.fontFamily || 'Inter',
      '--border-radius': radiusMap[config.borderRadius] || '12px',
    };
  }, [restaurante]);

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
     <div
       className="min-h-screen bg-light"
       style={{
         ...dynamicStyles,
         fontFamily: 'var(--font-family), sans-serif'
       }}
     >
       {/* Modal de Confirmación */}
       <AddToCartModal
         isOpen={showModal}
         onClose={() => setShowModal(false)}
         producto={productAdded}
         cantidad={productAdded?.cantidad || 1}
       />

       {/* Hero Section */}
       <div className="relative h-56 sm:h-64 md:h-80 bg-gradient-warm overflow-hidden">
         {restaurante.imagen_url ? (
           <img
             src={getImageUrl(restaurante.imagen_url)}
             alt={restaurante.nombre}
             className="w-full h-full object-cover"
             loading="lazy"
           />
         ) : (
           <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
             <span className="text-5xl sm:text-6xl">🍽️</span>
           </div>
         )}
         <div className="absolute inset-0 bg-black bg-opacity-40" />

         {/* Botón de Favorito sobre la imagen */}
         <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20">
           <FavoriteButton targetId={restaurante.id} tipo="restaurant" />
         </div>
       </div>

       {/* Info Section */}
       <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 -mt-12 sm:-mt-16 relative z-10">
         <div className="card-lg bg-white" style={{ borderRadius: 'var(--border-radius)' }}>
           {restaurante.custom_config?.logoUrl && (
             <div className="flex justify-center mb-4 sm:mb-6">
               <img
                 src={getImageUrl(restaurante.custom_config.logoUrl)}
                 alt="Restaurant Logo"
                 className="max-h-16 sm:max-h-24 w-auto object-contain"
                 onError={(e) => { e.target.style.display = 'none'; }}
                 loading="lazy"
               />
             </div>
           )}
           <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-dark mb-2 sm:mb-3 px-2" style={{ fontFamily: 'var(--font-family)' }}>
             {restaurante.nombre}
           </h1>

           <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-4 sm:mb-6 max-w-2xl px-2">
             {restaurante.descripcion}
           </p>

           <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 px-2">
             <div className="flex items-start gap-2 sm:gap-3">
               <Star className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-gray-500">Calificación</p>
                 <p className="text-lg sm:text-xl font-bold text-gray-800">{restaurante.calificacion || '5.0'}</p>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <Clock className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-gray-500">Horario</p>
                 <p className="text-sm sm:text-lg font-semibold text-gray-800 truncate">
                   {restaurante.horario_apertura?.slice(0, 5)} - {restaurante.horario_cierre?.slice(0, 5)}
                 </p>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <Phone className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-gray-500">Teléfono</p>
                 <p className="text-sm sm:text-lg font-semibold text-gray-800">{restaurante.telefono}</p>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <MapPin className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-gray-500">Ubicación</p>
                 <p className="text-sm sm:text-lg font-semibold text-gray-800 truncate">{restaurante.ciudad}</p>
               </div>
             </div>
           </div>
         </div>
       </div>

       {/* Menu Section */}
       <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
         <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 px-2" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>Menú</h2>

         {sortedCategories.length > 0 ? (
           <div className="space-y-8 sm:space-y-10 md:space-y-12">
             {sortedCategories.map(([catId, catData]) => (
               <div key={catId} className="space-y-4 sm:space-y-6 px-2">
                 <div className="flex items-center gap-3 sm:gap-4">
                   <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-dark">{catData.nombre}</h3>
                   <div className="flex-1 h-px bg-gray-200"></div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                   {catData.productos.map((producto, idx) => (
                     <div key={producto.id} className="card group hover:shadow-lg animate-scaleIn" style={{ borderRadius: 'var(--border-radius)', animationDelay: `${idx * 50}ms` }}>
                       <div className="relative mb-3 sm:mb-4 overflow-hidden rounded-lg bg-light">
                         {producto.imagen_url ? (
                           <img
                             src={getImageUrl(producto.imagen_url)}
                             alt={producto.nombre}
                             className="w-full h-40 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                             loading="lazy"
                           />
                         ) : (
                           <div className="w-full h-40 sm:h-48 flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-3xl sm:text-4xl">
                             🍽️
                           </div>
                         )}
                         {!producto.disponible && (
                           <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                             <span className="badge badge-error">No disponible</span>
                           </div>
                         )}
                       </div>

                       <div className="px-1">
                         <h3 className="text-base sm:text-lg md:text-xl font-bold text-dark mb-1.5 sm:mb-2 line-clamp-2 min-h-[44px]">
                           {producto.nombre}
                         </h3>
                         <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2 min-h-[36px]">
                           {producto.descripcion}
                         </p>

                         <div className="flex justify-between items-end mb-3">
                           <p className="text-lg sm:text-xl md:text-2xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>
                             {formatCurrency(producto.precio)}
                           </p>
                         </div>

                         <button
                           onClick={() => handleAddToCart(producto)}
                           disabled={!producto.disponible}
                           className="btn w-full mt-2 sm:mt-4 disabled:opacity-50 text-white min-h-[44px] active:scale-95 touch-feedback"
                           style={{ backgroundColor: 'var(--color-primary)', borderRadius: 'calc(var(--border-radius) / 2)' }}
                         >
                           <Plus size={16} className="inline mr-1.5 sm:mr-2" />
                           Agregar
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
         ) : (
           <div className="text-center py-10 sm:py-12 px-4">
             <p className="text-gray-500 text-sm sm:text-base md:text-lg">No hay productos disponibles en el menú</p>
           </div>
         )}

         {/* Sección de Calificaciones */}
         {ratings && ratings.total_calificaciones > 0 && (
           <div className="mt-12 sm:mt-16">
             <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 px-2" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>
               Calificaciones de Clientes
             </h2>

             <div className="card-lg bg-white px-4 sm:px-6" style={{ borderRadius: 'var(--border-radius)' }}>
               {/* Resumen */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
                 {/* Promedio */}
                 <div className="text-center md:text-left">
                   <p className="text-xs sm:text-sm text-gray-500 mb-2">Calificación promedio</p>
                   <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2">
                     <span className="text-4xl sm:text-5xl font-bold text-dark">{Number(ratings.promedio || 0).toFixed(1)}</span>
                     <div className="flex">
                       {[1, 2, 3, 4, 5].map(star => (
                         <Star
                           key={star}
                           size={18}
                           className={star <= Math.round(ratings.promedio || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                         />
                       ))}
                     </div>
                   </div>
                   <p className="text-xs sm:text-sm text-gray-600">{ratings.total_calificaciones} calificaciones</p>
                 </div>

                 {/* Distribución */}
                 <div className="md:col-span-2">
                   <p className="text-xs sm:text-sm text-gray-500 mb-3">Distribución de calificaciones</p>
                   <div className="space-y-2">
                     {[5, 4, 3, 2, 1].map(stars => {
                       const count = ratings.distribucion[stars] || 0;
                       const percentage = ratings.total_calificaciones > 0 ? (count / ratings.total_calificaciones) * 100 : 0;
                       return (
                         <div key={stars} className="flex items-center gap-2 sm:gap-3">
                           <div className="flex items-center gap-1 w-8">
                             <span className="text-xs sm:text-sm font-semibold text-gray-700">{stars}</span>
                             <Star size={10} className="text-yellow-500 fill-yellow-500" />
                           </div>
                           <div className="flex-1 h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-hidden">
                             <div
                               className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                               style={{ width: `${percentage}%` }}
                             />
                           </div>
                           <span className="text-xs sm:text-sm text-gray-600 w-8 text-right">{count}</span>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>

               {/* Lista de calificaciones recientes */}
               <div>
                 <h3 className="text-base sm:text-lg font-bold text-dark mb-3 sm:mb-4">Calificaciones recientes</h3>
                 <div className="space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto custom-scrollbar">
                   {ratings.calificaciones?.slice(0, 10).map((rating, idx) => (
                     <div key={idx} className="border-b border-gray-100 pb-3 sm:pb-4 last:border-0">
                       <div className="flex items-start justify-between gap-3">
                         <div className="flex items-center gap-2 sm:gap-3">
                           <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                             <User size={18} className="text-primary" />
                           </div>
                           <div className="min-w-0">
                             <p className="font-semibold text-gray-800 text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                               {rating.usuario_nombre || 'Cliente'}
                             </p>
                             <div className="flex gap-0.5">
                               {[1, 2, 3, 4, 5].map(star => (
                                 <Star
                                   key={star}
                                   size={12}
                                   className={star <= (rating.calificacion || rating.puntuacion) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                                 />
                               ))}
                             </div>
                           </div>
                         </div>
                         <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                           {new Date(rating.creado_en).toLocaleDateString('es-CO')}
                         </span>
                       </div>
                       {rating.comentario && (
                         <p className="text-gray-600 text-xs sm:text-sm mt-2 ml-10 sm:ml-11 break-words">
                           {rating.comentario}
                         </p>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
}
