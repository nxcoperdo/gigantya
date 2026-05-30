import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Utensils } from 'lucide-react';
import { restaurantService } from '../services/api';
import Loading from '../components/Loading';

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

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

  const filteredRestaurants = restaurants.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading />;

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-16 md:py-28 px-4 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 text-8xl">🍕</div>
          <div className="absolute bottom-20 left-10 text-7xl">🍜</div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4 animate-fadeIn">
            Pide lo que Amas
          </h1>
          <p className="text-xl md:text-2xl mb-10 opacity-90 font-light">
            Descubre los mejores restaurantes de <span className="font-semibold">Gigante</span> en tu dispositivo
          </p>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto animate-slideUp">
            <div className="relative flex items-center bg-white rounded-xl overflow-hidden shadow-lg-soft">
              <Search className="text-primary absolute left-4" size={24} />
              <input
                type="text"
                placeholder="Buscar restaurante, comida, bebida..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 pl-14 pr-6 py-4 outline-none text-gray-800 text-lg"
              />
            </div>
            <p className="text-sm mt-3 opacity-75">Más de {restaurants.length} restaurantes disponibles</p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24">
        {/* Section Header */}
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-3">
            Restaurantes Destacados
          </h2>
          <div className="w-20 h-1 bg-gradient-primary rounded-full"></div>
          <p className="mt-4 text-gray-600 text-lg">
            Ordena con confianza desde los mejores restaurantes de la ciudad
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-8 animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-16">
            <Utensils size={80} className="text-primary mb-6 mx-auto opacity-30" />
            <h3 className="text-2xl font-bold text-dark mb-2">
              {searchTerm ? 'No se encontraron restaurantes' : 'No hay restaurantes disponibles'}
            </h3>
            <p className="text-gray-600">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Vuelve pronto para más opciones'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant, index) => (
              <Link
                key={restaurant.id}
                to={`/restaurant/${restaurant.id}`}
                className="group card-lg hover:shadow-lg-soft cursor-pointer transform transition-all duration-300 hover:-translate-y-2 animate-slideUp"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image Section */}
                <div className="relative mb-5 rounded-xl overflow-hidden bg-gradient-warm h-48">
                  {restaurant.imagen_url ? (
                    <img
                      src={restaurant.imagen_url}
                      alt={restaurant.nombre}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primaryLight to-accent text-6xl">
                      🍽️
                    </div>
                  )}
                  {/* Badge */}
                   <div className="absolute top-3 right-3 bg-white px-3 py-1.5 rounded-full flex items-center gap-1 shadow-medium">
                     <Star size={16} className="text-yellow-500 fill-yellow-500" />
                     <span className="font-bold text-gray-800 text-sm">
                       {Number(restaurant.calificacion)?.toFixed(1) || '5.0'}
                     </span>
                   </div>
                </div>

                {/* Content Section */}
                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-heading font-bold text-dark group-hover:text-primary transition-colors">
                    {restaurant.nombre}
                  </h3>

                  <p className="text-gray-600 text-sm text-ellipsis-2 leading-relaxed">
                    {restaurant.descripcion || 'Disfruta de deliciosos platillos'}
                  </p>

                  {/* Info Row */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <MapPin size={16} className="text-primary" />
                      <span>{restaurant.ciudad}</span>
                    </div>
                    {restaurant.horario_apertura && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs">🕐</span>
                        <span>{restaurant.horario_apertura?.slice(0, 5)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                <button className="w-full mt-5 bg-gradient-primary text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all duration-300 group-hover:scale-105 origin-center">
                  Ver Menú
                </button>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Info Section */}
      <section className="bg-light py-16 md:py-24 px-4 mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center card p-6 hover:shadow-lg transition-all">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold text-dark mb-2">Rápido</h3>
              <p className="text-gray-600">Ordena en segundos y recibe tu comida pronto</p>
            </div>
            <div className="text-center card p-6 hover:shadow-lg transition-all">
              <div className="text-5xl mb-4">👨‍🍳</div>
              <h3 className="text-2xl font-bold text-dark mb-2">Calidad</h3>
              <p className="text-gray-600">Los mejores restaurantes verificados de Gigantá</p>
            </div>
            <div className="text-center card p-6 hover:shadow-lg transition-all">
              <div className="text-5xl mb-4">📱</div>
              <h3 className="text-2xl font-bold text-dark mb-2">Simple</h3>
              <p className="text-gray-600">Interfaz intuitiva y fácil de usar</p>
            </div>
          </div>

          {/* Separator */}
          <div className="divider" />

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-4">
              ¿Eres Restaurante?
            </h2>
            <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
              Únete a nuestra plataforma y aumenta tus ventas. 
              <br />
              <span className="font-semibold">Contactanos ahora </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="mailto:info@gigantya.com" className="btn btn-primary btn-lg">
                Contactar Ventas
              </a>
              <Link to="/register" className="btn btn-outline btn-lg">
                Soy Cliente
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gradient-primary text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-heading font-bold mb-4">¿Listo para Empezar?</h2>
          <p className="text-xl mb-8 opacity-90">Descubre miles de opciones deliciosas</p>
          <Link to="/" className="btn bg-white text-primary hover:bg-light">
            Explorar Restaurantes
          </Link>
        </div>
      </section>
    </div>
  );
}

