import { Menu, X, ShoppingCart, User, Bell } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBadge from './NotificationBadge';
import NotificationCenter from './NotificationCenter';
import NotificationAlertModal from './NotificationAlertModal';
import { playNotificationSound, resumeAudioContext } from '../utils/notificationSound';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationAlertOpen, setNotificationAlertOpen] = useState(false);
  const [notificationAlertData, setNotificationAlertData] = useState({
    title: 'Nueva notificación',
    message: 'Tienes una notificación nueva.',
    count: 1,
  });
  const navigate = useNavigate();

  const initialLoadRef = useRef(true);
  const alertIntervalRef = useRef(null);
  const notificationAlertTimerRef = useRef(null);
  const previousUnreadCountRef = useRef(0);
  const lastAlertedNotificationIdRef = useRef(null);

  const closeNotificationAlert = () => {
    // Detener cualquier alarma y cerrar la alerta manualmente
    if (notificationAlertTimerRef.current) {
      clearTimeout(notificationAlertTimerRef.current);
      notificationAlertTimerRef.current = null;
    }
    stopNotificationAlarm();
    setNotificationAlertOpen(false);
  };

  const stopNotificationAlarm = () => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  };

  const startNotificationAlarm = () => {
    if (!alertIntervalRef.current) {
      playNotificationSound();
      alertIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 3500);
    }
  };

  const showNotificationAlert = (notification, count) => {
    const latestId = notification?.id ?? null;
    if (latestId && lastAlertedNotificationIdRef.current === latestId) return;

    lastAlertedNotificationIdRef.current = latestId;
    setNotificationAlertData({
      title: notification?.titulo || 'Nueva notificación',
      message: notification?.mensaje || 'Tienes una notificación nueva.',
      count: Math.max(1, count || 1),
    });
    setNotificationAlertOpen(true);
    startNotificationAlarm();
  };

  const handleUnreadCountChange = (count) => {
    setUnreadCount(count);

    if (count < previousUnreadCountRef.current) {
      previousUnreadCountRef.current = count;
    }

    if (count === 0) {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
      closeNotificationAlert();
    }
  };

  const updateUnreadCount = async () => {
    try {
      const { notificationService } = await import('../services/api');
      const res = await notificationService.getNotifications();
      const latestNotification = res.data?.[0];
      const newCount = res.data.filter(n => n.leido === 0).length;

      if (!initialLoadRef.current && newCount > previousUnreadCountRef.current) {
        showNotificationAlert(latestNotification, newCount);
      }

      previousUnreadCountRef.current = newCount;
      initialLoadRef.current = false;
      setUnreadCount(newCount);
    } catch (e) {
      console.error('Error updating unread count:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      updateUnreadCount();
      const interval = setInterval(updateUnreadCount, 10000);
      return () => clearInterval(interval);
    }

    initialLoadRef.current = true;
    previousUnreadCountRef.current = 0;
    lastAlertedNotificationIdRef.current = null;
    closeNotificationAlert();
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  }, [isAuthenticated]);


  // Resume audio context on first user interaction (autoplay policy)
  useEffect(() => {
    const resume = () => {
      resumeAudioContext();
    };
    // Listen to multiple interaction types for better reliability
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);

  const handleLogout = () => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white shadow-soft sticky top-0 z-50 backdrop-blur-sm bg-opacity-98">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95 touch-feedback">
            <div className="text-2xl md:text-3xl">🍽️</div>
            <span className="text-lg md:text-xl lg:text-2xl font-heading font-bold text-dark">GigantYa</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-6 lg:gap-8 items-center">
            {!isAuthenticated ? (
              <>
                <Link to="/" className="text-gray-600 hover:text-primary font-medium transition-colors">
                  Inicio
                </Link>
                <Link to="/login" className="btn btn-outline btn-small">
                  Ingresar
                </Link>
                <Link to="/register" className="btn btn-primary btn-small">
                  Registrarse
                </Link>
              </>
             ) : (
               <>
                 {user?.tipo_usuario === 'cliente' && (
                   <Link to="/" className="text-gray-600 hover:text-primary font-medium transition-colors">
                     Restaurantes
                   </Link>
                 )}

                 {user?.tipo_usuario === 'cliente' && (
                  <>
                    <Link to="/orders" className="text-gray-600 hover:text-primary font-medium transition-colors">
                      Mis Pedidos
                    </Link>
                  </>
                )}

                {user?.tipo_usuario === 'restaurante' && (
                  <Link to="/dashboard" className="text-gray-600 hover:text-primary font-medium transition-colors">
                    Dashboard
                  </Link>
                )}

                {user?.tipo_usuario === 'admin' && (
                  <Link to="/admin" className="text-gray-600 hover:text-primary font-medium transition-colors">
                    Admin
                  </Link>
                )}

                {/* Carrito icono */}
                {user?.tipo_usuario === 'cliente' && (
                  <Link to="/cart" className="relative p-2 hover:bg-light rounded-full transition-colors text-gray-600 hover:text-primary">
                    <ShoppingCart size={20} />
                  </Link>
                )}

                {/* Campana de notificaciones */}
                <div className="relative">
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className={`p-2 rounded-full hover:bg-light transition-colors relative text-gray-600 hover:text-primary active:scale-95 touch-feedback ${notifOpen ? 'bg-light' : ''}`}
                    aria-label="Notificaciones"
                  >
                    <Bell size={20} />
                    <NotificationBadge count={unreadCount} />
                  </button>
                </div>

                {/* Dropdown de usuario */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-light transition-colors active:scale-95 touch-feedback"
                    aria-expanded={dropdownOpen}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-[120px] lg:max-w-[150px] truncate">{user?.nombre}</span>
                  </button>

                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white shadow-xl rounded-xl py-1.5 border border-gray-100 z-20 animate-scaleIn">
                        <Link
                          to="/profile"
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-light text-gray-700 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <User size={16} />
                          Mi Perfil
                        </Link>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-medium transition-colors flex items-center gap-2"
                        >
                          Cerrar Sesión
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2.5 hover:bg-light rounded-xl transition-colors active:scale-95 touch-feedback"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <nav className="md:hidden fixed top-[60px] left-0 right-0 bg-white shadow-xl border-t border-gray-100 px-4 py-4 flex flex-col gap-2 z-40 animate-slideDown max-h-[calc(100vh-60px)] overflow-y-auto">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/"
                    className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Inicio
                  </Link>
                  <div className="flex gap-2 mt-2">
                    <Link to="/login" className="btn btn-outline btn-small flex-1" onClick={() => setMobileMenuOpen(false)}>
                      Ingresar
                    </Link>
                    <Link to="/register" className="btn btn-primary btn-small flex-1" onClick={() => setMobileMenuOpen(false)}>
                      Registrarse
                    </Link>
                  </div>
                </>
               ) : (
                 <>
                   {user?.tipo_usuario === 'cliente' && (
                     <Link
                       to="/"
                       className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                       onClick={() => setMobileMenuOpen(false)}
                     >
                       🏪 Restaurantes
                     </Link>
                   )}
                   {user?.tipo_usuario === 'cliente' && (
                    <>
                      <Link
                        to="/cart"
                        className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg flex items-center gap-3 active:scale-95 touch-feedback"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <ShoppingCart size={18} />
                        Mi Carrito
                      </Link>
                      <Link
                        to="/orders"
                        className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        📦 Mis Pedidos
                      </Link>
                    </>
                  )}
                  {user?.tipo_usuario === 'restaurante' && (
                    <Link
                      to="/dashboard"
                      className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      📊 Dashboard
                    </Link>
                  )}
                  {user?.tipo_usuario === 'admin' && (
                    <Link
                      to="/admin"
                      className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      ⚙️ Admin
                    </Link>
                  )}
                  <div className="border-t border-gray-100 my-2" />
                  <Link
                    to="/profile"
                    className="text-gray-700 font-medium py-3 px-4 hover:bg-light hover:text-primary transition-colors rounded-lg flex items-center gap-3 active:scale-95 touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User size={16} className="text-primary" />
                    </div>
                    Mi Perfil
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-red-600 font-medium text-left py-3 px-4 hover:bg-red-50 transition-colors rounded-lg active:scale-95 touch-feedback flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar Sesión
                  </button>
                </>
              )}
            </nav>
          </>
        )}
      </header>
      <NotificationCenter
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNotificationArrived={(notification, count) => showNotificationAlert(notification, count)}
      />
      <NotificationAlertModal
        isOpen={notificationAlertOpen}
        title={notificationAlertData.title}
        message={notificationAlertData.message}
        count={notificationAlertData.count}
        onClose={closeNotificationAlert}
      />
    </>
  );
}
