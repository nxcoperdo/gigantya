import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Utensils } from 'lucide-react';
import { restaurantService, preferenceService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageHelper';
import Loading from '../components/Loading';
import RecentSearches from '../components/RecentSearches';

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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

    loadRestaurants();
    loadSearchHistory();
  }, [isAuthenticated, user, navigate]);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const response = await restaurantService.getAll();
      setRestaurants(response.data.restaurantes || []);
      setError(null);
    } catch (err) {
      setError('Error cargando restaurantes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSearchHistory = async () => {
    try {
      const res = await preferenceService.getSearchHistory();
      setSearchHistory(res.data);
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const handleSearchChange = async (term) => {
    setSearchTerm(term);
    if (term.trim()) {
      try {
        // Aquí asumimos que el backend guarda el historial automáticamente
        // o podrías llamar a un servicio de guardado aquí.
      } catch (e) {
        console.error('Error saving search:', e);
      }
    }
  };

  const clearHistory = async () => {
    try {
      await preferenceService.clearSearchHistory();
      setSearchHistory([]);
    } catch (e) {
      console.error('Error clearing history:', e);
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredBanners = restaurants.filter(r =>
    r.plan === 'premium' && r.banner_url
  );

  if (loading) return <Loading />;

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-12 sm:py-16 md:py-28 px-4 sm:px-6 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 right-4 sm:right-20 text-6xl sm:text-8xl animate-float">🍕</div>
          <div className="absolute bottom-20 left-4 sm:left-10 text-5xl sm:text-7xl animate-float-delayed">🍜</div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-3 sm:mb-4 animate-fadeIn">
            Pide lo que Amas
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 md:mb-10 opacity-90 font-light px-2">
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
                searches={searchHistory.map(h => h.termino)}
                onSelect={(term) => {
                  handleSearchChange(term);
                  setIsSearchFocused(false);
                }}
                onClear={clearHistory}
              />
            )}
            <p className="text-xs sm:text-sm mt-2.5 sm:mt-3 opacity-75">Más de {restaurants.length} restaurantes disponibles</p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-10 sm:py-12 md:py-16 lg:py-24">
        {/* Section Header */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-dark mb-2 sm:mb-3">
            Restaurantes Destacados
          </h2>
          <div className="w-16 sm:w-20 h-1 bg-gradient-primary rounded-full"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base md:text-lg">
            Ordena con confianza desde los mejores restaurantes de la ciudad
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
                <Link
                  key={`banner-1-${res.id}`}
                  to={`/restaurant/${res.id}`}
                  className="w-64 sm:w-80 md:w-[450px] h-40 sm:h-48 rounded-xl sm:rounded-2xl overflow-hidden relative group shadow-lg-soft hover:shadow-xl transition-all flex-shrink-0 active:scale-95 touch-feedback"
                >
                  <img
                    src={getImageUrl(res.banner_url)}
                    alt={res.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase ${
                        res.plan === 'premium' ? 'bg-yellow-400 text-dark' : 'bg-gray-400 text-dark'
                      }`}>
                        {res.plan}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{res.nombre}</h3>
                    <p className="text-xs sm:text-sm opacity-80 line-clamp-1">{res.descripcion}</p>
                  </div>
                </Link>
              ))}
              {/* Duplicate set for seamless loop */}
              {featuredBanners.map((res) => (
                <Link
                  key={`banner-2-${res.id}`}
                  to={`/restaurant/${res.id}`}
                  className="w-64 sm:w-80 md:w-[450px] h-40 sm:h-48 rounded-xl sm:rounded-2xl overflow-hidden relative group shadow-lg-soft hover:shadow-xl transition-all flex-shrink-0 active:scale-95 touch-feedback"
                >
                  <img
                    src={getImageUrl(res.banner_url)}
                    alt={res.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase ${
                        res.plan === 'premium' ? 'bg-yellow-400 text-dark' : 'bg-gray-400 text-dark'
                      }`}>
                        {res.plan}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{res.nombre}</h3>
                    <p className="text-xs sm:text-sm opacity-80 line-clamp-1">{res.descripcion}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Restaurants Section */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-dark mb-2 sm:mb-3">
            Nuestros Restaurantes
          </h2>
          <div className="w-16 sm:w-20 h-1 bg-gradient-primary rounded-full"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base md:text-lg">
            Explora la variedad gastronómica de nuestra ciudad
          </p>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <Utensils size={64} className="text-primary mb-4 sm:mb-6 mx-auto opacity-30" />
            <h3 className="text-xl sm:text-2xl font-bold text-dark mb-2">
              {searchTerm ? 'No se encontraron restaurantes' : 'No hay restaurantes disponibles'}
            </h3>
            <p className="text-gray-600 text-sm sm:text-base">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Vuelve pronto para más opciones'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredRestaurants.map((restaurant, index) => (
              <Link
                key={restaurant.id}
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
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-4xl sm:text-6xl">
                      🍽️
                    </div>
                  )}
                  {/* Badge */}
                   <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 shadow-medium">
                     <Star size={14} className="text-yellow-500 fill-yellow-500" />
                     <span className="font-bold text-gray-800 text-xs sm:text-sm">
                       {Number(restaurant.calificacion)?.toFixed(1) || '5.0'}
                     </span>
                   </div>
                   {restaurant.plan && restaurant.plan !== 'basico' && (
                     <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary/90 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold uppercase shadow-sm">
                       {restaurant.plan}
                     </div>
                   )}
                </div>

                {/* Content Section */}
                <div className="space-y-2 sm:space-y-3">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-dark group-hover:text-primary transition-colors line-clamp-2 min-h-[44px]">
                    {restaurant.nombre}
                  </h3>

                  <p className="text-gray-600 text-xs sm:text-sm text-ellipsis-2 leading-relaxed min-h-[40px]">
                    {restaurant.descripcion || 'Disfruta de deliciosos platillos'}
                  </p>

                  {/* Info Row */}
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 pt-2 sm:pt-3 border-t border-gray-100 flex-wrap">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <MapPin size={14} className="text-primary flex-shrink-0" />
                      <span className="truncate">{restaurant.ciudad}</span>
                    </div>
                    {restaurant.horario_apertura && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs">🕐</span>
                        <span>{restaurant.horario_apertura?.slice(0, 5)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                <button className="w-full mt-4 sm:mt-5 bg-gradient-primary text-white font-semibold py-2.5 sm:py-3 rounded-lg hover:shadow-lg transition-all duration-300 group-hover:scale-105 origin-center min-h-[44px] active:scale-95 touch-feedback">
                  Ver Menú
                </button>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Info Section */}
      <section className="bg-light py-10 sm:py-12 md:py-16 lg:py-24 px-4 mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-10 sm:mb-12">
            <div className="text-center card p-5 sm:p-6 hover:shadow-lg transition-all active:scale-95 touch-feedback">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">⚡</div>
              <h3 className="text-xl sm:text-2xl font-bold text-dark mb-2">Rápido</h3>
              <p className="text-gray-600 text-sm sm:text-base">Ordena en segundos y recibe tu comida pronto</p>
            </div>
            <div className="text-center card p-5 sm:p-6 hover:shadow-lg transition-all active:scale-95 touch-feedback">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">👨‍🍳</div>
              <h3 className="text-xl sm:text-2xl font-bold text-dark mb-2">Calidad</h3>
              <p className="text-gray-600 text-sm sm:text-base">Los mejores restaurantes verificados de Gigantá</p>
            </div>
            <div className="text-center card p-5 sm:p-6 hover:shadow-lg transition-all active:scale-95 touch-feedback">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📱</div>
              <h3 className="text-xl sm:text-2xl font-bold text-dark mb-2">Simple</h3>
              <p className="text-gray-600 text-sm sm:text-base">Interfaz intuitiva y fácil de usar</p>
            </div>
          </div>

          {/* Separator */}
          <div className="divider my-6 sm:my-8" />

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-dark mb-3 sm:mb-4">
              ¿Eres Restaurante?
            </h2>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
              Únete a nuestra plataforma y aumenta tus ventas.
              <br />
              <span className="font-semibold">Contactanos ahora </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <a href="mailto:info@gigantya.com" className="btn btn-primary btn-lg min-h-[48px]">
                Contactar Ventas
              </a>
              <Link to="/register" className="btn btn-outline btn-lg min-h-[48px]">
                Soy Cliente
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gradient-primary text-white py-8 sm:py-10 md:py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-3 sm:mb-4">¿Listo para Empezar?</h2>
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 opacity-90">Descubre miles de opciones deliciosas</p>
          <Link to="/" className="btn bg-white text-primary hover:bg-light min-h-[48px] px-8">
            Explorar Restaurantes
          </Link>
        </div>
      </section>
    </div>
  );
}

