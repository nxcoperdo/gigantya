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
import MobileMenuNav from '../components/MobileMenuNav';
import ScrollToTopButton from '../components/ScrollToTopButton';
import MobileCartBar from '../components/MobileCartBar';

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
  // Estado de la query del buscador (la pasa MobileMenuNav hacia el padre
  // para decidir si renderizar la lista agrupada o la plana de resultados).
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart, cart } = useCart();

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

  // Hidratar `cantidades` desde el carrito persistido en CartContext.
  // Bug pre-existente: si el usuario agregaba productos, iba a /cart y
  // volvía a /restaurant/:id, `cantidades[id]` quedaba en 0 aunque el
  // carrito tuviera N unidades de ese producto. El counter +/- de las
  // cards se veía desincronizado del mini-banner inferior.
  // Esta sincronización ocurre en mount + cada vez que el cart cambia
  // (ej: el usuario vuelve de /cart). El `|| {}` previene que se ejecute
  // antes de que CartContext se hidrate desde localStorage.
  useEffect(() => {
    if (!cart || cart.length === 0) return;
    setCantidades((prev) => {
      const next = { ...prev };
      for (const item of cart) {
        // `item.id` viene del spread de `...producto` en addToCart
        // (CartContext L141). Cada línea del carrito tiene el id del
        // producto original.
        if (item?.id == null) continue;
        next[item.id] = (next[item.id] || 0) + (Number(item.cantidad) || 0);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

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
    if (!canAccessPlan(plan, 'multiples_fotos')) return;
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
         {/* Sticky-nav mobile-only: pills de categorías + scrollspy +
             buscador. Se posiciona debajo del Header usando la CSS var
             --header-height. Es md:hidden, en desktop no se renderiza. */}
         {sortedCategories.length > 0 && (
           <MobileMenuNav
             categories={sortedCategories.map(([id, cat]) => ({ id, nombre: cat.nombre }))}
             productos={productos}
             onSearchChange={setSearchQuery}
           />
         )}

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
                 Puedes hacer tu pedido por la app y retirarlo en el local.
                 No hacemos envíos a domicilio para este local.
               </p>
             </div>
           </div>
         )}

         {sortedCategories.length > 0 ? (
           (() => {
             // Si hay query activa del buscador, mostramos lista plana
             // de resultados. El padre (MobileMenuNav) nos pasa la query
             // vía onSearchChange → setSearchQuery.
             const trimmedQuery = searchQuery.trim().toLowerCase();
             const hasQuery = trimmedQuery.length > 0;

             if (hasQuery) {
               const matches = productos.filter(
                 (p) =>
                   (p.nombre || '').toLowerCase().includes(trimmedQuery) ||
                   (p.descripcion || '').toLowerCase().includes(trimmedQuery)
               );
               if (matches.length === 0) {
                 return (
                   <div className="text-center py-10 sm:py-12 px-4">
                     <p className="text-[color:var(--text-muted)] text-sm sm:text-base md:text-lg">
                       Sin resultados para «{searchQuery}»
                     </p>
                     <p className="text-xs text-[color:var(--text-muted)] mt-2">
                       Probá con otra palabra o revisá la ortografía.
                     </p>
                   </div>
                 );
               }
               return (
                 <div className="space-y-3 sm:space-y-6 px-2">
                   <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">
                     {matches.length} {matches.length === 1 ? 'resultado' : 'resultados'} para «{searchQuery}»
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 sm:gap-6">
                     {matches.map((producto, idx) => renderProductCard(producto, idx, isRestaurantOpenNow, ofreceDomicilio, handleAddToCart, openProductGallery, expandedDescs, toggleDescExpanded, cantidades))}
                   </div>
                 </div>
               );
             }

             return (
               <div className="space-y-8 sm:space-y-10 md:space-y-12">
                 {sortedCategories.map(([catId, catData]) => (
                   <div
                     key={catId}
                     id={`cat-${catId}`}
                     data-cat-section={catId}
                     // scroll-margin-top compensa el header (60px) + sticky-nav
                     // (≈56px) + 8px de respiro para que el scrollIntoView
                     // de la pill no tape el título de la categoría.
                     className="space-y-4 sm:space-y-6 px-2 scroll-margin-top-header"
                   >
                     <div className="flex items-center gap-3 sm:gap-4">
                       <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[color:var(--text-primary)]">{catData.nombre}</h3>
                       <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 sm:gap-6">
                       {catData.productos.map((producto, idx) => renderProductCard(producto, idx, isRestaurantOpenNow, ofreceDomicilio, handleAddToCart, openProductGallery, expandedDescs, toggleDescExpanded, cantidades))}
                     </div>
                   </div>
                 ))}
               </div>
             );
           })()
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

         {/* FABs mobile-only: "Volver arriba" + mini-banner del carrito.
             Son md:hidden, en desktop no se renderean. El mini-banner
             también agrega padding-bottom (pb-24) al final del menú
             cuando el carrito tiene items, para que el contenido no
             quede tapado. */}
         <ScrollToTopButton />
         {cart.length > 0 && (
           // Padding extra al final del contenido para que el último
           // producto no quede debajo del banner inferior (que mide
           // ~56-72px de alto). Solo se aplica cuando hay items, sino
           // queda un padding huérfano.
           <div className="md:hidden h-20" aria-hidden="true" />
         )}
       </div>

       {/* Mini-banner del carrito — se monta fuera del contenedor scrolleable
           porque es fixed. */}
       <MobileCartBar />
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

/**
 * Card de producto con layout adaptativo:
 *   - **Mobile** (default): horizontal — imagen 80x80 a la izquierda,
 *     nombre + descripción + precio + botón "+" compacto a la derecha.
 *     ~130-150px de alto (vs ~400px del layout vertical viejo).
 *   - **Desktop** (sm:): vuelve al grid de 2-3 columnas con la card
 *     vertical original (imagen 160-192px arriba, contenido abajo, botón
 *     "Agregar" full-width).
 *
 * Refactorizada como función fuera del componente padre para evitar
 * duplicar el JSX entre el render agrupado (categorías) y la lista plana
 * (resultados del buscador).
 *
 * Decisiones de UI mobile:
 *   - Descripción con `line-clamp-2` + botón "Ver más" existente
 *     (DescripcionProducto, L662). Sacrifica 20-30px de altura por
 *     legibilidad — eliminar la feature sería una regresión.
 *   - Botón "+" se vuelve circular compacto en mobile (full-width en sm+).
 *   - Si el counter `cantidades[id] > 0`, el botón muestra un counter
 *     `+/N/+` (estado futuro si querés sumar/restar sin abrir modal).
 *   - Imagen oculta si `!imagen_url` (no mostramos el 🍽️ de 160px en
 *     mobile porque en 80x80 queda horrible).
 */
function renderProductCard(
  producto,
  idx,
  isRestaurantOpenNow,
  ofreceDomicilio,
  handleAddToCart,
  openProductGallery,
  expandedDescs,
  toggleDescExpanded,
  cantidades
) {
  // Stagger suave solo en los primeros 6 productos del primer viewport
  // visible. El resto entra instantáneamente. Antes era idx*50ms sin
  // tope, lo que en un menú de 78 productos retrasaba la última card
  // 3.9s. El `prefers-reduced-motion` global mata todo si el usuario
  // lo activó.
  const animationDelay = idx < 6 ? `${idx * 30}ms` : '0ms';
  const hasImage = Boolean(producto.imagen_url);
  const currentQty = cantidades[producto.id] || 0;

  return (
    <div
      key={producto.id}
      className={[
        'card group hover:shadow-lg animate-scaleIn',
        // Mobile: horizontal con gap interno. sm+: vertical original.
        'flex flex-row gap-3 p-2',
        'sm:flex-col sm:gap-0 sm:p-1',
      ].join(' ')}
      style={{ borderRadius: 'var(--border-radius)', animationDelay }}
    >
      {/* Imagen / placeholder */}
      <button
        type="button"
        onClick={() => openProductGallery(producto)}
        disabled={!hasImage}
        aria-label={hasImage ? `Ver fotos de ${producto.nombre}` : `${producto.nombre} (sin foto)`}
        className={[
          'relative overflow-hidden rounded-lg bg-[color:var(--bg-subtle)]',
          'flex-shrink-0',
          'w-20 h-20',                                                 // mobile: 80x80
          'sm:w-full sm:h-40 md:h-48 sm:mb-4',                         // sm+: full width arriba
          'text-left group/img disabled:cursor-default',
        ].join(' ')}
      >
        {hasImage ? (
          <img
            src={getImageUrl(producto.imagen_url)}
            alt={producto.nombre}
            className={`w-full h-full sm:h-40 md:h-48 object-cover group-hover/img:scale-105 transition-transform duration-300 ${!isRestaurantOpenNow ? 'grayscale opacity-60' : ''}`}
            loading="lazy"
          />
        ) : (
          // En mobile (80x80) mostramos solo un punto centrado. En sm+
          // (full width) mostramos el emoji grande + gradiente.
          <div className="w-full h-full sm:h-40 md:h-48 flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-2xl sm:text-3xl md:text-4xl">
            🍽️
          </div>
        )}
        {hasImage && (
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

      {/* Contenido: nombre, descripción, precio, botón */}
      <div className="flex-1 min-w-0 sm:w-full sm:px-1 flex flex-col">
        <h3 className="text-sm sm:text-base md:text-xl font-bold text-[color:var(--text-primary)] mb-1 sm:mb-2 line-clamp-1 sm:line-clamp-2">
          {producto.nombre}
        </h3>
        <DescripcionProducto
          texto={producto.descripcion}
          expandido={expandedDescs.has(producto.id)}
          onToggle={() => toggleDescExpanded(producto.id)}
        />

        <div className="mt-auto sm:mt-0 flex items-center justify-between gap-2 mb-1 sm:mb-3 sm:block">
          <p
            className="text-base sm:text-lg md:text-2xl font-bold whitespace-nowrap"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)' }}
          >
            {formatCurrency(producto.precio)}
          </p>
        </div>

        <button
          onClick={() => handleAddToCart(producto)}
          disabled={!producto.disponible || !isRestaurantOpenNow}
          aria-label={`Agregar ${producto.nombre} al carrito`}
          className={[
            'text-white disabled:opacity-50 active:scale-95 touch-feedback',
            'min-h-[44px] flex items-center justify-center gap-1.5',
            'sm:mt-4 sm:w-full',
            // Mobile: botón circular compacto con solo el ícono + .
            'w-10 h-10 rounded-full p-0 self-end',
            // sm+: full-width con texto "Agregar".
            'sm:w-full sm:py-3 sm:rounded-md',
          ].join(' ')}
          style={{
            backgroundColor: 'var(--color-primary)',
            // En mobile el border-radius es circular (rounded-full), en
            // sm+ es calc(var(--border-radius) / 2).
            borderRadius: undefined,
          }}
        >
          {currentQty > 0 ? (
            // Si ya hay unidades agregadas, mostramos el counter inline.
            <span className="text-sm font-bold tabular-nums" aria-hidden="false">
              {currentQty}
            </span>
          ) : (
            <>
              <Plus size={16} aria-hidden="true" className="sm:mr-1.5" />
              <span className="hidden sm:inline text-sm font-semibold">
                {isRestaurantOpenNow
                  ? (ofreceDomicilio ? 'Agregar' : 'Agregar · retira en local')
                  : 'No disponible'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

