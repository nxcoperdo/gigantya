import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark text-gray-100 mt-16">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-4xl">🍽️</span>
              <h3 className="font-heading font-bold text-2xl text-white">Gigantya</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              La mejor plataforma de pedidos online para restaurantes en Gigantá, Huila.
            </p>
            {/* Social Media */}
            <div className="flex gap-3">
              <a href="#" className="text-gray-400 hover:text-primary transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <Facebook size={18} />
              </a>
              <a href="#" className="text-gray-400 hover:text-primary transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <Instagram size={18} />
              </a>
              <a href="#" className="text-gray-400 hover:text-primary transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <Twitter size={18} />
              </a>
            </div>
          </div>

          {/* Clientes */}
          <div>
            <h4 className="font-heading font-semibold text-lg text-white mb-6">Para Clientes</h4>
            <ul className="text-gray-400 text-sm space-y-3">
              <li>
                <Link to="/" className="hover:text-primary transition-colors font-light">
                  → Ver Restaurantes
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-primary transition-colors font-light">
                  → Registrarse
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Mi Perfil
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Mis Pedidos
                </a>
              </li>
            </ul>
          </div>

          {/* Restaurantes */}
          <div>
            <h4 className="font-heading font-semibold text-lg text-white mb-6">Para Restaurantes</h4>
            <ul className="text-gray-400 text-sm space-y-3">
              <li>
                <a href="mailto:info@gigantya.com" className="hover:text-primary transition-colors font-light">
                  → Contactar
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Tarifas
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Documentación
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading font-semibold text-lg text-white mb-6">Legal</h4>
            <ul className="text-gray-400 text-sm space-y-3">
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Términos de Servicio
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Política de Privacidad
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Cookies
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light">
                  → Reportar Abuso
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-lg text-white mb-6">Contacto</h4>
            <div className="space-y-4 text-sm text-gray-400">
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <a href="mailto:info@gigantya.com" className="hover:text-primary transition-colors font-light">
                  info@gigantya.com
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <a href="tel:+573001234567" className="hover:text-primary transition-colors font-light">
                  +57 300 1234 567
                </a>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <span className="font-light">
                  Gigantá, Huila<br />Colombia 🇨🇴
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm gap-4">
            <p className="font-light">
              &copy; {currentYear} <span className="font-semibold text-primary">Gigantya</span>. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-primary font-semibold">📍</span>
              <span className="font-light">Gigantá, Huila - Colombia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gradient-primary text-white text-center py-4 text-sm font-light">
        Hecho con <span className="text-white">❤️</span> para la comunidad de Gigantá
      </div>
    </footer>
  );
}

