import { useNavigate } from 'react-router-dom';
import { X, LogIn, UserPlus, Lock } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleRegister = () => {
    onClose();
    navigate('/register');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      {/* Modal */}
      <div className="bg-[color:var(--bg-elevated)] rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-primary text-white px-6 py-8 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-2 right-4 text-4xl opacity-20">🍽️</div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <Lock className="text-white" size={28} />
              <h2 className="text-2xl font-bold font-heading">
                Acceso Requerido
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 transition-all p-2 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Message */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-[color:var(--text-primary)] mb-3 text-center">
              ¡Oops! Necesitas autenticarte
            </h3>
            <p className="text-[color:var(--text-secondary)] text-base leading-relaxed text-center">
              Para explorar menús y hacer pedidos, debes iniciar sesión o crear una cuenta primero. ¡Es rápido y fácil!
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            {/* Login Button */}
            <button
              onClick={handleLogin}
              className="w-full bg-primary hover:bg-primaryDark text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-300 transform hover:shadow-lg hover:-translate-y-0.5"
            >
              <LogIn size={20} />
              Iniciar Sesión
            </button>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              className="w-full bg-[color:var(--bg-subtle)] border-2 border-primary text-primary hover:bg-primaryLight font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-300 transform hover:shadow-lg hover:-translate-y-0.5"
            >
              <UserPlus size={20} />
              Registrarse
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
            <span className="text-[color:var(--text-muted)] text-sm">o</span>
            <div className="flex-1 h-px bg-[color:var(--border-default)]"></div>
          </div>

          {/* Secondary action */}
          <p className="text-center text-[color:var(--text-secondary)] text-sm">
            ¿Ya tienes cuenta?{' '}
            <button
              onClick={handleLogin}
              className="text-primary font-bold hover:underline transition-all"
            >
              Inicia sesión aquí
            </button>
          </p>
        </div>

        {/* Footer info */}
        <div className="bg-[color:var(--bg-subtle)] px-8 py-4 border-t border-[color:var(--border-subtle)]">
          <p className="text-xs text-[color:var(--text-muted)] text-center">
            Tus datos son seguros con nosotros. Protegido con encriptación SSL.
          </p>
        </div>
      </div>
    </div>
  );
}

