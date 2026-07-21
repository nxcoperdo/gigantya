import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Utensils, X, Store, ShoppingBag, ShoppingBasket, Clock, Truck, Zap, UtensilsCrossed, ChevronUp, ArrowRight, Croissant, MessageCircle, Phone, ExternalLink, Coffee, ChevronRight, Send } from 'lucide-react';
import { restaurantService, preferenceService, categoryService, productService, homeService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl, IMAGE_DEFAULT_ATTRS, IMAGE_EAGER_ATTRS } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';
import { isRestaurantOpen } from '../utils/scheduleHelper';
import { getCategoryIcon } from '../utils/categoryIcons';
import { canAccessPlan } from '../utils/planFeatures';
import Loading from '../components/Loading';
import SearchAutocomplete, { useSearchAutocomplete } from '../components/SearchAutocomplete';
import OnboardingTip from '../components/help/OnboardingTip';
import ClientHelpBanner from '../components/help/ClientHelpBanner';
import ClientTour from '../components/help/ClientTour';

// El banner del hero se consume del backend (`homeService.getActiveHomeMedia`).
// Si no hay banner activo, se usa el fallback estático `/media/banner.mp4`
// (mismo asset que se mostraba antes en días impares). Fase 12 reemplazó
// el pickDailyBanner() que rot día por medio. Fase 12b sirvió los archivos
// vía /media/ (commiteados al repo). Fase 12c los movió a uploads del
// server (server/uploads/home-media-uploaded/) subidos desde el admin.
//
// Fase 12d: además del banner, los 4 bloques del hero (título, subtítulo,
// buscador, badge) y los botones custom se consumen del backend vía
// `homeService.getHero()` (configurados desde /admin/home-hero). Cada
// bloque tiene un toggle ON/OFF y los textos son editables. El cliente
// renderiza condicionalmente cada uno.

// Whitelist de iconos soportados (Fase 12d). Tiene que matchear la
// whitelist del backend (adminHomeHeroController.ALLOWED_ICONS). NO
// importar más iconos de lucide aquí — cada import suma al bundle.
const HERO_ICON_MAP = {
  MessageCircle, MapPin, Store, Phone, ExternalLink,
  ShoppingBag, Coffee, ChevronRight, Send,
};

// Estilos de los botones (Fase 12d). Coinciden con los variants del
// backend (adminHomeHeroController.ALLOWED_VARIANTS). Cada variant
// tiene su combinación de clases para las 3 situaciones:
// sobre banner oscuro con backdrop-blur.
const HERO_BUTTON_VARIANT_CLS = {
  primary:
    'bg-white text-gray-900 hover:bg-white/90 shadow-lg shadow-black/10',
  secondary:
    'bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm',
  outline:
    'bg-transparent text-white border-2 border-white/50 hover:bg-white/10 backdrop-blur-sm',
};

