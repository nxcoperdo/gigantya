import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Utensils, X, Store, ShoppingBag, Clock } from 'lucide-react';
import { restaurantService, preferenceService, categoryService, productService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl, IMAGE_DEFAULT_ATTRS } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { isRestaurantOpen } from '../utils/scheduleHelper';
import Loading from '../components/Loading';
import RecentSearches from '../components/RecentSearches';

// Tarjeta de restaurante memoizada: solo se re-renderiza si cambian sus props
const RestaurantCard = memo(function RestaurantCard({ restaurant, index }) {
  const isOpen = isRestaurantOpen(restaurant.horario_apertura, restaurant.horario_cierre);
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="group card-lg hover:shadow-lg-soft cursor-pointer transform transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 animate-slideUp active:scale-95 touch-feedback"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image Section */}
      <div className="relative mb-4 sm:mb-5 rounded-xl overflow-hidden bg-gradient-warm h-40 sm:h-48">
        {restaurant.imagen_url ? (
          <img
            src={getImageUrl(restaurant.imagen_url)}
            alt={restaurant.nombre}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            {...IMAGE_DEFAULT_ATTRS}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-4xl sm:text-6xl">
            🍽️
          </div>
        )}
        {/* Badge de calificación */}
        {Number(restaurant.total_calificaciones) > 0 && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 shadow-medium">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-gray-800 text-xs sm:text-sm">
              {Number(restaurant.calificacion_promedio).toFixed(1)}
            </span>
          </div>
        )}
        {/* Badge abierto/cerrado */}
        <div className={`absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 shadow-medium text-[10px] sm:text-xs font-bold uppercase ${
          isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOpen ? 'bg-white animate-pulse' : 'bg-white'}`} />
          {isOpen ? 'Abierto' : 'Cerrado'}
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-2 sm:space-y-3">
        <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-[color:var(--text-primary)] group-hover:text-primary transition-colors line-clamp-2 min-h-[44px]">
          {restaurant.nombre}
        </h3>

        <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm text-ellipsis-2 leading-relaxed min-h-[40px]">
          {restaurant.descripcion || 'Disfruta de deliciosos platillos'}
        </p>

        {/* Info Row */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-[color:var(--text-secondary)] pt-2 sm:pt-3 border-t border-[color:var(--border-subtle)] flex-wrap">
          <div className="flex items-center gap-1 flex-shrink-0">
            <MapPin size={14} className="text-primary flex-shrink-0" />
            <span className="truncate">{restaurant.ciudad}</span>
          </div>
          {restaurant.horario_apertura && restaurant.horario_cierre && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs">🕐</span>
              <span>{restaurant.horario_apertura?.slice(0, 5)} - {restaurant.horario_cierre?.slice(0, 5)}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA Button */}
      <button className="w-full mt-4 sm:mt-5 bg-gradient-primary text-white font-semibold py-2.5 sm:py-3 rounded-lg hover:shadow-lg transition-all duration-300 group-hover:scale-105 origin-center min-h-[44px] active:scale-95 touch-feedback">
        Ver Menú
      </button>
    </Link>
  );
});

// Banner destacado memoizado
const FeaturedBanner = memo(function FeaturedBanner({ restaurant, keyPrefix }) {
  return (
    <Link
      key={`${keyPrefix}-${restaurant.id}`}
      to={`/restaurant/${restaurant.id}`}
      className="w-64 sm:w-80 md:w-[450px] h-40 sm:h-48 rounded-xl sm:rounded-2xl overflow-hidden relative group shadow-lg-soft hover:shadow-xl transition-all flex-shrink-0 active:scale-95 touch-feedback"
    >
      <img
        src={getImageUrl(restaurant.banner_url)}
        alt={restaurant.nombre}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        {...IMAGE_DEFAULT_ATTRS}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white">
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{restaurant.nombre}</h3>
        <p className="text-xs sm:text-sm opacity-80 line-clamp-1">{restaurant.descripcion}</p>
      </div>
    </Link>
  );
});

