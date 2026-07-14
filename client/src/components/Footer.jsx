import { Facebook, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[color:var(--bg-inverted)] text-[color:var(--text-on-inverted)] mt-16">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-2xl">
                🍽️
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-[color:var(--text-on-inverted)] tracking-tight">GigantYA</h3>
            </div>
            <p className="text-[color:var(--text-muted)] text-sm leading-relaxed mb-6">
              La mejor plataforma de pedidos online para locales en Gigante, Huila.
            </p>
            {/* Social Media */}
            <div className="flex gap-2">
              <a
                href="https://web.facebook.com/gigantya/?_rdc=1&_rdr#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-[color:var(--text-muted)] hover:text-primary hover:bg-[color:var(--bg-base)] transition-all p-2.5 rounded-lg"
              >
                <Facebook size={18} />
              </a>
            </div>
          </div>

          {/* Clientes */}
          <div>
            <h4 className="font-heading font-bold text-base text-[color:var(--text-on-inverted)] mb-5 tracking-wide">Para Clientes</h4>
            <ul className="text-[color:var(--text-muted)] text-sm space-y-3">
              <li>
                <Link to="/" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Ver Locales
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Registrarse
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Mi Perfil
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Mis Pedidos
                </a>
              </li>
            </ul>
          </div>

          {/* Restaurantes */}
          <div>
            <h4 className="font-heading font-bold text-base text-[color:var(--text-on-inverted)] mb-5 tracking-wide">Para Locales</h4>
            <ul className="text-[color:var(--text-muted)] text-sm space-y-3">
              <li>
                <a href="mailto:coderepairtech@gmail.com" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Contactar
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Dashboard
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading font-bold text-base text-[color:var(--text-on-inverted)] mb-5 tracking-wide">Legal</h4>
            <ul className="text-[color:var(--text-muted)] text-sm space-y-3">
              <li>
                <Link to="/terminos" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/privacidad" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link to="/legal/restaurante" className="hover:text-primary transition-colors font-light inline-flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  Acuerdo para Locales
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-bold text-base text-[color:var(--text-on-inverted)] mb-5 tracking-wide">Contacto</h4>
            <div className="space-y-4 text-sm text-[color:var(--text-muted)]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail size={14} className="text-primary" />
                </div>
                <a href="mailto:coderepairtech@gmail.com" className="hover:text-primary transition-colors font-light pt-1 break-all">
                    coderepairtech@gmail.com
                </a>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone size={14} className="text-primary" />
                </div>
                <a href="tel:+573115320211" className="hover:text-primary transition-colors font-light pt-1">
                  +57 311 532 0211
                </a>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={14} className="text-[#25D366]" />
                </div>
                <a
                  href="https://wa.me/573115320211"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#25D366] transition-colors font-light pt-1"
                >
                  WhatsApp · 311 532 0211
                </a>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-primary" />
                </div>
                <span className="font-light pt-1">
                  Gigante, Huila<br />Colombia 🇨🇴
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[color:var(--border-strong)] pt-8">
          <p className="text-[color:var(--text-muted)] text-xs leading-relaxed mb-4 max-w-4xl">
            <strong className="text-[color:var(--text-on-inverted)]">GigantYA es una plataforma tecnológica de intermediación</strong> entre
            usuarios y restaurantes. Los productos son vendidos y entregados directamente por cada
            restaurante, quien es responsable por su calidad, seguridad, contenido y legalidad.
            GigantYA no procesa los pagos entre el usuario y el restaurante; la transacción se
            realiza directamente entre ambos.{' '}
            <Link to="/terminos" className="text-primary underline">Ver Términos completos</Link>.
          </p>
          <div className="flex flex-col md:flex-row justify-between items-center text-[color:var(--text-muted)] text-sm gap-4">
            <p className="font-light">
              &copy; {currentYear} <span className="font-bold text-primary">GigantYA</span>. Todos los derechos reservados para Code Repair Tech
            </p>
            <div className="flex items-center gap-2">
              <span className="text-primary font-semibold">📍</span>
              <span className="font-light">Gigante, Huila - Colombia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gradient-primary text-white text-center py-4 text-sm font-light">
        Hecho con <span className="text-white">❤️</span> para la comunidad de Gigante
      </div>
    </footer>
  );
}