// Tarjeta de restaurante memoizada: solo se re-renderiza si cambian sus props
const RestaurantCard = memo(function RestaurantCard({ restaurant, index }) {
  const isOpen = isRestaurantOpen(restaurant.horario_apertura, restaurant.horario_cierre);
  // Detección robusta: la API puede devolver 1/0, true/false o undefined.
  const ofreceDomicilio = restaurant.ofrece_domicilio === undefined
    ? true
    : Boolean(Number(restaurant.ofrece_domicilio));
  // Tipo de negocio "Mercado y abarrotes": default false para filas anteriores
  // a la migración `es_mercado_abarrotes` (que ya rellena con 0 por DEFAULT).
  const esMercadoAbarrotes = restaurant.es_mercado_abarrotes === undefined
    ? false
    : Boolean(Number(restaurant.es_mercado_abarrotes));
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      data-tour={index === 0 ? 'home-card-local' : undefined}
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
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/95 backdrop-blur-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 shadow-lg ring-1 ring-black/5">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-gray-800 text-xs sm:text-sm tabular-nums">
              {Number(restaurant.calificacion_promedio).toFixed(1)}
            </span>
          </div>
        )}
        {/* Badge abierto/cerrado */}
        <div
          data-tour={index === 0 ? 'home-badge-abierto' : undefined}
          className={`absolute top-2 sm:top-3 left-2 sm:left-3 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 shadow-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide ${
            isOpen
              ? 'bg-emerald-500 text-white ring-1 ring-emerald-600/30'
              : 'bg-red-500 text-white ring-1 ring-red-600/30'
          }`}
        >
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOpen ? 'bg-white animate-pulse' : 'bg-white/70'}`} />
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
          {/* Pill "Solo retiro en local" — solo aparece si el restaurante
              desactivó domicilios desde su dashboard. */}
          {!ofreceDomicilio && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0"
              style={{
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              <Store size={11} />
              Solo retiro en local
            </div>
          )}
          {/* Pill "Mercado y abarrotes" — aparece cuando el admin marcó
              este restaurante como mercado desde el dashboard. */}
          {esMercadoAbarrotes && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0"
              style={{
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success-text)',
                border: '1px solid var(--success-border)',
              }}
            >
              <ShoppingBasket size={11} />
              Mercado y abarrotes
            </div>
          )}
        </div>
      </div>

      {/* CTA Button */}
      <div className="w-full mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-[color:var(--border-subtle)]">
        <button className="w-full bg-gradient-primary text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 group-hover:scale-[1.02] origin-center min-h-[44px] active:scale-95 touch-feedback flex items-center justify-center gap-2">
          Ver Menú
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
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

        {/* Local cerrado */}
        {!isRestaurantOpenNow && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-full">
              Local cerrado
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
      <div className="w-full mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-[color:var(--border-subtle)]">
        <button className="w-full bg-gradient-primary text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 group-hover:scale-[1.02] origin-center min-h-[44px] active:scale-95 touch-feedback flex items-center justify-center gap-2">
          Ver local
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
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
  // Fase 12d: config del hero. `heroSettings` puede ser null mientras
  // se carga — en ese caso se muestra el hero hardcodeado como antes.
  // `heroButtons` es [] mientras se carga. Si la API falla, mantenemos
  // el último valor conocido (no se borra el contenido visible).
  const [heroSettings, setHeroSettings] = useState(null);
  const [heroButtons, setHeroButtons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filtering, setFiltering] = useState(false);
  const [viewMode, setViewMode] = useState('restaurants'); // 'restaurants' | 'products'
  // Filtro de modalidad de servicio en la sección "Locales Destacados":
  //   'con_domicilio'   → muestra solo locales con ofrece_domicilio = 1 (default)
  //   'sin_domicilio'   → muestra solo locales con ofrece_domicilio = 0
  const [domicilioFilter, setDomicilioFilter] = useState('con_domicilio');
  // Filtro EXCLUSIVO de tipo de negocio (toggle que reemplaza al antiguo
  // `mercadoFilter` acumulable). Cinco valores mutuamente excluyentes:
  //   'todos'               → muestra los cuatro nichos mezclados (default)
  //   'restaurante'         → solo locales con es_restaurante=1
  //   'comida_rapida'       → solo locales con es_comida_rapida=1
  //   'mercado'             → solo locales con es_mercado_abarrotes=1
  //   'panaderia_pasteleria'→ solo locales con es_panaderia_pasteleria=1
  //                            (nuevo nicho, agregable vía migración
  //                             20260703000001_add_panaderia_pasteleria_nicho)
  const [tipoNegocioFilter, setTipoNegocioFilter] = useState('todos');
  // Estado del colapso de chips de categorías. Solo aplica a la vista
  // 'Todos': cuando hay muchos catálogos mezclados, mostramos los N más
  // populares + un "+X más" que expande in-line. En las otras vistas el
  // catálogo es chico y se muestra completo (sin botón de colapso).
  const [categoriasExpanded, setCategoriasExpanded] = useState(false);
  // Refs del carrusel de banners destacados (FeaturedBanner).
  // El carrusel es arrastrable y auto-animado. El movimiento lo
  // maneja un rAF que aplica `transform: translateX()` al track.
  //   - `featuredScrollerRef`    → wrapper (overflow:hidden, relative)
  //   - `featuredTrackRef`       → track (position:absolute, will-change)
  //   - `featuredRafRef`         → id del rAF activo
  //   - `featuredPausedRef`      → true mientras el usuario arrastra
  //   - `featuredOffsetRef`      → posición actual del track (px, negativo)
  //   - `featuredLastTsRef`      → timestamp del frame anterior
  //   - `featuredPointerXRef`    → clientX al iniciar drag (-1 si no hay)
  //   - `featuredResumeTimerRef` → timer para reanudar tras soltar
  // Usamos refs (no state) porque el rAF corre fuera del render.
  const featuredScrollerRef = useRef(null);
  const featuredTrackRef = useRef(null);
  const featuredRafRef = useRef(null);
  const featuredPausedRef = useRef(false);
  const featuredOffsetRef = useRef(0);
  const featuredLastTsRef = useRef(0);
  const featuredPointerXRef = useRef(-1);
  const featuredResumeTimerRef = useRef(null);
  // Banner del hero: viene de GET /api/home/media. Si es null, se
  // muestra el fallback estático `/media/banner.mp4`. Ver admin en
  // /admin/home-media para cambiarlo.
  const [homeMedia, setHomeMedia] = useState(null);
  // Manual contextual — Capa 2 para clientes. `clientTourKey` se
  // incrementa para forzar el remontaje del tour cada vez que se
  // reabre (mismo patrón que RestaurantDashboardPage).
  const [clientTourOpen, setClientTourOpen] = useState(false);
  const [clientTourKey, setClientTourKey] = useState(0);
  // Ref guard: el auto-tour se abre 1 sola vez por mount, no en
  // cada cambio de filtro o scroll. La misma lógica que en el
  // dashboard (autoTourFiredRef).
  const autoClientTourFiredRef = useRef(false);
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
    // Cargar el banner activo del hero. Es público, no necesita token.
    // Si falla, homeMedia queda en null y se muestra el fallback
    // estático `/media/banner.mp4` (mismo asset que la home mostraba antes).
    homeService.getActiveHomeMedia()
      .then((r) => setHomeMedia(r?.media || null))
      .catch(() => setHomeMedia(null));
    // Cargar la config del hero (textos + botones). Si falla, mantenemos
    // los defaults (heroSettings=null → usamos valores hardcodeados como
    // fallback para no romper la primera renderización).
    homeService.getHero()
      .then((d) => {
        setHeroSettings(d?.settings || null);
        setHeroButtons(Array.isArray(d?.buttons) ? d.buttons : []);
      })
      .catch(() => {
        // Si falla, dejamos null/[] para que el render use los defaults
        // hardcodeados (mismo contenido que antes de Fase 12d).
        setHeroSettings(null);
        setHeroButtons([]);
      });
  }, [isAuthenticated, user, navigate]);

  // Auto-tour del cliente (Capa 2 del manual contextual — versión cliente).
  // Se abre la primera vez que el cliente entra a la HomePage, solo si:
  //   - está logueado
  //   - es tipo_usuario === 'cliente'
  //   - el estado del banner es 'new' (primera vez)
  //   - el tour no se completó todavía
  // Mismo patrón que el auto-tour del dueño en RestaurantDashboardPage:
  // useRef guard para que no se reabra si el cliente navega y vuelve.
  // Delay 1.2s para que vea el banner primero.
  useEffect(() => {
    if (autoClientTourFiredRef.current) return;
    if (!isAuthenticated || !user || user.tipo_usuario !== 'cliente') return;
    if (loading) return; // esperar a que carguen los datos
    const bannerState = user?.otros_datos?.onboarding?.client_help_banner_state;
    const tourDone = !!user?.otros_datos?.onboarding?.client_tour_completed;
    if (bannerState !== 'new' || tourDone) return;
    autoClientTourFiredRef.current = true;
    const t = setTimeout(() => {
      setClientTourKey((k) => k + 1);
      setClientTourOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [isAuthenticated, user, loading]);

  // Cuando cambia la categoría, el modo de vista, el filtro de modalidad
  // o el toggle exclusivo de tipo de negocio, recargamos la lista
  // correspondiente. El backend ya devuelve los datos ordenados
  // premium → profesional → basico, así que no re-ordenamos en cliente.
  // Cuando cambia `tipoNegocioFilter` también recargamos categorías:
  // el catálogo de comida rápida es distinto del de restaurantes.
  useEffect(() => {
    if (viewMode === 'restaurants') {
      loadRestaurants();
    } else {
      loadProductos();
    }
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, viewMode, domicilioFilter, tipoNegocioFilter]);

  const loadRestaurants = useCallback(async ({ preserveSpinner = false } = {}) => {
    try {
      if (preserveSpinner) {
        setFiltering(true);
      } else {
        setLoading(true);
      }
      // Mapeamos el toggle de la UI al filtro que espera la API.
      const params = {};
      if (selectedCategory) params.categoria = selectedCategory;
      if (domicilioFilter === 'con_domicilio') params.ofrece_domicilio = true;
      else if (domicilioFilter === 'sin_domicilio') params.ofrece_domicilio = false;
      // Filtro de nicho exclusivo. Si está en 'todos', no se envía
      // y el backend devuelve los tres nichos mezclados (default).
      if (tipoNegocioFilter !== 'todos') params.tipo_negocio = tipoNegocioFilter;

      const response = await restaurantService.getAll(params);
      setRestaurants(response.data.restaurantes || []);
      setError(null);
    } catch (err) {
      setError('Error cargando locales');
      console.error(err);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }, [selectedCategory, domicilioFilter, tipoNegocioFilter]);

  const loadProductos = useCallback(async ({ preserveSpinner = false } = {}) => {
    try {
      if (preserveSpinner) {
        setFiltering(true);
      } else {
        setLoading(true);
      }
      const params = {};
      if (selectedCategory) params.categoria = selectedCategory;
      // Mismo nicho exclusivo que `loadRestaurants`. Si está en 'todos',
      // el backend devuelve productos de los tres nichos mezclados.
      if (tipoNegocioFilter !== 'todos') params.tipo_negocio = tipoNegocioFilter;

      const response = await productService.getAll(params);
      setProductos(response.data.productos || []);
      setError(null);
    } catch (err) {
      setError('Error cargando productos');
      console.error(err);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }, [selectedCategory, tipoNegocioFilter]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAll();
      const list = res.data?.categorias || [];
      // El endpoint devuelve categorías con su `tipo_negocio`
      // ('restaurante' | 'mercado' | 'comida_rapida'). El toggle exclusivo
      // controla qué catálogo se muestra:
      //   - 'todos'         → mezcla los tres catálogos y deduplica por nombre
      //   - 'restaurante'   → solo categorías de tipo 'restaurante'
      //   - 'comida_rapida' → solo categorías de tipo 'comida_rapida'
      //   - 'mercado'       → solo categorías de tipo 'mercado'
      // Filas sin `tipo_negocio` (anteriores a la migración) se tratan como 'restaurante'.
      const tipoDeseado = tipoNegocioFilter; // 'todos' | 'restaurante' | 'comida_rapida' | 'mercado'
      const seen = new Set();
      const unique = [];
      for (const cat of list) {
        const tipoCat = cat.tipo_negocio || 'restaurante';
        // Si el usuario eligió un nicho específico, descartamos los demás.
        // Si eligió 'todos', aceptamos cualquier tipo.
        if (tipoDeseado !== 'todos' && tipoCat !== tipoDeseado) continue;
        const key = cat.nombre?.trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          unique.push({ id: cat.id, nombre: cat.nombre.trim() });
        }
      }
      // Orden alfabético A→Z (case-insensitive) para los chips de filtrado.
      // El backend ya devuelve ordenado por `orden ASC, LOWER(nombre) ASC`,
      // pero ordenamos aquí para que sea robusto si el orden del backend cambia.
      unique.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      setCategories(unique);
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  }, [tipoNegocioFilter]);

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
    () => restaurants.filter(r => canAccessPlan(r.plan, 'banner_home') && r.banner_url),
    [restaurants]
  );

  // Conteo de productos por categoría para ordenar los chips por popularidad.
  // Solo se usa cuando tipoNegocioFilter === 'todos' (mezcla de nichos).
  // Categorías sin productos quedan con conteo 0 → caen al final.
  const popularidadCategorias = useMemo(() => {
    const map = {};
    for (const p of productos) {
      const key = (p.categoria_nombre || '').trim().toLowerCase();
      if (!key) continue;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [productos]);

  // Categorías listas para renderizar los chips. Cuando el toggle es
  // 'todos' las reordenamos por popularidad descendente (las más
  // populares primero) para que el top N quepa en una fila visible.
  // En las otras vistas conservamos el orden alfabético que ya define
  // `loadCategories` (más predecible para catálogos específicos).
  const categoriasParaChips = useMemo(() => {
    if (tipoNegocioFilter !== 'todos') return categories;
    return [...categories].sort((a, b) => {
      const ca = popularidadCategorias[(a.nombre || '').trim().toLowerCase()] || 0;
      const cb = popularidadCategorias[(b.nombre || '').trim().toLowerCase()] || 0;
      if (cb !== ca) return cb - ca; // mayor popularidad primero
      // Desempate alfabético para que sea estable.
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
  }, [categories, tipoNegocioFilter, popularidadCategorias]);

  // Colapso de chips: en 'Todos' mostramos solo las N más populares y
  // dejamos un "+X más" si quedan más. En las otras vistas el catálogo
  // es chico y se muestra completo sin colapso.
  const LIMITE_CATEGORIAS_VISIBLES = 8;
  const showCategoriasCollapse = tipoNegocioFilter === 'todos'
    && categoriasParaChips.length > LIMITE_CATEGORIAS_VISIBLES;
  const categoriasVisibles = categoriasExpanded || !showCategoriasCollapse
    ? categoriasParaChips
    : categoriasParaChips.slice(0, LIMITE_CATEGORIAS_VISIBLES);
  const categoriasOcultasCount = categoriasParaChips.length - categoriasVisibles.length;

  // Memoizar las búsquedas recientes (solo el array de términos)
  const searchTerms = useMemo(
    () => searchHistory.map(h => h.termino),
    [searchHistory]
  );

  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  const handleSelectCategory = useCallback((nombre) => {
    // Si se selecciona la misma categoría activa, la limpiamos (volver a "Todos")
    setSelectedCategory(prev => (prev === nombre ? null : nombre));
  }, []);

  const handleChangeView = useCallback((mode) => {
    if (mode !== viewMode) {
      setViewMode(mode);
      // Reset del colapso al alternar entre restaurantes/productos: los
      // chips son los mismos pero el sentido del scroll cambia.
      setCategoriasExpanded(false);
    }
  }, [viewMode]);

  const handleChangeDomicilioFilter = useCallback((value) => {
    if (value !== domicilioFilter) setDomicilioFilter(value);
  }, [domicilioFilter]);

  const handleChangeTipoNegocio = useCallback((value) => {
    if (value === tipoNegocioFilter) return;
    // Whitelist defensiva: aceptamos solo los 5 valores del toggle exclusivo
    // (4 nichos + 'todos'). Cualquier otro valor se ignora silenciosamente
    // para no contaminar el state con basura de querystring / localStorage.
    if (!['todos', 'restaurante', 'comida_rapida', 'mercado', 'panaderia_pasteleria'].includes(value)) return;
    setTipoNegocioFilter(value);
    // Al alternar entre nichos, la categoría seleccionada deja de tener
    // sentido: los catálogos no se solapan. La reseteamos a null para
    // que el filtro "?categoria=X" del backend no filtre por un nombre
    // que pertenece al otro nicho. También colapsamos los chips porque
    // el orden/cantidad cambia.
    setSelectedCategory(null);
    setCategoriasExpanded(false);
  }, [tipoNegocioFilter]);

  const clearHistory = useCallback(async () => {
    try {
      await preferenceService.clearSearchHistory();
      setSearchHistory([]);
    } catch (e) {
      console.error('Error clearing history:', e);
    }
  }, []);

  // ============================================================
  // Autocompletado de la barra de búsqueda
  // ============================================================
  //
  // El state del dropdown (loading, error, results, selectedIndex, fetch con
  // debounce) vive en el hook `useSearchAutocomplete`. Aquí solo lo consumimos
  // y le pasamos el resultado al componente presentacional `<SearchAutocomplete>`.
  // El `composeKeyDown` se monta en el `<input>` del buscador para que las
  // flechas ↑/↓ y Escape muevan el highlight del dropdown.
  const closeAutocomplete = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  // Handler que se invoca cuando el usuario elige un resultado del
  // dropdown (con teclado Enter+highlight, o click). El componente
  // `SearchAutocomplete` ya hace `navigate` + `onClose` por su cuenta;
  // aquí solo guardamos el término y refrescamos el state local del
  // historial para feedback inmediato.
  const handleSelectResult = useCallback(
    (_item) => {
      const term = searchTerm.trim();
      if (term.length > 0) handleSaveSearch(term);
    },
    [searchTerm], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const {
    loading: suggestLoading,
    error: suggestError,
    results: suggestResults,
    selectedIndex: suggestSelectedIndex,
    setSelectedIndex: setSuggestSelectedIndex,
    flatItems: suggestFlatItems,
    composeKeyDown: composeSearchKeyDown,
  } = useSearchAutocomplete({
    searchTerm,
    isOpen: isSearchFocused,
    tipoNegocioFilter,
    limit: 5,
    onSelect: handleSelectResult,
    onClose: closeAutocomplete,
  });

  // Click en un término del historial de "Búsquedas recientes". Llena el input
  // y dispara el guardado (porque el usuario está confirmando esa búsqueda).
  const handleSelectRecent = useCallback(
    (term) => {
      setSearchTerm(term);
      setIsSearchFocused(false);
      handleSaveSearch(term);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Submit del término actual (Enter sin highlight en el dropdown, o click en
  // un término del historial). Cierra el dropdown y guarda el término.
  // La búsqueda en sí ya está aplicada en cliente (filteredRestaurants /
  // filteredProductos) — el input controlado dispara el filtro en cada
  // onChange, así que con solo setear searchTerm alcanza.
  const handleSubmitTerm = useCallback(
    (e) => {
      if (e.key !== 'Enter') return;
      const term = searchTerm.trim();
      if (term.length === 0) return;
      setIsSearchFocused(false);
      handleSaveSearch(term);
    },
    [searchTerm], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Persiste un término en el historial del usuario autenticado. Si el
  // visitante es anónimo, no se llama al backend. Capturamos 401
  // silenciosamente para que el interceptor global de axios NO redirija
  // a /login desde la home pública (ver `api.js:30-42`). Después
  // refrescamos el state local del historial para que el dropdown
  // muestre el término al toque.
  const handleSaveSearch = useCallback(
    async (termino) => {
      if (!isAuthenticated) return;
      if (!termino || termino.length === 0) return;
      try {
        await preferenceService.addSearchTerm(termino);
        // Refrescar el historial en memoria para feedback inmediato.
        loadSearchHistory();
      } catch (err) {
        // 401 = token expirado. NO dejamos que el interceptor global
        // redirija — la home es pública y romperíamos la UX del visitante.
        if (err?.response?.status === 401) {
          console.warn('No se pudo guardar la búsqueda: sesión expirada.');
        } else {
          console.warn('No se pudo guardar la búsqueda:', err);
        }
      }
    },
    [isAuthenticated], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Handler combinado para el `<input>`. `composeSearchKeyDown` se ocupa de
  // las flechas, Escape y Enter-con-highlight; `handleSubmitTerm` corre
  // después (solo si nosotros no hicimos preventDefault) para Enter-sin-highlight.
  const onInputKeyDown = composeSearchKeyDown(handleSubmitTerm);

  // Lógica del carrusel de banners destacados.
  // El track se mueve aplicando `transform: translateX(offset)` desde
  // un rAF. El usuario puede arrastrar con el dedo/ratón: al hacer
  // pointerdown capturamos la posición, pausamos el rAF, y movemos
  // el track 1:1 con el delta del puntero. Al soltar, 1.2s después
  // se reanuda la animación automática desde la posición actual.
  //
  // Loop infinito: el array de banners está duplicado en el JSX (set
  // 1 = set 2), así que `halfWidth` (ancho de un set) marca el
  // momento de "saltar" de vuelta. Cuando `offset <= -halfWidth`
  // le sumamos `halfWidth` para volver al inicio. Como ambos sets
  // son visualmente idénticos, el ojo no nota el salto.
  const FEATURED_SPEED_PX_PER_SEC = 50;
  const FEATURED_RESUME_DELAY_MS = 1200;
  const FEATURED_DRAG_THRESHOLD_PX = 4;

  // Aplica el offset actual al track. Helper pequeño para no repetir
  // el `transform` en 4 sitios.
  const applyFeaturedOffset = useCallback(() => {
    const track = featuredTrackRef.current;
    if (track) {
      track.style.transform = `translate3d(${featuredOffsetRef.current}px, 0, 0)`;
    }
  }, []);

  const stepFeatured = useCallback((ts) => {
    // Solo avanzamos si no hay drag activo y la pestaña es visible.
    if (
      !featuredPausedRef.current
      && document.visibilityState === 'visible'
    ) {
      const track = featuredTrackRef.current;
      if (track) {
        const last = featuredLastTsRef.current || ts;
        const dt = Math.min(ts - last, 100); // cap para evitar saltos tras pestaña oculta
        featuredLastTsRef.current = ts;
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          const delta = (FEATURED_SPEED_PX_PER_SEC * dt) / 1000;
          let next = featuredOffsetRef.current - delta; // negativo = hacia la izquierda
          // Loop infinito: cuando llegamos al final del primer set,
          // reseteamos al inicio del segundo set (idéntico).
          if (next <= -halfWidth) next += halfWidth;
          featuredOffsetRef.current = next;
          applyFeaturedOffset();
        }
      }
    } else {
      // Si está en pausa, solo actualizamos el timestamp para que
      // el próximo frame activo no salte por el delta acumulado.
      featuredLastTsRef.current = ts;
    }
    featuredRafRef.current = requestAnimationFrame(stepFeatured);
  }, [applyFeaturedOffset]);

  // Inicia el rAF cuando hay banners. Se rearranca si la cantidad
  // cambia (filtros) o si se monta/desmonta.
  useEffect(() => {
    if (featuredBanners.length === 0) {
      if (featuredRafRef.current) {
        cancelAnimationFrame(featuredRafRef.current);
        featuredRafRef.current = null;
      }
      return undefined;
    }
    // Reset al arrancar con un set nuevo de banners.
    featuredLastTsRef.current = 0;
    featuredPausedRef.current = false;
    featuredPointerXRef.current = -1;
    featuredOffsetRef.current = 0;
    applyFeaturedOffset();
    featuredRafRef.current = requestAnimationFrame(stepFeatured);
    return () => {
      if (featuredRafRef.current) {
        cancelAnimationFrame(featuredRafRef.current);
        featuredRafRef.current = null;
      }
    };
  }, [featuredBanners.length, stepFeatured, applyFeaturedOffset]);

  // Handlers de drag. Usamos Pointer Events (cubre mouse, touch y pen).
  // Solo capturamos el pointer cuando el usuario realmente arrastró
  // (umbral FEATURED_DRAG_THRESHOLD_PX), así un click/tap simple no
  // se malinterpreta como drag.
  const handleFeaturedPointerDown = useCallback((e) => {
    // Guardamos la X inicial y un flag "posible drag". El rAF sigue
    // corriendo pero no avanza porque `featuredPausedRef` queda en
    // true. Si el usuario suelta sin moverse, fue un click — el
    // Link del banner se encarga de la navegación normalmente.
    featuredPointerXRef.current = e.clientX;
    // Pausamos inmediatamente; el resume timer (si existía) se
    // reemplaza por uno nuevo en pointerup.
    featuredPausedRef.current = true;
    if (featuredResumeTimerRef.current) {
      clearTimeout(featuredResumeTimerRef.current);
      featuredResumeTimerRef.current = null;
    }
  }, []);

  // Pointermove a nivel de window: si el usuario arrastra el dedo
  // fuera del wrapper, no perdemos el evento. Usamos un listener
  // que añadimos en pointerdown y quitamos en pointerup.
  useEffect(() => {
    const handleMove = (e) => {
      if (featuredPointerXRef.current === -1) return;
      const dx = e.clientX - featuredPointerXRef.current;
      if (Math.abs(dx) < FEATURED_DRAG_THRESHOLD_PX) return;
      // Marcamos que estamos arrastrando de verdad.
      featuredPointerXRef.current = e.clientX;
      const track = featuredTrackRef.current;
      if (!track) return;
      const halfWidth = track.scrollWidth / 2;
      let next = featuredOffsetRef.current + dx; // dx positivo = arrastró a la derecha
      // Wrap en el rango [-halfWidth, 0]. Si pasa los extremos, da
      // la vuelta para mantener el loop infinito.
      if (next > 0) next -= halfWidth;
      if (next <= -halfWidth) next += halfWidth;
      featuredOffsetRef.current = next;
      applyFeaturedOffset();
    };

    const handleUp = () => {
      if (featuredPointerXRef.current === -1) return;
      featuredPointerXRef.current = -1;
      // Reanudamos la animación automática 1.2s después de soltar.
      if (featuredResumeTimerRef.current) {
        clearTimeout(featuredResumeTimerRef.current);
      }
      featuredResumeTimerRef.current = setTimeout(() => {
        featuredPausedRef.current = false;
        featuredLastTsRef.current = 0; // evita salto por delta acumulado
        featuredResumeTimerRef.current = null;
      }, FEATURED_RESUME_DELAY_MS);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [applyFeaturedOffset]);

  // Cleanup del timer al desmontar (el rAF ya se cancela en el effect
  // de arriba, y los listeners de window se quitan en el cleanup del
  // effect de drag).
  useEffect(() => {
    return () => {
      if (featuredResumeTimerRef.current) {
        clearTimeout(featuredResumeTimerRef.current);
        featuredResumeTimerRef.current = null;
      }
    };
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="bg-[color:var(--bg-base)]">
      {/* Manual contextual — Capa 2 para clientes: tour modal.
          Se monta solo cuando `clientTourOpen` es true. El
          `key={clientTourKey}` fuerza remontaje cada vez que se
          reabre, así el step counter arranca en 0. */}
      {clientTourOpen && (
        <ClientTour
          key={clientTourKey}
          onClose={() => setClientTourOpen(false)}
        />
      )}

      {/* Hero Section */}
      <section className="text-white py-12 sm:py-16 md:py-28 px-4 sm:px-6 relative z-30 overflow-visible sm:overflow-hidden">
        {/* Media Background: video o imagen, viene del CMS admin.
            Si no hay banner activo, fallback a /media/banner.mp4 (mismo asset
            que se mostraba antes de la Fase 12). El `key` fuerza re-mount
            al cambiar de banner (importante para que el video reinicie
            y la imagen no quede cacheada en memoria). */}
        {homeMedia?.tipo === 'video' ? (
          <video
            key={`hero-video-${homeMedia.id}`}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={`/media/${homeMedia.archivo}`} type={homeMedia.mime || 'video/mp4'} />
          </video>
        ) : homeMedia?.tipo === 'imagen' ? (
          <img
            key={`hero-img-${homeMedia.id}`}
            src={`/media/${homeMedia.archivo}`}
            alt={homeMedia.nombre || 'Banner de GigantYA'}
            className="absolute inset-0 w-full h-full object-cover"
            {...IMAGE_EAGER_ATTRS}
          />
        ) : (
          // Fallback: video hardcodeado en client/public/. Mismo
          // comportamiento que la home tenía antes de la Fase 12.
          <video
            key="hero-fallback"
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/media/banner.mp4" type="video/mp4" />
          </video>
        )}

        <div className="max-w-7xl mx-auto text-center relative z-10">
          {/* Fase 12d: cada bloque del hero se renderiza condicionalmente
              según `heroSettings`. Si `heroSettings` es null (cargando o
              API caída), usamos los defaults hardcodeados para que la
              primera renderización muestre los mismos textos que antes
              de esta fase. NO cambiamos el comportamiento de filtrado
              ni del state `searchTerm` — solo ocultamos la UI si el
              admin apaga el toggle correspondiente. */}

          {/* Bloque 1: Título (h1) */}
          {(!heroSettings || Number(heroSettings.mostrar_titulo ?? 1) === 1) && (
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-extrabold mb-4 sm:mb-5 animate-fadeIn tracking-tight">
              {heroSettings?.titulo_pre ?? 'Pide lo que'}{' '}
              <span className="text-white drop-shadow-md">{heroSettings?.titulo_post ?? 'Amas'}</span>
            </h1>
          )}

          {/* Bloque 2: Subtítulo (p) */}
          {(!heroSettings || Number(heroSettings.mostrar_subtitulo ?? 1) === 1) && (
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-10 md:mb-12 text-white/95 font-light px-2 max-w-2xl mx-auto leading-relaxed animate-fadeIn">
              {heroSettings?.subtitulo_pre ?? 'Descubre los mejores locales de'}{' '}
              <span className="font-semibold text-white">{heroSettings?.subtitulo_bold ?? 'Gigante'}</span>{' '}
              {heroSettings?.subtitulo_post ?? 'en tu dispositivo'}
            </p>
          )}

          {/* Botones custom (Fase 12d). Aparecen entre el subtítulo y el
              buscador (o al final del hero si no hay subtítulo). Solo se
              renderizan si la API devolvió al menos un botón activo. */}
          {heroButtons.length > 0 && (
            <div
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 animate-fadeIn"
              style={{ animationDelay: '60ms' }}
            >
              {heroButtons.map((b) => {
                const Icon = b.icono ? HERO_ICON_MAP[b.icono] : null;
                const variantCls = HERO_BUTTON_VARIANT_CLS[b.variant] || HERO_BUTTON_VARIANT_CLS.primary;
                return (
                  <a
                    key={b.id}
                    href={b.url}
                    target={b.nueva_pestana ? '_blank' : undefined}
                    rel={b.nueva_pestana ? 'noopener noreferrer' : undefined}
                    className={[
                      'inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                      variantCls,
                    ].join(' ')}
                  >
                    {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                    {b.label}
                    {b.nueva_pestana && (
                      <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                    )}
                  </a>
                );
              })}
            </div>
          )}

          {/* Bloque 3: Buscador (input)
              El hero ya tiene `relative z-30`, así que el dropdown (z-50)
              queda garantizado por encima del `<section>` siguiente del
              Main Content (z-10) que contiene los filter-pills. */}
          {(!heroSettings || Number(heroSettings.mostrar_buscador ?? 1) === 1) && (
            <div className="max-w-3xl mx-auto animate-slideUp relative z-10" style={{ animationDelay: '120ms' }}>
              <div className="relative flex items-center bg-white rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 transition-shadow duration-200 focus-within:shadow-primary/20 focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="text-primary absolute left-4 sm:left-5" size={20} />
                <input
                  type="text"
                  placeholder={heroSettings?.buscador_placeholder ?? 'Buscar local, producto o categoría...'}
                  value={searchTerm}
                  data-tour="home-search"
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  onKeyDown={onInputKeyDown}
                  className="flex-1 pl-12 sm:pl-14 pr-4 sm:pr-6 py-4 sm:py-4.5 outline-none text-gray-800 text-base sm:text-lg placeholder:text-gray-400 min-h-[52px] touch-action-manipulation"
                  aria-label="Buscar locales"
                  aria-autocomplete="list"
                  aria-expanded={isSearchFocused}
                />
              </div>
              {/* Dropdown del autocomplete: maneja los 3 estados (vacío →
                  RecentSearches, < 2 chars → hint, ≥ 2 chars → sugerencias).
                  El state vive en el hook `useSearchAutocomplete` arriba. */}
              {isSearchFocused && (
                <SearchAutocomplete
                  searchTerm={searchTerm}
                  isOpen={isSearchFocused}
                  recentSearches={searchTerms}
                  onSelectRecent={handleSelectRecent}
                  onClearHistory={clearHistory}
                  onSelectResult={handleSelectResult}
                  onClose={closeAutocomplete}
                  limit={5}
                  loading={suggestLoading}
                  error={suggestError}
                  results={suggestResults}
                  selectedIndex={suggestSelectedIndex}
                  setSelectedIndex={setSuggestSelectedIndex}
                  flatItems={suggestFlatItems}
                />
              )}

              {/* Bloque 4: Badge "Más de N locales disponibles" */}
              {(!heroSettings || Number(heroSettings.mostrar_badge_locales ?? 1) === 1) && (
                <p className="text-xs sm:text-sm mt-3 sm:mt-4 text-white/90 font-light tracking-wide">
                  {heroSettings?.badge_locales_pre ?? 'Más de'} {restaurants.length}{' '}
                  {heroSettings?.badge_locales_sufijo ?? 'locales disponibles'}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Manual contextual — Capa 2 para clientes: banner persistente
          con 3 estados. Solo se muestra si el usuario es cliente. El
          banner está entre el hero y la lista de locales para que sea
          lo primero que vea después del buscador. */}
      {isAuthenticated && user?.tipo_usuario === 'cliente' && (
        <ClientHelpBanner
          onStartTour={() => {
            setClientTourKey((k) => k + 1);
            setClientTourOpen(true);
          }}
        />
      )}

      {/* Main Content */}
      {/* z-10 explícito: este `<section>` (con los filter-pills de
          "Con domicilios / Solo retiro en local") SIEMPRE debe quedar
          por debajo del dropdown del buscador. Sin esto, el `bg-base`
          del wrapper podría tapar el dropdown. */}
      <section className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 section relative z-10">
        {/* Toggle: Con domicilios | Solo retiro en local.
            El botón activo recibe `filter-pill-active` (key cambia con el state)
            para que React re-monte solo ese botón y dispare el glow al pasar
            a activo — feedback visual claro de qué filtro quedó prendido. */}
        <div className="mb-6 sm:mb-8 inline-flex bg-[color:var(--bg-muted)] rounded-full p-1 self-start" data-tour="home-toggle-domicilio">
          <button
            key={`domicilio-${domicilioFilter === 'con_domicilio' ? 'active' : 'inactive'}`}
            type="button"
            onClick={() => handleChangeDomicilioFilter('con_domicilio')}
            aria-pressed={domicilioFilter === 'con_domicilio'}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              domicilioFilter === 'con_domicilio'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            <Truck size={16} />
            Con domicilios
          </button>
          <button
            key={`domicilio-${domicilioFilter === 'sin_domicilio' ? 'active' : 'inactive'}`}
            type="button"
            onClick={() => handleChangeDomicilioFilter('sin_domicilio')}
            aria-pressed={domicilioFilter === 'sin_domicilio'}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              domicilioFilter === 'sin_domicilio'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            <Store size={16} />
            Solo retiro en local
          </button>
        </div>

        {/* Toggle exclusivo de tipo de negocio. Una sola selección a la vez
            (no acumulable con el toggle de modalidad de arriba). Default
            'todos' muestra los tres nichos mezclados; al elegir uno, se
            segmenta el feed y el catálogo de categorías.

            Layout responsive:
            - Móvil (< sm): scroll horizontal en una sola fila — mismo patrón
              que los chips de categorías, evita que el toggle se rompa en
              varias líneas y ocupe media pantalla.
            - Desktop (≥ sm): flex-wrap natural, los 4 botones caben en una fila. */}
        <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">
          <div className="px-4 sm:px-0">
            <div className="inline-flex bg-[color:var(--bg-muted)] rounded-full p-1 gap-1 max-w-full overflow-x-auto scrollbar-thin sm:flex-wrap" data-tour="home-toggle-nicho">
          <button
            key="tipo-todos"
            type="button"
            onClick={() => handleChangeTipoNegocio('todos')}
            aria-pressed={tipoNegocioFilter === 'todos'}
            title="Todos"
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              tipoNegocioFilter === 'todos'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            Todos
          </button>
          <button
            key="tipo-restaurante"
            type="button"
            onClick={() => handleChangeTipoNegocio('restaurante')}
            aria-pressed={tipoNegocioFilter === 'restaurante'}
            title="Restaurantes"
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              tipoNegocioFilter === 'restaurante'
                ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            <UtensilsCrossed size={16} />
            <span className="sm:hidden">Rest.</span>
            <span className="hidden sm:inline">Restaurantes</span>
          </button>
          <button
            key="tipo-comida-rapida"
            type="button"
            onClick={() => handleChangeTipoNegocio('comida_rapida')}
            aria-pressed={tipoNegocioFilter === 'comida_rapida'}
            title="Comida rápida"
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              tipoNegocioFilter === 'comida_rapida'
                ? 'bg-amber-500 text-white shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-amber-500'
            }`}
          >
            <Zap size={16} />
            <span className="sm:hidden">Rápida</span>
            <span className="hidden sm:inline">Comida rápida</span>
          </button>
          <button
            key="tipo-mercado"
            type="button"
            onClick={() => handleChangeTipoNegocio('mercado')}
            aria-pressed={tipoNegocioFilter === 'mercado'}
            title="Mercado y abarrotes"
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              tipoNegocioFilter === 'mercado'
                ? 'bg-[color:var(--bg-elevated)] shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
            style={tipoNegocioFilter === 'mercado' ? { color: 'var(--success-text)' } : undefined}
          >
            <ShoppingBasket size={16} />
            <span className="sm:hidden">Mercado</span>
            <span className="hidden sm:inline">Mercado y abarrotes</span>
          </button>
          {/* Filtro "Panadería/Pastelería" (cuarto nicho, agregable vía
              migración 20260703000001_add_panaderia_pasteleria_nicho). Mismo
              patrón visual que los otros chips: activo = fondo rose-500 y
              texto blanco; inactivo = texto rose-500 al pasar el mouse.
              Coherente con el color del toggle del admin dashboard. */}
          <button
            key="tipo-panaderia-pasteleria"
            type="button"
            onClick={() => handleChangeTipoNegocio('panaderia_pasteleria')}
            aria-pressed={tipoNegocioFilter === 'panaderia_pasteleria'}
            title="Panadería y pastelería"
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
              tipoNegocioFilter === 'panaderia_pasteleria'
                ? 'bg-rose-500 text-white shadow filter-pill-active'
                : 'text-[color:var(--text-secondary)] hover:text-rose-500'
            }`}
          >
            <Croissant size={16} />
            <span className="sm:hidden">Panadería</span>
            <span className="hidden sm:inline">Panadería y Pastelería</span>
          </button>
            </div>
          </div>
        </div>

        {/* Section Header — aparece después de los filtros para que el usuario
            vea primero las opciones de filtrado y luego el título de la sección.
            `key` combina los filtros activos para que React re-monte el bloque
            al cambiar y dispare `.filter-header` (fade + slide suaves). */}
        <div
          key={`header-${tipoNegocioFilter}-${domicilioFilter}`}
          className="mb-8 sm:mb-10 md:mb-12 filter-header"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-[color:var(--text-primary)] mb-3 sm:mb-4 tracking-tight">
            {tipoNegocioFilter === 'mercado'
              ? 'Mercados y Abarrotes'
              : tipoNegocioFilter === 'comida_rapida'
                ? 'Comida Rápida'
                : tipoNegocioFilter === 'panaderia_pasteleria'
                  ? 'Panadería y Pastelería'
                  : domicilioFilter === 'sin_domicilio'
                    ? 'Retiro en Local'
                    : 'Locales Destacados'}
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-gradient-primary rounded-full"></div>
          <p className="mt-4 sm:mt-5 text-[color:var(--text-secondary)] text-base sm:text-lg md:text-xl max-w-3xl leading-relaxed">
            {tipoNegocioFilter === 'mercado'
              ? 'Mercados y abarrotes disponibles para que recojas tus productos directamente en el local.'
              : tipoNegocioFilter === 'comida_rapida'
                ? 'Hamburguesas, perros, pizzas, combos y más — entrega rápida a tu puerta.'
                : tipoNegocioFilter === 'panaderia_pasteleria'
                  ? 'Panaderías y pastelerías con panes, tortas, postres y delicias recién hechas.'
                  : domicilioFilter === 'sin_domicilio'
                    ? 'Locales que solo reciben pedidos para retiro en su mostrador — sin entrega a domicilio.'
                    : 'Ordena con confianza desde los mejores locales del pueblo'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-6 sm:mb-8 animate-slideDown">
            ⚠️ {error}
          </div>
        )}

        {/* Featured Banners Marquee.
            - Wrapper con overflow-hidden y position:relative. El track
              se posiciona con `position:absolute` y se mueve vía
              `transform: translate3d(X, 0, 0)` desde un rAF en JS.
            - El usuario puede arrastrar con el dedo/ratón:
              pointerdown captura la X, pausamos el rAF, y los
              pointermove actualizan el offset 1:1 con el delta.
              Al soltar, 1.2s después se reanuda la animación
              automática desde la posición actual.
            - Loop infinito: el array de banners está duplicado en el
              JSX (set 1 = set 2), cuando `offset <= -halfWidth` lo
              reseteamos sumando `halfWidth`. Como los dos sets son
              idénticos, el ojo no nota el salto.
            - El scroll vertical de la página sigue intacto porque
              el track tiene `pointer-events` y el wrapper no
              intercepta el scroll. */}
        {featuredBanners.length > 0 && (
          <div
            ref={featuredScrollerRef}
            className="mb-12 sm:mb-16 md:mb-24 relative overflow-hidden h-40 sm:h-48 select-none touch-pan-y"
            onPointerDown={handleFeaturedPointerDown}
          >
            <div
              ref={featuredTrackRef}
              className="flex gap-4 sm:gap-6 absolute left-0 top-0 will-change-transform cursor-grab active:cursor-grabbing"
            >
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

        {/* Banner contextual: aparece solo cuando el filtro es "Solo retiro en local"
            para reforzar visualmente la modalidad, igual que el banner de premium.
            Lo mostramos aunque NO haya resultados — el banner explica por qué.
            `key` cambia con `tipoNegocioFilter` para que `.filter-banner`
            se vuelva a disparar al cambiar de nicho y aporte continuidad visual. */}
        {domicilioFilter === 'sin_domicilio' && (
          <div
            key={`banner-ctx-${tipoNegocioFilter}`}
            className="mb-8 sm:mb-10 md:mb-12 rounded-2xl overflow-hidden border-2 border-dashed filter-banner"
            style={{
              backgroundColor: 'var(--bg-muted)',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div
                className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Store size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-heading font-bold text-[color:var(--text-primary)]">
                    Locales solo para retiro en local
                  </h3>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {filteredRestaurants.length} {filteredRestaurants.length === 1 ? 'local' : 'locales'}
                  </span>
                </div>
                <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">
                  Estos locales ofrecen una experiencia 100% pickup: pide desde la app y retira tu pedido directamente en el mostrador. No se procesan entregas a domicilio desde aquí.
                </p>
              </div>
              {/* Botón para volver al filtro de domicilios — atajo visual */}
              <button
                type="button"
                onClick={() => handleChangeDomicilioFilter('con_domicilio')}
                className="btn btn-primary self-stretch sm:self-auto inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold whitespace-nowrap"
              >
                <Truck size={16} />
                Ver con domicilios
              </button>
            </div>
          </div>
        )}

        {/* Banner contextual de nicho: refuerza visualmente la selección
            del toggle exclusivo de tipo de negocio. Aparece solo cuando
            el usuario eligió un nicho específico; con 'todos' se omite para
            no repetir la propuesta general del feed. Lo mostramos aunque NO
            haya resultados — el banner explica por qué. */}
        {tipoNegocioFilter !== 'todos' && (
          <div
            key={`banner-nicho-${tipoNegocioFilter}`}
            className="mb-8 sm:mb-10 md:mb-12 rounded-2xl overflow-hidden border-2 border-dashed filter-banner"
            style={{
              backgroundColor:
                tipoNegocioFilter === 'mercado'
                  ? 'var(--success-bg)'
                  : tipoNegocioFilter === 'comida_rapida'
                    ? 'var(--warning-bg)'
                    : tipoNegocioFilter === 'panaderia_pasteleria'
                      ? 'var(--info-bg)'
                      : 'var(--bg-muted)',
              borderColor:
                tipoNegocioFilter === 'mercado'
                  ? 'var(--success-border)'
                  : tipoNegocioFilter === 'comida_rapida'
                    ? 'var(--warning-border)' // amber — filetea el banner del nicho rápido
                    : tipoNegocioFilter === 'panaderia_pasteleria'
                      ? 'var(--info-border)'
                      : 'var(--border-default)',
            }}
          >
            <div className="px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div
                className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color:
                    tipoNegocioFilter === 'mercado'
                      ? 'var(--success-text)'
                      : tipoNegocioFilter === 'comida_rapida'
                        ? 'var(--warning-text)' // amber-700/800
                        : tipoNegocioFilter === 'panaderia_pasteleria'
                          ? 'var(--info-text)'
                          : 'var(--text-secondary)',
                }}
              >
                {tipoNegocioFilter === 'mercado' ? (
                  <ShoppingBasket size={28} />
                ) : tipoNegocioFilter === 'comida_rapida' ? (
                  <Zap size={28} />
                ) : tipoNegocioFilter === 'panaderia_pasteleria' ? (
                  <Croissant size={28} />
                ) : (
                  <UtensilsCrossed size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-heading font-bold text-[color:var(--text-primary)]">
                    {tipoNegocioFilter === 'mercado'
                      ? 'Mercados y abarrotes cerca de ti'
                      : tipoNegocioFilter === 'comida_rapida'
                        ? 'Comida rápida cerca de ti'
                        : tipoNegocioFilter === 'panaderia_pasteleria'
                          ? 'Panaderías y pastelerías cerca de ti'
                          : 'Restaurantes cerca de ti'}
                  </h3>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color:
                        tipoNegocioFilter === 'mercado'
                          ? 'var(--success-text)'
                          : tipoNegocioFilter === 'comida_rapida'
                            ? 'var(--warning-text)'
                            : tipoNegocioFilter === 'panaderia_pasteleria'
                              ? 'var(--info-text)'
                              : 'var(--text-secondary)',
                      border:
                        tipoNegocioFilter === 'mercado'
                          ? '1px solid var(--success-border)'
                          : tipoNegocioFilter === 'comida_rapida'
                            ? '1px solid var(--warning-border)'
                            : tipoNegocioFilter === 'panaderia_pasteleria'
                              ? '1px solid var(--info-border)'
                              : '1px solid var(--border-default)',
                    }}
                  >
                    {filteredRestaurants.length}{' '}
                    {tipoNegocioFilter === 'mercado'
                      ? (filteredRestaurants.length === 1 ? 'mercado' : 'mercados')
                      : tipoNegocioFilter === 'comida_rapida'
                        ? (filteredRestaurants.length === 1 ? 'local' : 'locales')
                        : tipoNegocioFilter === 'panaderia_pasteleria'
                          ? (filteredRestaurants.length === 1 ? 'local' : 'locales')
                          : (filteredRestaurants.length === 1 ? 'restaurante' : 'restaurantes')}
                  </span>
                </div>
                <p className="text-[color:var(--text-secondary)] text-sm sm:text-base">
                  {tipoNegocioFilter === 'mercado'
                    ? 'Estos locales son de tipo mercado y abarrotes: encuentra productos de despensa, frescos y más. Consulta su catálogo y acércate directamente al local.'
                    : tipoNegocioFilter === 'comida_rapida'
                      ? 'Estos locales son de comida rápida: hamburguesas, perros, pizzas, combos y más. Pedidos listos para entrega a domicilio o retiro en el local.'
                      : tipoNegocioFilter === 'panaderia_pasteleria'
                        ? 'Estos locales son panaderías y pastelerías: panes frescos, tortas, postres y delicias recién hechas. Pide a domicilio o retira en el local.'
                        : 'Estos locales son restaurantes: almuerzos, platos a la carta, comida casera y más. Pide a domicilio o retira en el local.'}
                </p>
              </div>
              {/* Botón para volver a "Todos" — atajo visual */}
              <button
                type="button"
                onClick={() => handleChangeTipoNegocio('todos')}
                className="btn btn-primary self-stretch sm:self-auto inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold whitespace-nowrap"
              >
                Ver todos los locales
              </button>
            </div>
          </div>
        )}

        {/* All Restaurants / Products Section.
            `key` combina `viewMode` + filtros de modalidad/nicho + categoría
            + búsqueda, así React re-monta el bloque y `.filter-header`
            vuelve a dispararse en cada cambio — entrada coherente. */}
        <div
          key={`nuestros-${viewMode}-${domicilioFilter}-${tipoNegocioFilter}-${selectedCategory || 'all'}-${searchTerm || 'empty'}`}
          className="mb-6 sm:mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 filter-header"
        >
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-[color:var(--text-primary)] mb-3 sm:mb-4 tracking-tight">
              {viewMode === 'restaurants' ? 'Nuestros Locales' : 'Nuestros Productos'}
            </h2>
            <div className="w-20 sm:w-24 h-1 bg-gradient-primary rounded-full"></div>
            <p className="mt-4 sm:mt-5 text-[color:var(--text-secondary)] text-base sm:text-lg max-w-2xl">
              {viewMode === 'restaurants'
                ? 'Explora la variedad gastronómica de nuestro pueblo'
                : 'Descubre los platos más populares del pueblo'}
            </p>
          </div>

          {/* View toggle: Restaurantes | Productos */}
          <div className="inline-flex bg-[color:var(--bg-muted)] rounded-full p-1 self-start sm:self-end">
            <button
              key={`view-${viewMode === 'restaurants' ? 'active' : 'inactive'}`}
              type="button"
              onClick={() => handleChangeView('restaurants')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
                viewMode === 'restaurants'
                  ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <Store size={16} />
              Locales
            </button>
            <button
              key={`view-${viewMode === 'products' ? 'active' : 'inactive'}`}
              type="button"
              onClick={() => handleChangeView('products')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
                viewMode === 'products'
                  ? 'bg-[color:var(--bg-elevated)] text-primary shadow filter-pill-active'
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
          <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0" data-tour="home-categorias">
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
              {categoriasVisibles.map(cat => {
                const isActive = selectedCategory === cat.nombre;
                const Icon = getCategoryIcon(cat.nombre);
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
                    <Icon size={14} className="inline-block mr-1 -mt-0.5" />
                    {cat.nombre}
                  </button>
                );
              })}
              {/* Botón de colapso: solo aparece en la vista 'Todos' cuando
                  el catálogo mezclado supera el límite visible. Al expandir
                  el botón se mueve al final de la lista y permite volver
                  a colapsar. */}
              {showCategoriasCollapse && !categoriasExpanded && (
                <button
                  type="button"
                  onClick={() => setCategoriasExpanded(true)}
                  className="flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 whitespace-nowrap border-2 border-dashed border-primary text-primary hover:bg-primary hover:text-white"
                  aria-label={`Ver ${categoriasOcultasCount} categorías más`}
                >
                  +{categoriasOcultasCount} más
                </button>
              )}
              {showCategoriasCollapse && categoriasExpanded && (
                <button
                  type="button"
                  onClick={() => setCategoriasExpanded(false)}
                  className="flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 whitespace-nowrap border-2 border-dashed border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:border-primary hover:text-primary inline-flex items-center gap-1"
                  aria-label="Mostrar menos categorías"
                >
                  Mostrar menos
                  <ChevronUp size={14} className="-mt-0.5" />
                </button>
              )}
            </div>
            {selectedCategory && (
              <p className="mt-2 text-xs sm:text-sm text-[color:var(--text-muted)] px-4 sm:px-0">
                Mostrando {viewMode === 'restaurants' ? 'locales' : 'productos'} con{' '}
                <strong className="text-[color:var(--text-primary)]">{selectedCategory}</strong>


              </p>
            )}
          </div>
        )}

        {/* Vista: Restaurantes.
            - `key` combina viewMode + filtros + búsqueda + categoría: cuando
              cambia, React desmonta y remonta el bloque, lo que re-dispara
              `.filter-grid > *` con su stagger (entrada escalonada).
            - El wrapper ya no usa un overlay opaco brusco: ahora hace
              crossfade con `.filter-fade` y deja un spinner pequeño en
              la esquina para feedback de carga sin tapar contenido. */}
        {viewMode === 'restaurants' && (
          <>
            {/* Manual contextual — Capa 1 para clientes: tips simples
                que enseñan a pedir. Aparecen arriba del listado.
                  - como_buscar:        siempre (es la acción #1)
                  - badge_abierto:      solo si hay ≥1 local
                  - filtros_nicho:      solo si hay más de 1 nicho con locales
                El tip "minimo_domicilio" lo agregaremos en otro commit
                (debe vivir en RestaurantDetailsPage donde aparece el
                "Pedido mínimo" del local). */}
            {isAuthenticated && user?.tipo_usuario === 'cliente' && (
              <>
                <OnboardingTip
                  tipKey="como_buscar"
                  title="¿Cómo busco un local o un plato?"
                  steps={[
                    'Escribe en el buscador de arriba (ej: "pizza", "hamburguesa")',
                    'La lista se actualiza mientras escribes',
                    'Toca una categoría de las que aparecen abajo del buscador',
                    'O usa los filtros para ver solo un tipo de local',
                  ]}
                />
                {filteredRestaurants.length > 0 && (
                  <OnboardingTip
                    tipKey="badge_abierto_cerrado"
                    title="Abierto o cerrado"
                    steps={[
                      'El punto verde a la izquierda significa que el local está abierto',
                      'El rojo significa que está cerrado — no podrás pedir',
                      'Los locales cerrados aparecen atenuados en la lista',
                      'Si un local está cerrado, espera a que abra o elige otro',
                    ]}
                  />
                )}
              </>
            )}
            {filteredRestaurants.length === 0 ? (
            <div
              key={`empty-rest-${tipoNegocioFilter}-${domicilioFilter}-${selectedCategory || 'all'}-${searchTerm || 'empty'}`}
              className="filter-fade"
            >
              <div className="text-center py-16 sm:py-20 max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[color:var(--bg-muted)] text-[color:var(--text-muted)] mb-6">
                <Store size={40} className="opacity-60" />
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-[color:var(--text-primary)] mb-3">
                {searchTerm
                  ? 'No se encontraron locales'
                  : selectedCategory
                    ? `No hay locales con ${selectedCategory}`
                    : tipoNegocioFilter === 'mercado'
                      ? 'Aún no hay mercados y abarrotes registrados'
                      : tipoNegocioFilter === 'comida_rapida'
                        ? 'Aún no hay locales de comida rápida registrados'
                        : tipoNegocioFilter === 'panaderia_pasteleria'
                          ? 'Aún no hay panaderías o pastelerías registradas'
                          : domicilioFilter === 'sin_domicilio'
                            ? 'Aún no hay locales con modalidad solo retiro en local'
                            : 'No hay locales disponibles'}
              </h3>
              <p className="text-[color:var(--text-secondary)] text-sm sm:text-base mb-6 leading-relaxed">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : selectedCategory
                    ? 'Prueba con otra categoría'
                    : tipoNegocioFilter === 'mercado'
                      ? 'Vuelve pronto, o explora el resto de locales disponibles.'
                      : tipoNegocioFilter === 'comida_rapida'
                        ? 'Vuelve pronto, o explora el resto de locales disponibles.'
                        : tipoNegocioFilter === 'panaderia_pasteleria'
                          ? 'Vuelve pronto, o explora el resto de locales disponibles.'
                          : domicilioFilter === 'sin_domicilio'
                            ? 'Vuelve pronto, o explora los locales con domicilios.'
                            : 'Vuelve pronto para más opciones'}
              </p>
              {domicilioFilter === 'sin_domicilio' && !searchTerm && !selectedCategory && (
                <button
                  type="button"
                  onClick={() => handleChangeDomicilioFilter('con_domicilio')}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Truck size={16} />
                  Ver locales con domicilios
                </button>
              )}
              {(tipoNegocioFilter === 'mercado' || tipoNegocioFilter === 'comida_rapida' || tipoNegocioFilter === 'panaderia_pasteleria') && !searchTerm && !selectedCategory && (
                <button
                  type="button"
                  onClick={() => handleChangeTipoNegocio('todos')}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  {tipoNegocioFilter === 'mercado'
                    ? <ShoppingBasket size={16} />
                    : tipoNegocioFilter === 'comida_rapida'
                      ? <Zap size={16} />
                      : <Croissant size={16} />}
                  Ver todos los locales
                </button>
              )}
              {selectedCategory && !searchTerm && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="btn btn-outline inline-flex items-center gap-2"
                >
                  Ver todos los locales
                </button>
              )}
            </div>
            </div>
          ) : (
            <div
              key={`grid-rest-${tipoNegocioFilter}-${domicilioFilter}-${selectedCategory || 'all'}-${searchTerm || 'empty'}`}
              className="relative"
            >
              {/* Crossfade sutil durante refetch: opacidad baja + spinner pequeño
                  en la esquina (no overlay opaco que tapa el contenido). */}
              <div
                className={`relative transition-opacity duration-200 ${
                  filtering ? 'opacity-70 pointer-events-none' : 'opacity-100'
                }`}
              >
                {filtering && (
                  <div className="absolute top-3 right-3 z-10 spinner border-[3px] border-primary border-t-transparent rounded-full w-7 h-7 animate-spin" aria-label="Actualizando resultados" />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 filter-grid">
                  {filteredRestaurants.map((restaurant, index) => (
                    <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
                  ))}
                </div>
              </div>
            </div>
          )
          }
        </>
        )}

        {/* Vista: Productos */}
        {viewMode === 'products' && (
          filteredProductos.length === 0 ? (
            <div
              key={`empty-prod-${tipoNegocioFilter}-${domicilioFilter}-${selectedCategory || 'all'}-${searchTerm || 'empty'}`}
              className="filter-fade"
            >
              <div className="text-center py-16 sm:py-20 max-w-md mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[color:var(--bg-muted)] text-[color:var(--text-muted)] mb-6">
                  <Utensils size={40} className="opacity-60" />
                </div>
                <h3 className="text-xl sm:text-2xl font-heading font-bold text-[color:var(--text-primary)] mb-3">
                  {searchTerm
                    ? 'No se encontraron productos'
                    : selectedCategory
                      ? `No hay productos con ${selectedCategory}`
                      : 'No hay productos disponibles'}
                </h3>
                <p className="text-[color:var(--text-secondary)] text-sm sm:text-base mb-6 leading-relaxed">
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
                    className="btn btn-outline inline-flex items-center gap-2"
                  >
                    Ver todos los productos
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              key={`grid-prod-${tipoNegocioFilter}-${domicilioFilter}-${selectedCategory || 'all'}-${searchTerm || 'empty'}`}
              className="relative"
            >
              <div
                className={`relative transition-opacity duration-200 ${
                  filtering ? 'opacity-70 pointer-events-none' : 'opacity-100'
                }`}
              >
                {filtering && (
                  <div className="absolute top-3 right-3 z-10 spinner border-[3px] border-primary border-t-transparent rounded-full w-7 h-7 animate-spin" aria-label="Actualizando resultados" />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 filter-grid">
                  {filteredProductos.map((producto, index) => (
                    <ProductCard key={producto.id} product={producto} index={index} />
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </section>

      {/* Info Section */}
      <section className="bg-[color:var(--bg-subtle)] py-14 sm:py-16 md:py-20 lg:py-28 px-4 mt-12 sm:mt-16 border-t border-[color:var(--border-subtle)]">
        <div className="max-w-7xl mx-auto">
          {/* CTA Section */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-xs sm:text-sm mb-5 sm:mb-6">
              <Store size={14} />
              Para locales
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-[color:var(--text-primary)] mb-4 sm:mb-5 tracking-tight">
              ¿Tienes un local?
            </h2>
            <div className="w-20 sm:w-24 h-1 bg-gradient-primary rounded-full mx-auto mb-5 sm:mb-6"></div>
            <p className="text-[color:var(--text-secondary)] text-base sm:text-lg md:text-xl mb-8 sm:mb-10 leading-relaxed px-4">
              Únete a nuestra plataforma y aumenta tus ventas.
              <br className="hidden sm:block" />
              <span className="font-semibold text-[color:var(--text-primary)]">Contáctanos ahora</span> para empezar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <a href="https://wa.me/message/VBWBXJXVGJIHP1" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg min-h-[48px] inline-flex items-center justify-center gap-2">
                Contactar Ventas
                <ArrowRight size={18} />
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
