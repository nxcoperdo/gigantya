import { useParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Star, MapPin, Clock, Clock3, Phone, Plus, Minus, User, Facebook, Instagram, Store, Maximize2 } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { isRestaurantOpen } from '../utils/scheduleHelper';
import Loading from '../components/Loading';
import AddToCartModal from '../components/AddToCartModal';
import FavoriteButton from '../components/FavoriteButton';
import ProductGalleryModal from '../components/ProductGalleryModal';
import { canAccessPlan } from '../utils/planFeatures';
import ProductCustomizationModal from '../components/ProductCustomizationModal';
import api, { productService } from '../services/api';
import { useCart } from '../context/CartContext';
import { ratingService } from '../services/api';
import { formatDate } from '../utils/dateHelper';

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
  const [galleryModal, setGalleryModal] = useState({
    isOpen: false,
    images: [],
    name: '',
    productoId: null,
  });
  // Producto actualmente siendo customizado (null si no hay modal abierto)
  const [customizing, setCustomizing] = useState(null);
  // IDs de productos cuya descripción está expandida en móvil
  const [expandedDescs, setExpandedDescs] = useState(new Set());
  const { addToCart } = useCart();

  const toggleDescExpanded = (productoId) => {
    setExpandedDescs((prev) => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

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

  // Abre la galería del producto. La imagen principal se pasa como [0] y
  // la galería del server se concatena después (lazy, cuando el modal se abre).
  const openProductGallery = (producto) => {
    if (!producto.imagen_url) return;
    const mainUrl = getImageUrl(producto.imagen_url);
    setGalleryModal({
      isOpen: true,
      images: [mainUrl],
      name: producto.nombre,
      productoId: producto.id,
    });
  };

  // Fetch lazy de la galería del server. Solo para planes que tienen el feature.
  // Si falla, el lightbox sigue mostrando la imagen principal sola.
  useEffect(() => {
    if (!galleryModal.isOpen || !galleryModal.productoId) return;
    const plan = restaurante?.plan;
    if (plan !== 'profesional' && plan !== 'premium') return;
    let cancelled = false;
    productService.getGallery(galleryModal.productoId)
      .then((res) => {
        if (cancelled) return;
        const galleryUrls = (res.data?.imagenes || [])
          .map((img) => getImageUrl(img.imagen_url))
          .filter(Boolean);
        if (galleryUrls.length === 0) return;
        setGalleryModal((prev) => {
          // No pisar si el modal ya se cerró
          if (!prev.isOpen) return prev;
          // Mantener la principal en [0] y concatenar la galería
          const main = prev.images[0];
          return { ...prev, images: [main, ...galleryUrls] };
        });
      })
      .catch(() => { /* silencioso: si falla, queda solo la principal */ });
    return () => { cancelled = true; };
  }, [galleryModal.isOpen, galleryModal.productoId, restaurante?.plan]);

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

   const handleAddToCart = async (producto) => {
     // El cliente puede agregar productos al carrito incluso si el local
     // es "solo retiro en mostrador" (ofrece_domicilio=0). El checkout
     // y el backend se encargan de forzar nulls en dirección/barrio/sector
     // y costo_envio=0 en ese caso. Ya no bloqueamos acá.

     // Auto-detección de modificadores: si el producto tiene
     // adiciones o removibles configurados, abrimos el modal
     // de customización (estilo Rappi) y NO agregamos al carrito
     // todavía. El callback onAdd del modal llama a addToCart
     // con la selección estructurada.
     if (Number(producto.tiene_modificadores) === 1) {
       try {
         const res = await productService.getPaqueteModificadores(producto.id);
         setCustomizing({ producto, paquete: res.data?.configuracion || res.data || { grupos: [], adiciones: [], removibles: [] } });
       } catch (err) {
         console.error('Error cargando modificadores:', err);
         // Si falla el GET (ej: race condition al eliminar el paquete
         // entre el render y el click), abrimos con paquete vacío:
         // el usuario solo podrá ajustar la cantidad.
         setCustomizing({ producto, paquete: { grupos: [], adiciones: [], removibles: [] } });
       }
       return { success: true };
     }

     // Flujo viejo: producto sin modificadores, agregar directo.
     const result = addToCart(producto);

     if (!result.success) {
       alert(result.error);
       return result;
     }

     const nuevaCantidad = (cantidades[producto.id] || 0) + 1;
     setCantidades(prev => ({ ...prev, [producto.id]: nuevaCantidad }));
     setProductAdded({ ...producto, cantidad: nuevaCantidad });
     setShowModal(true);
     return result;
   };

   // Callback que dispara el ProductCustomizationModal cuando el
   // cliente confirma su selección. Misma estructura que el flujo
   // viejo: addToCart + setCantidades + abrir AddToCartModal.
   const handleCustomizationAdd = ({ cantidad, adiciones, removidos, nota }) => {
     if (!customizing?.producto) return;
     const result = addToCart(
       customizing.producto,
       cantidad,
       adiciones,
       removidos,
       nota
     );
     if (!result.success) {
       alert(result.error);
       return;
     }
     const nuevaCantidad = (cantidades[customizing.producto.id] || 0) + cantidad;
     setCantidades((prev) => ({ ...prev, [customizing.producto.id]: nuevaCantidad }));
     setProductAdded({ ...customizing.producto, cantidad: nuevaCantidad });
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
          <h1 className="text-3xl font-bold text-[color:var(--text-primary)] mb-2">Local no encontrado</h1>
          <a href="/" className="btn btn-primary">Volver al inicio</a>
        </div>
      </div>
    );
  }

   const isRestaurantOpenNow = isRestaurantOpen(restaurante.horario_apertura, restaurante.horario_cierre);

   // Modalidad de servicio (default true para compatibilidad con restaurantes
   // que aún no tienen el campo persistido).
   const ofreceDomicilio = restaurante?.ofrece_domicilio === undefined
     ? true
     : Boolean(Number(restaurante.ofrece_domicilio));

   return (
     <div
       className="min-h-screen bg-[color:var(--bg-subtle)]"
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

       {/* Modal de Customización (Rappi-style) — se abre cuando el
           producto tiene modificadores configurados. */}
       <ProductCustomizationModal
         isOpen={customizing != null}
         onClose={() => setCustomizing(null)}
         producto={customizing?.producto}
         paquete={customizing?.paquete}
         onAdd={handleCustomizationAdd}
       />

       {/* Lightbox de galería del producto (swipeable en mobile, flechas en desktop) */}
       <ProductGalleryModal
         isOpen={galleryModal.isOpen}
         onClose={() => setGalleryModal({ isOpen: false, images: [], name: '', productoId: null })}
         images={galleryModal.images}
         productName={galleryModal.name}
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
         <div className="card-lg" style={{ borderRadius: 'var(--border-radius)' }}>
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
           <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-[color:var(--text-primary)] mb-2 sm:mb-3 px-2" style={{ fontFamily: 'var(--font-family)' }}>
             {restaurante.nombre}
           </h1>

           <p className="text-[color:var(--text-secondary)] text-sm sm:text-base md:text-lg mb-4 sm:mb-6 max-w-2xl px-2">
             {restaurante.descripcion}
           </p>

           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 px-2">
             <div className="flex items-start gap-2 sm:gap-3">
               <Star className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">Calificación</p>
                 <p className="text-lg sm:text-xl font-bold text-[color:var(--text-primary)]">{restaurante.calificacion || '5.0'}</p>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <Clock className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">Horario</p>
                 <p className="text-sm sm:text-lg font-semibold text-[color:var(--text-primary)] truncate">
                   {restaurante.horario_apertura?.slice(0, 5)} - {restaurante.horario_cierre?.slice(0, 5)}
                 </p>
                 <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase ${
                   isRestaurantOpenNow ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                 }`}>
                   <span className={`w-1.5 h-1.5 rounded-full bg-white ${isRestaurantOpenNow ? 'animate-pulse' : ''}`} />
                   {isRestaurantOpenNow ? 'Abierto ahora' : 'Cerrado'}
                 </span>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <Phone className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">Teléfono</p>
                 <p className="text-sm sm:text-lg font-semibold text-[color:var(--text-primary)]">{restaurante.telefono}</p>
               </div>
             </div>

             <div className="flex items-start gap-2 sm:gap-3">
               <MapPin className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
               <div className="min-w-0">
                 <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">Ubicación</p>
                 <p className="text-sm sm:text-lg font-semibold text-[color:var(--text-primary)] truncate">{restaurante.ciudad}</p>
               </div>
             </div>

             {restaurante.tiempo_preparacion_minutos && Number(restaurante.tiempo_preparacion_minutos) > 0 && (
               <div className="flex items-start gap-2 sm:gap-3">
                 <Clock3 className="mt-0.5 sm:mt-1 flex-shrink-0" size={18} style={{ color: 'var(--color-primary)' }} />
                 <div className="min-w-0">
                   <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">Tiempo de preparación</p>
                   <p className="text-sm sm:text-lg font-semibold text-[color:var(--text-primary)]">
                     ~{restaurante.tiempo_preparacion_minutos} min
                   </p>
                 </div>
               </div>
             )}
           </div>

           {/* Redes Sociales (planes con feature `redes_sociales`, si tienen URLs configuradas) */}
           {canAccessPlan(restaurante.plan, 'redes_sociales') && (restaurante.custom_config?.social?.facebook || restaurante.custom_config?.social?.instagram) && (
             <div className="flex items-center gap-3 pt-4 mt-4 border-t border-[color:var(--border-subtle)] px-2">
               {restaurante.custom_config.social.facebook && (
                 <a
                   href={restaurante.custom_config.social.facebook}
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="Facebook"
                   className="transition-opacity hover:opacity-70"
                   style={{ color: 'var(--color-primary)' }}
                 >
                   <Facebook size={22} />
                 </a>
               )}
               {restaurante.custom_config.social.instagram && (
                 <a
                   href={restaurante.custom_config.social.instagram}
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="Instagram"
                   className="transition-opacity hover:opacity-70"
                   style={{ color: 'var(--color-primary)' }}
                 >
                   <Instagram size={22} />
                 </a>
               )}
             </div>
           )}
         </div>
       </div>

       {/* Menu Section */}
       <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
         <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 px-2" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>Menú</h2>

         {!isRestaurantOpenNow && (
           <div
             className="mx-2 mb-6 p-4 rounded-xl flex items-start gap-3"
             style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}
           >
             <Clock size={20} className="flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-bold">El local está cerrado</p>
               <p className="text-sm opacity-90">
                 Volvemos a abrir a las {restaurante.horario_apertura?.slice(0, 5)}.
                 Puedes explorar el menú, pero no podrás hacer pedidos hasta entonces.
               </p>
             </div>
           </div>
         )}

         {/* Banner informativo: restaurante solo retiro en mostrador.
             El cliente puede armar el carrito y hacer el pedido, pero
             retira en el mostrador del local (no se hace envío a domicilio). */}
         {!ofreceDomicilio && (
           <div
             className="mx-2 mb-6 p-4 rounded-xl flex items-start gap-3"
             style={{
               backgroundColor: 'var(--warning-bg)',
               border: '1px solid var(--warning-border)',
               color: 'var(--warning-text)',
             }}
           >
             <Store size={20} className="flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-bold">Retiro en mostrador</p>
               <p className="text-sm opacity-90">
                 Podés hacer tu pedido por la app y retirarlo en el local.
                 No hacemos envíos a domicilio para este local.
               </p>
             </div>
           </div>
         )}

         {sortedCategories.length > 0 ? (
           <div className="space-y-8 sm:space-y-10 md:space-y-12">
             {sortedCategories.map(([catId, catData]) => (
               <div key={catId} className="space-y-4 sm:space-y-6 px-2">
                 <div className="flex items-center gap-3 sm:gap-4">
                   <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[color:var(--text-primary)]">{catData.nombre}</h3>
                   <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                   {catData.productos.map((producto, idx) => (
                     <div key={producto.id} className="card group hover:shadow-lg animate-scaleIn" style={{ borderRadius: 'var(--border-radius)', animationDelay: `${idx * 50}ms` }}>
                       <button
                         type="button"
                         onClick={() => openProductGallery(producto)}
                         disabled={!producto.imagen_url}
                         aria-label={`Ver fotos de ${producto.nombre}`}
                         className="relative mb-3 sm:mb-4 overflow-hidden rounded-lg bg-[color:var(--bg-subtle)] block w-full text-left group/img disabled:cursor-default"
                       >
                         {producto.imagen_url ? (
                           <img
                             src={getImageUrl(producto.imagen_url)}
                             alt={producto.nombre}
                             className={`w-full h-40 sm:h-48 object-cover group-hover/img:scale-105 transition-transform duration-300 ${!isRestaurantOpenNow ? 'grayscale opacity-60' : ''}`}
                             loading="lazy"
                           />
                         ) : (
                           <div className="w-full h-40 sm:h-48 flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-3xl sm:text-4xl">
                             🍽️
                           </div>
                         )}
                         {producto.imagen_url && (
                           <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                             <Maximize2 className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" size={28} />
                           </div>
                         )}
                         {!isRestaurantOpenNow && (
                           <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                             <span className="badge badge-error">Local cerrado</span>
                           </div>
                         )}
                         {isRestaurantOpenNow && !producto.disponible && (
                           <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                             <span className="badge badge-error">No disponible</span>
                           </div>
                         )}
                       </button>

                       <div className="px-1">
                         <h3 className="text-base sm:text-lg md:text-xl font-bold text-[color:var(--text-primary)] mb-1.5 sm:mb-2 line-clamp-2 min-h-[44px]">
                           {producto.nombre}
                         </h3>
                         <DescripcionProducto
                           texto={producto.descripcion}
                           expandido={expandedDescs.has(producto.id)}
                           onToggle={() => toggleDescExpanded(producto.id)}
                         />

                         <div className="flex justify-between items-end mb-3">
                           <p className="text-lg sm:text-xl md:text-2xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>
                             {formatCurrency(producto.precio)}
                           </p>
                         </div>

                         <button
                           onClick={() => handleAddToCart(producto)}
                           disabled={!producto.disponible || !isRestaurantOpenNow}
                           className="btn w-full mt-2 sm:mt-4 disabled:opacity-50 text-white min-h-[44px] active:scale-95 touch-feedback"
                           style={{ backgroundColor: 'var(--color-primary)', borderRadius: 'calc(var(--border-radius) / 2)' }}
                         >
                           <>
                             <Plus size={16} className="inline mr-1.5 sm:mr-2" />
                             {isRestaurantOpenNow ? (ofreceDomicilio ? 'Agregar' : 'Agregar · retira en local') : 'No disponible'}
                           </>
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
             <p className="text-[color:var(--text-muted)] text-sm sm:text-base md:text-lg">No hay productos disponibles en el menú</p>
           </div>
         )}

         {/* Sección de Calificaciones */}
         {ratings && ratings.total_calificaciones > 0 && (
           <div className="mt-12 sm:mt-16">
             <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 px-2" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}>
               Calificaciones de Clientes
             </h2>

             <div className="card-lg px-4 sm:px-6" style={{ borderRadius: 'var(--border-radius)' }}>
               {/* Resumen */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-[color:var(--border-subtle)]">
                 {/* Promedio */}
                 <div className="text-center md:text-left">
                   <p className="text-xs sm:text-sm text-[color:var(--text-muted)] mb-2">Calificación promedio</p>
                   <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2">
                     <span className="text-4xl sm:text-5xl font-bold text-[color:var(--text-primary)]">{Number(ratings.promedio || 0).toFixed(1)}</span>
                     <div className="flex">
                       {[1, 2, 3, 4, 5].map(star => (
                         <Star
                           key={star}
                           size={18}
                           className={star <= Math.round(ratings.promedio || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-[color:var(--text-subtle)]'}
                         />
                       ))}
                     </div>
                   </div>
                   <p className="text-xs sm:text-sm text-[color:var(--text-secondary)]">{ratings.total_calificaciones} calificaciones</p>
                 </div>

                 {/* Distribución */}
                 <div className="md:col-span-2">
                   <p className="text-xs sm:text-sm text-[color:var(--text-muted)] mb-3">Distribución de calificaciones</p>
                   <div className="space-y-2">
                     {[5, 4, 3, 2, 1].map(stars => {
                       const count = ratings.distribucion[stars] || 0;
                       const percentage = ratings.total_calificaciones > 0 ? (count / ratings.total_calificaciones) * 100 : 0;
                       return (
                         <div key={stars} className="flex items-center gap-2 sm:gap-3">
                           <div className="flex items-center gap-1 w-8">
                             <span className="text-xs sm:text-sm font-semibold text-[color:var(--text-secondary)]">{stars}</span>
                             <Star size={10} className="text-yellow-500 fill-yellow-500" />
                           </div>
                           <div className="flex-1 h-2.5 sm:h-3 bg-[color:var(--bg-muted)] rounded-full overflow-hidden">
                             <div
                               className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                               style={{ width: `${percentage}%` }}
                             />
                           </div>
                           <span className="text-xs sm:text-sm text-[color:var(--text-secondary)] w-8 text-right">{count}</span>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>

               {/* Lista de calificaciones recientes */}
               <div>
                 <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-primary)] mb-3 sm:mb-4">Calificaciones recientes</h3>
                 <div className="space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto custom-scrollbar">
                   {ratings.calificaciones?.slice(0, 10).map((rating, idx) => (
                     <div key={idx} className="border-b border-[color:var(--border-subtle)] pb-3 sm:pb-4 last:border-0">
                       <div className="flex items-start justify-between gap-3">
                         <div className="flex items-center gap-2 sm:gap-3">
                           <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                             <User size={18} className="text-primary" />
                           </div>
                           <div className="min-w-0">
                             <p className="font-semibold text-[color:var(--text-primary)] text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                               {rating.usuario_nombre || 'Cliente'}
                             </p>
                             <div className="flex gap-0.5">
                               {[1, 2, 3, 4, 5].map(star => (
                                 <Star
                                   key={star}
                                   size={12}
                                   className={star <= (rating.calificacion || rating.puntuacion) ? 'text-yellow-500 fill-yellow-500' : 'text-[color:var(--text-subtle)]'}
                                 />
                               ))}
                             </div>
                           </div>
                         </div>
                         <span className="text-xs text-[color:var(--text-muted)] flex-shrink-0 whitespace-nowrap">
                           {formatDate(rating.creado_en)}
                         </span>
                       </div>
                       {rating.comentario && (
                         <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm mt-2 ml-10 sm:ml-11 break-words">
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

// Descripción de producto: en móvil colapsable (2 líneas + Ver más / Ver menos);
// en PC (md:) siempre completa.
function DescripcionProducto({ texto, expandido, onToggle }) {
  const [esLarga, setEsLarga] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // "Larga" = la descripción sobrepasa las 2 líneas del clamp a 12px (móvil).
    // En PC no hay clamp, así que ningún texto se considera largo para colapsar.
    setEsLarga(el.scrollHeight > el.clientHeight + 1);
  }, [texto]);

  if (!texto) return null;

  const clasesClamp = expandido
    ? 'whitespace-pre-line'
    : 'line-clamp-2 md:line-clamp-none whitespace-pre-line';

  return (
    <div className="mb-3 sm:mb-4">
      <p
        ref={ref}
        className={`text-[color:var(--text-secondary)] text-xs sm:text-sm ${clasesClamp}`}
      >
        {texto}
      </p>
      {esLarga && (
        <button
          type="button"
          onClick={onToggle}
          className="md:hidden text-xs font-semibold mt-1 hover:underline focus:outline-none"
          style={{ color: 'var(--color-primary)' }}
          aria-expanded={expandido}
        >
          {expandido ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