// Tarjeta de producto memoizada para el feed público de la home.
// El producto ya viene con `restaurante_nombre`, `restaurante_plan`,
// `restaurante_horario_apertura/cierre` y `categoria_nombre` unidos desde el backend.
const ProductCard = memo(function ProductCard({ product, index }) {
  const isAvailable = Boolean(Number(product.disponible));
  const isRestaurantOpenNow = isRestaurantOpen(
    product.restaurante_horario_apertura,
    product.restaurante_horario_cierre
  );
  return (
    <Link
      to={`/restaurant/${product.restaurante_id}`}
      className="group card-lg hover:shadow-lg-soft cursor-pointer transform transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 animate-slideUp active:scale-95 touch-feedback"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image */}
      <div className="relative mb-4 sm:mb-5 rounded-xl overflow-hidden bg-gradient-warm h-40 sm:h-48">
        {product.imagen_url ? (
          <img
            src={getImageUrl(product.imagen_url)}
            alt={product.nombre}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${!isRestaurantOpenNow ? 'grayscale opacity-60' : ''}`}
            {...IMAGE_DEFAULT_ATTRS}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-4xl sm:text-6xl">
            🍽️
          </div>
        )}

        {/* Restaurante cerrado */}
        {!isRestaurantOpenNow && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-full">
              Restaurante cerrado
            </span>
          </div>
        )}

        {/* No disponible (aún con restaurante abierto) */}
        {!isAvailable && isRestaurantOpenNow && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-full">
              No disponible
            </span>
          </div>
        )}

        {/* Categoría */}
        {product.categoria_nombre && (
          <div className="absolute bottom-2 right-2 bg-white/90 text-dark text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {product.categoria_nombre}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 sm:space-y-3">
        {product.restaurante_nombre && (
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-primary truncate">
            {product.restaurante_nombre}
            {!isRestaurantOpenNow && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 normal-case font-normal">
                • <Clock size={11} /> Cerrado
              </span>
            )}
          </p>
        )}
        <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-[color:var(--text-primary)] group-hover:text-primary transition-colors line-clamp-2 min-h-[44px]">
          {product.nombre}
        </h3>
        <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm line-clamp-2 leading-relaxed min-h-[40px]">
          {product.descripcion || 'Delicioso platillo disponible'}
        </p>

        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-[color:var(--border-subtle)]">
          <p className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-primary">
            ${formatCurrency(Number(product.precio))}
          </p>
        </div>
      </div>

      {/* CTA */}
      <button className="w-full mt-4 sm:mt-5 bg-gradient-primary text-white font-semibold py-2.5 sm:py-3 rounded-lg hover:shadow-lg transition-all duration-300 group-hover:scale-105 origin-center min-h-[44px] active:scale-95 touch-feedback">
        Ver restaurante
      </button>
    </Link>
  );
});

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filtering, setFiltering] = useState(false);
  const [viewMode, setViewMode] = useState('restaurants'); // 'restaurants' | 'products'

  useEffect(() => {
    // Redirigir restaurantes al dashboard
    if (isAuthenticated && user?.tipo_usuario === 'restaurante') {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Redirigir admins al admin panel
    if (isAuthenticated && user?.tipo_usuario === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }

    loadCategories();
    loadSearchHistory();
  }, [isAuthenticated, user, navigate]);

  // Cuando cambia la categoría o el modo de vista, recargamos la lista
  // correspondiente. El backend ya devuelve los datos ordenados
  // premium → profesional → basico, así que no re-ordenamos en cliente.
  useEffect(() => {
    if (viewMode === 'restaurants') {
      loadRestaurants();
    } else {
      loadProductos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, viewMode]);

  const loadRestaurants = useCallback(async ({ preserveSpinner = false } = {}) => {
    try {
      if (preserveSpinner) {
        setFiltering(true);
      } else {
        setLoading(true);
      }
      const response = await restaurantService.getAll({
        ...(selectedCategory ? { categoria: selectedCategory } : {})
      });
      setRestaurants(response.data.restaurantes || []);
      setError(null);
    } catch (err) {
      setError('Error cargando restaurantes');
      console.error(err);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }, [selectedCategory]);

  const loadProductos = useCallback(async ({ preserveSpinner = false } = {}) => {
    try {
      if (preserveSpinner) {
        setFiltering(true);
      } else {
        setLoading(true);
      }
      const response = await productService.getAll({
        ...(selectedCategory ? { categoria: selectedCategory } : {})
      });
      setProductos(response.data.productos || []);
      setError(null);
    } catch (err) {
      setError('Error cargando productos');
      console.error(err);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }, [selectedCategory]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAll();
      const list = res.data?.categorias || [];
      // El endpoint devuelve categorías por restaurante; deduplicamos por
      // nombre (case-insensitive) preservando la primera aparición
      // (que ya viene ordenada por `c.orden ASC` desde el backend).
      const seen = new Set();
      const unique = [];
      for (const cat of list) {
        const key = cat.nombre?.trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          unique.push({ id: cat.id, nombre: cat.nombre.trim() });
        }
      }
      setCategories(unique);
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  }, []);

  const loadSearchHistory = useCallback(async () => {
    try {
      const res = await preferenceService.getSearchHistory();
      setSearchHistory(res.data);
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);

  // La categoría se filtra ya en el backend (?categoria=). Aquí solo
  // aplicamos el filtro de texto del buscador sobre los resultados del server.
  // El orden premium → profesional → basico también viene del backend.
  const filteredRestaurants = useMemo(() => {
    if (!searchTerm) return restaurants;
    const term = searchTerm.toLowerCase();
    return restaurants.filter(r =>
      r.nombre.toLowerCase().includes(term) ||
      r.descripcion?.toLowerCase().includes(term)
    );
  }, [restaurants, searchTerm]);

  // Para productos: el filtro de texto busca en nombre, descripción
  // y nombre del restaurante padre, y mantiene el orden del server.
  const filteredProductos = useMemo(() => {
    if (!searchTerm) return productos;
    const term = searchTerm.toLowerCase();
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.descripcion?.toLowerCase().includes(term) ||
      p.restaurante_nombre?.toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  const featuredBanners = useMemo(
    () => restaurants.filter(r => r.plan === 'premium' && r.banner_url),
    [restaurants]
  );

  // Memoizar las búsquedas recientes (solo el array de términos)
  const searchTerms = useMemo(
    () => searchHistory.map(h => h.termino),
    [searchHistory]
  );

  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  const handleSelectSearch = useCallback((term) => {
    setSearchTerm(term);
    setIsSearchFocused(false);
  }, []);

  const handleSelectCategory = useCallback((nombre) => {
    // Si se selecciona la misma categoría activa, la limpiamos (volver a "Todos")
    setSelectedCategory(prev => (prev === nombre ? null : nombre));
  }, []);

  const handleChangeView = useCallback((mode) => {
    if (mode !== viewMode) setViewMode(mode);
  }, [viewMode]);

  const clearHistory = useCallback(async () => {
    try {
      await preferenceService.clearSearchHistory();
      setSearchHistory([]);
    } catch (e) {
      console.error('Error clearing history:', e);
    }
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="bg-[color:var(--bg-base)]">
      {/* Hero Section */}
      <section className="text-white py-12 sm:py-16 md:py-28 px-4 sm:px-6 relative overflow-hidden">
        {/* Video Background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/banner.mp4" type="video/mp4" />
        </video>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-3 sm:mb-4 animate-fadeIn">
            Pide lo que Amas
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 md:mb-10 text-white font-light px-2">
            Descubre los mejores restaurantes de <span className="font-semibold">Gigante</span> en tu dispositivo
          </p>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto animate-slideUp relative">
            <div className="relative flex items-center bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-lg-soft">
              <Search className="text-primary absolute left-3 sm:left-4" size={20} />
              <input
                type="text"
                placeholder="Buscar restaurante, comida, bebida..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="flex-1 pl-10 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 outline-none text-gray-800 text-base sm:text-lg min-h-[48px] touch-action-manipulation"
                aria-label="Buscar restaurantes"
              />
            </div>
            {isSearchFocused && (
              <RecentSearches
                searches={searchTerms}
                onSelect={handleSelectSearch}
                onClear={clearHistory}
              />
            )}
            <p className="text-xs sm:text-sm mt-2.5 sm:mt-3 opacity-125">Más de {restaurants.length} restaurantes disponibles</p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-10 sm:py-12 md:py-16 lg:py-24">
        {/* Section Header */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-[color:var(--text-primary)] mb-2 sm:mb-3">
            Restaurantes Destacados
          </h2>
          <div className="w-16 sm:w-20 h-1 bg-gradient-primary rounded-full"></div>
          <p className="mt-3 sm:mt-4 text-[color:var(--text-secondary)] text-sm sm:text-base md:text-lg">
            Ordena con confianza desde los mejores restaurantes del pueblo
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-6 sm:mb-8 animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        {/* Featured Banners Marquee */}
        {featuredBanners.length > 0 && (
          <div className="mb-12 sm:mb-16 md:mb-24 overflow-hidden relative pause-marquee">
            <div className="flex gap-4 sm:gap-6 animate-marquee w-max">
              {/* First set of banners */}
              {featuredBanners.map((res) => (
                <FeaturedBanner key={`banner-1-${res.id}`} restaurant={res} keyPrefix="banner-1" />
              ))}
              {/* Duplicate set for seamless loop */}
              {featuredBanners.map((res) => (
                <FeaturedBanner key={`banner-2-${res.id}`} restaurant={res} keyPrefix="banner-2" />
              ))}
            </div>
          </div>
        )}

        {/* All Restaurants / Products Section */}
        <div className="mb-6 sm:mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-[color:var(--text-primary)] mb-2 sm:mb-3">
              {viewMode === 'restaurants' ? 'Nuestros Restaurantes' : 'Nuestros Productos'}
            </h2>
            <div className="w-16 sm:w-20 h-1 bg-gradient-primary rounded-full"></div>
            <p className="mt-3 sm:mt-4 text-[color:var(--text-secondary)] text-sm sm:text-base md:text-lg">
              {viewMode === 'restaurants'
                ? 'Explora la variedad gastronómica de nuestro pueblo'
                : 'Descubre los platos más populares del pueblo'}
            </p>
          </div>

          {/* View toggle: Restaurantes | Productos */}
          <div className="inline-flex bg-[color:var(--bg-muted)] rounded-full p-1 self-start sm:self-end">
            <button
              type="button"
              onClick={() => handleChangeView('restaurants')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
                viewMode === 'restaurants'
                  ? 'bg-[color:var(--bg-elevated)] text-primary shadow'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <Store size={16} />
              Restaurantes
            </button>
            <button
              type="button"
              onClick={() => handleChangeView('products')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
                viewMode === 'products'
                  ? 'bg-[color:var(--bg-elevated)] text-primary shadow'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <ShoppingBag size={16} />
              Productos
            </button>
          </div>
        </div>

        {/* Category filter buttons (comparten ambos modos) */}
        {categories.length > 0 && (
          <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">
            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 px-4 sm:px-0 sm:flex-wrap scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 whitespace-nowrap border-2 ${
                  selectedCategory === null
                    ? 'bg-primary text-white border-primary shadow-lg'
                    : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary hover:text-primary'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => {
                const isActive = selectedCategory === cat.nombre;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.nombre)}
                    className={`flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 whitespace-nowrap border-2 ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-lg'
                        : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] border-[color:var(--border-default)] hover:border-primary hover:text-primary'
                    }`}
                  >
                    {isActive && (
                      <X size={14} className="inline-block mr-1 -ml-0.5" />
                    )}
                    {cat.nombre}
                  </button>
                );
              })}
            </div>
            {selectedCategory && (
              <p className="mt-2 text-xs sm:text-sm text-[color:var(--text-muted)] px-4 sm:px-0">
                Mostrando {viewMode === 'restaurants' ? 'restaurantes' : 'productos'} con{' '}
                <strong className="text-[color:var(--text-primary)]">{selectedCategory}</strong>


              </p>
            )}
          </div>
        )}

        {/* Vista: Restaurantes */}
        {viewMode === 'restaurants' && (
          filteredRestaurants.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Utensils size={64} className="text-primary mb-4 sm:mb-6 mx-auto opacity-30" />
              <h3 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)] mb-2">
                {searchTerm
                  ? 'No se encontraron restaurantes'
                  : selectedCategory
                    ? `No hay restaurantes con ${selectedCategory}`
                    : 'No hay restaurantes disponibles'}
              </h3>
              <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : selectedCategory
                    ? 'Prueba con otra categoría'
                    : 'Vuelve pronto para más opciones'}
              </p>
              {selectedCategory && !searchTerm && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="mt-4 btn btn-outline"
                >
                  Ver todos los restaurantes
                </button>
              )}
            </div>
          ) : (
            <div className={`relative ${filtering ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
              {filtering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--bg-base)]/40">
                  <div className="spinner border-4 border-primary border-t-transparent rounded-full w-10 h-10 animate-spin" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredRestaurants.map((restaurant, index) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
                ))}
              </div>
            </div>
          )
        )}

        {/* Vista: Productos */}
        {viewMode === 'products' && (
          filteredProductos.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Utensils size={64} className="text-primary mb-4 sm:mb-6 mx-auto opacity-30" />
              <h3 className="text-xl sm:text-2xl font-bold text-[color:var(--text-primary)] mb-2">
                {searchTerm
                  ? 'No se encontraron productos'
                  : selectedCategory
                    ? `No hay productos con ${selectedCategory}`
                    : 'No hay productos disponibles'}
              </h3>
              <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : selectedCategory
                    ? 'Prueba con otra categoría'
                    : 'Vuelve pronto para más opciones'}
              </p>
              {selectedCategory && !searchTerm && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="mt-4 btn btn-outline"
                >
                  Ver todos los productos
                </button>
              )}
            </div>
          ) : (
            <div className={`relative ${filtering ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
              {filtering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--bg-base)]/40">
                  <div className="spinner border-4 border-primary border-t-transparent rounded-full w-10 h-10 animate-spin" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredProductos.map((producto, index) => (
                  <ProductCard key={producto.id} product={producto} index={index} />
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {/* Info Section */}
      <section className="bg-[color:var(--bg-subtle)] py-10 sm:py-12 md:py-16 lg:py-24 px-4 mt-8">
        <div className="max-w-7xl mx-auto">
          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-[color:var(--text-primary)] mb-3 sm:mb-4">
              ¿Eres Restaurante?
            </h2>
            <p className="text-[color:var(--text-secondary)] text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
              Únete a nuestra plataforma y aumenta tus ventas.
              <br />
              <span className="font-semibold">Contactanos ahora </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <a href="https://w.app/3k9utn" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg min-h-[48px]">
                Contactar Ventas
              </a>
              <Link to="/register" className="btn btn-outline btn-lg min-h-[48px]">
                Soy Cliente
              </Link>
            </div>
          </div>
        </div>
      </section>



    </div>
  );
}
