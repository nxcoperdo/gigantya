import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X, ShoppingCart, User, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { notificationService } from '../services/api';
import NotificationBadge from './NotificationBadge';
import NotificationCenter from './NotificationCenter';
import NotificationAlertModal from './NotificationAlertModal';
import { playNotificationSound, resumeAudioContext } from '../utils/notificationSound';

// Componente memoizado: solo se re-renderiza si cambian sus props
const Header = memo(function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // Handlers memoizados para evitar re-renders innecesarios en hijos
  const closeNotificationAlert = useCallback(() => {
    if (notificationAlertTimerRef.current) {
      clearTimeout(notificationAlertTimerRef.current);
      notificationAlertTimerRef.current = null;
    }
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    setNotificationAlertOpen(false);
  }, []);

  const stopNotificationAlarm = useCallback(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  }, []);

  const startNotificationAlarm = useCallback(() => {
    if (!alertIntervalRef.current) {
      playNotificationSound();
      alertIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 3500);
    }
  }, []);

  const showNotificationAlert = useCallback((notification, count) => {
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
  }, [startNotificationAlarm]);

  const handleUnreadCountChange = useCallback((count) => {
    setUnreadCount(count);
    if (count < previousUnreadCountRef.current) {
      previousUnreadCountRef.current = count;
    }
    if (count === 0) {
      closeNotificationAlert();
    }
  }, [closeNotificationAlert]);

  // Polling de notificaciones - separado para que no afecte al resto del Header
  useEffect(() => {
    if (!isAuthenticated) {
      initialLoadRef.current = true;
      previousUnreadCountRef.current = 0;
      lastAlertedNotificationIdRef.current = null;
      closeNotificationAlert();
      return;
    }

    let cancelled = false;

    const updateUnreadCount = async () => {
      if (cancelled) return;
      try {
        const res = await notificationService.getNotifications();
        if (cancelled) return;
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

    updateUnreadCount();
    // Polling cada 15s (reducido de 10s para menos carga)
    const interval = setInterval(updateUnreadCount, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, showNotificationAlert, closeNotificationAlert]);

  // Resume audio context on first user interaction (autoplay policy)
  useEffect(() => {
    const resume = () => resumeAudioContext();
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);

  const handleLogout = useCallback(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  }, [logout, navigate]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const toggleNotif = useCallback(() => {
    setNotifOpen(prev => !prev);
  }, []);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen(prev => !prev);
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-50 safe-top border-b border-[color:var(--border-subtle)] backdrop-blur-md"
        style={{
          // CSS var pública: la consumen MobileMenuNav, MobileCartBar y
          // cualquier sticky-nav hijo para posicionarse justo debajo del
          // header sin hardcodear. 60px mobile / 72px desktop (md:py-4).
          // En iOS con notch el header es ~30px más alto por safe-area,
          // pero el `safe-top` agrega padding INTERNO, no afecta la altura
          // "anunciada" hacia abajo. Si en testing se ve solapado,
          // cambiar a 'calc(60px + env(safe-area-inset-top))'.
          '--header-height': '60px',
          backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 85%, transparent)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.02), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity active:scale-95 touch-feedback">
            <img src="/favicon.jpg" alt="GigantYa" className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover shadow-sm ring-1 ring-black/5" />
            <span className="text-lg md:text-xl lg:text-2xl font-heading font-extrabold text-[color:var(--text-primary)] tracking-tight">GigantYa</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-6 lg:gap-8 items-center">
            {!isAuthenticated ? (
              <>
                <Link to="/" className="text-[color:var(--text-secondary)] hover:text-primary font-medium transition-colors">
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
                   <Link to="/" className="text-[color:var(--text-secondary)] hover:text-primary font-medium transition-colors">
                     Locales
                   </Link>
                 )}

                 {user?.tipo_usuario === 'cliente' && (
                  <Link to="/orders" className="text-[color:var(--text-secondary)] hover:text-primary font-medium transition-colors">
                    Mis Pedidos
                  </Link>
                )}

                {user?.tipo_usuario === 'restaurante' && (
                  <Link to="/dashboard" className="text-[color:var(--text-secondary)] hover:text-primary font-medium transition-colors">
                    Dashboard
                  </Link>
                )}

                {user?.tipo_usuario === 'admin' && (
                  <Link to="/admin" className="text-[color:var(--text-secondary)] hover:text-primary font-medium transition-colors">
                    Admin
                  </Link>
                )}

                {/* Carrito icono */}
                {user?.tipo_usuario === 'cliente' && (
                  <Link to="/cart" className="relative p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors text-[color:var(--text-secondary)] hover:text-primary">
                    <ShoppingCart size={20} />
                  </Link>
                )}

                {/* Campana de notificaciones */}
                <div className="relative">
                  <button
                    onClick={toggleNotif}
                    className={`p-2 rounded-full hover:bg-[color:var(--bg-muted)] transition-colors relative text-[color:var(--text-secondary)] hover:text-primary active:scale-95 touch-feedback ${notifOpen ? 'bg-[color:var(--bg-muted)]' : ''}`}
                    aria-label="Notificaciones"
                  >
                    <Bell size={20} />
                    <NotificationBadge count={unreadCount} />
                  </button>
                </div>

                {/* Toggle claro/oscuro */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-[color:var(--bg-muted)] transition-colors text-[color:var(--text-secondary)] hover:text-primary active:scale-95 touch-feedback"
                  aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Dropdown de usuario */}
                <div className="relative">
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[color:var(--bg-muted)] transition-colors active:scale-95 touch-feedback"
                    aria-expanded={dropdownOpen}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center ring-1 ring-primary/15">
                      <User size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-[color:var(--text-secondary)] max-w-[120px] lg:max-w-[150px] truncate">{user?.nombre}</span>
                    <svg className={`w-3 h-3 text-[color:var(--text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-[color:var(--bg-elevated)] shadow-xl rounded-xl py-2 border border-[color:var(--border-subtle)] z-20 animate-scaleIn origin-top-right">
                        <Link
                          to="/profile"
                          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] transition-colors rounded-md mx-1"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <User size={16} />
                          Mi Perfil
                        </Link>
                        <button
                          type="button"
                          onClick={() => { toggleTheme(); setDropdownOpen(false); }}
                          className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] transition-colors rounded-md mx-1"
                        >
                          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                        </button>
                        <div className="border-t border-[color:var(--border-subtle)] my-1 mx-2" />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 font-medium transition-colors flex items-center gap-2.5 mx-1 rounded-md"
                          style={{ color: 'var(--danger-text)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
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
            className="md:hidden p-2.5 hover:bg-[color:var(--bg-muted)] rounded-xl transition-colors active:scale-95 touch-feedback"
            onClick={toggleMobileMenu}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <nav className="md:hidden fixed top-[60px] left-0 right-0 bg-[color:var(--bg-elevated)] shadow-xl border-t border-[color:var(--border-subtle)] px-4 py-4 flex flex-col gap-2 z-40 animate-slideDown max-h-[calc(100vh-60px)] overflow-y-auto">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/"
                    className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
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
                       className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                       onClick={() => setMobileMenuOpen(false)}
                     >
                       🏪 Locales
                     </Link>
                   )}
                   {user?.tipo_usuario === 'cliente' && (
                    <>
                      <Link
                        to="/cart"
                        className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg flex items-center gap-3 active:scale-95 touch-feedback"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <ShoppingCart size={18} />
                        Mi Carrito
                      </Link>
                      <Link
                        to="/orders"
                        className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        📦 Mis Pedidos
                      </Link>
                    </>
                  )}
                  {user?.tipo_usuario === 'restaurante' && (
                    <Link
                      to="/dashboard"
                      className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      📊 Dashboard
                    </Link>
                  )}
                  {user?.tipo_usuario === 'admin' && (
                    <Link
                      to="/admin"
                      className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      ⚙️ Admin
                    </Link>
                  )}
                  <div className="border-t border-[color:var(--border-subtle)] my-2" />
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); setNotifOpen(true); }}
                    className="text-[color:var(--text-secondary)] font-medium text-left py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback flex items-center gap-3"
                    aria-label="Notificaciones"
                  >
                    <span className="relative">
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
                    Notificaciones
                    {unreadCount > 0 && (
                      <span className="ml-auto text-xs font-bold text-primary">
                        {unreadCount > 99 ? '99+' : unreadCount} nueva{unreadCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
                    className="text-[color:var(--text-secondary)] font-medium text-left py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg active:scale-95 touch-feedback flex items-center gap-3"
                    aria-label="Cambiar tema"
                  >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                  <Link
                    to="/profile"
                    className="text-[color:var(--text-secondary)] font-medium py-3 px-4 hover:bg-[color:var(--bg-muted)] hover:text-primary transition-colors rounded-lg flex items-center gap-3 active:scale-95 touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User size={16} className="text-primary" />
                    </div>
                    Mi Perfil
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="font-medium text-left py-3 px-4 transition-colors rounded-lg active:scale-95 touch-feedback flex items-center gap-3"
                    style={{ color: 'var(--danger-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
        onNotificationArrived={showNotificationAlert}
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
});

export default Header;
