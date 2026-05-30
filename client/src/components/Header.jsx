import { Menu, X, ShoppingCart, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-soft sticky top-0 z-50 backdrop-blur-xs bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 md:py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="text-3xl">🍽️</div>
          <span className="text-xl md:text-2xl font-heading font-bold text-dark">Gigantya</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-8 items-center">
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
              <Link to="/" className="text-gray-600 hover:text-primary font-medium transition-colors">
                Restaurantes
              </Link>

              {user?.tipo_usuario === 'cliente' && (
                <>
                  <Link to="/cart" className="text-gray-600 hover:text-primary transition-colors flex items-center gap-1">
                    <ShoppingCart size={18} />
                  </Link>
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

              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-light transition-colors"
                >
                  <User size={18} className="text-primary" />
                  <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">{user?.nombre}</span>
                </button>
                
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-xl py-2 animate-slideDown">
                    <Link
                      to="/profile"
                      className="block px-4 py-2.5 hover:bg-light text-gray-700 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Mi Perfil
                    </Link>
                    <div className="divider m-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-medium transition-colors"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 hover:bg-light rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-light border-t border-gray-100 px-4 py-4 flex flex-col gap-3 animate-slideDown">
          {!isAuthenticated ? (
            <>
              <Link
                to="/"
                className="text-gray-700 font-medium py-2 hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Inicio
              </Link>
              <Link to="/login" className="btn btn-outline btn-small w-full">
                Ingresar
              </Link>
              <Link to="/register" className="btn btn-primary btn-small w-full">
                Registrarse
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                className="text-gray-700 font-medium py-2 hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Restaurantes
              </Link>
              {user?.tipo_usuario === 'cliente' && (
                <>
                  <Link
                    to="/cart"
                    className="text-gray-700 font-medium py-2 hover:text-primary transition-colors flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <ShoppingCart size={18} />
                    Mi Carrito
                  </Link>
                  <Link
                    to="/orders"
                    className="text-gray-700 font-medium py-2 hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Mis Pedidos
                  </Link>
                </>
              )}
              {user?.tipo_usuario === 'restaurante' && (
                <Link
                  to="/dashboard"
                  className="text-gray-700 font-medium py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              {user?.tipo_usuario === 'admin' && (
                <Link
                  to="/admin"
                  className="text-gray-700 font-medium py-2 hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="divider m-2" />
              <Link
                to="/profile"
                className="text-gray-700 font-medium py-2 hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User size={18} />
                Mi Perfil
              </Link>
              <button
                onClick={handleLogout}
                className="text-red-600 font-medium text-left py-2 hover:text-red-700 transition-colors"
              >
                Cerrar Sesión
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}

