import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Loading from './components/Loading';
import CookiesBanner from './components/legal/CookiesBanner';
import LegalGate from './components/legal/LegalGate';
import HelpButton from './components/help/HelpButton';
import ClientHelpButton from './components/help/ClientHelpButton';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import CompleteProfileGate from './components/CompleteProfileGate';
import ShareLinkButton from './components/ShareLinkButton';

// Code splitting: cada página se carga solo cuando se necesita
// Reduce el bundle inicial y mejora el time-to-interactive
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const GoogleOAuthCallbackPage = lazy(() => import('./pages/GoogleOAuthCallbackPage'));
const RestaurantDetailsPage = lazy(() => import('./pages/RestaurantDetailsPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersHistoryPage = lazy(() => import('./pages/OrdersHistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RestaurantDashboardPage = lazy(() => import('./pages/RestaurantDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const HomeMediaPage = lazy(() => import('./pages/admin/HomeMediaPage'));
const HomeHeroPage = lazy(() => import('./pages/admin/HomeHeroPage'));

// Páginas legales (TyC, Privacidad, Cookies, Merchant Agreement)
const TerminosPage = lazy(() => import('./pages/legal/TerminosPage'));
const PrivacidadPage = lazy(() => import('./pages/legal/PrivacidadPage'));
const CookiesPage = lazy(() => import('./pages/legal/CookiesPage'));
const MerchantAgreementPage = lazy(() => import('./pages/legal/MerchantAgreementPage'));

// POS (Fase 1+)
const POSLayout = lazy(() => import('./components/pos/POSLayout'));
const POSHomePage = lazy(() => import('./pages/pos/POSHomePage'));
const StaffPage = lazy(() => import('./pages/pos/StaffPage'));
const FloorPlanPage = lazy(() => import('./pages/pos/FloorPlanPage'));
const TakeOrderPage = lazy(() => import('./pages/pos/TakeOrderPage'));
const KDSPage = lazy(() => import('./pages/pos/KDSPage'));
const CashierPage = lazy(() => import('./pages/pos/CashierPage'));
const CashClosingPage = lazy(() => import('./pages/pos/CashClosingPage'));
const InventoryPage = lazy(() => import('./pages/pos/InventoryPage'));
const ReportsPage = lazy(() => import('./pages/pos/ReportsPage'));
const ConfigPage = lazy(() => import('./pages/pos/ConfigPage'));
const OrdersListPage = lazy(() => import('./pages/pos/OrdersListPage'));
const POSComingSoon = lazy(() => import('./pages/pos/POSComingSoon'));

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <ScrollToTop />
            <div className="flex flex-col min-h-screen">
              <Header />

              <main className="flex-1">
                <Suspense fallback={<Loading />}>
                  <Routes>
                  {/* Rutas Públicas */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/auth/google/callback" element={<GoogleOAuthCallbackPage />} />

                  {/* Rutas Cliente */}
                  {/* Página del local: PÚBLICA (para que el dueño comparta el
                      enlace con sus clientes). Se puede ver el menú sin login;
                      el login se pide recién al pagar (/cart y /checkout siguen
                      protegidos). */}
                  <Route path="/restaurant/:id" element={<RestaurantDetailsPage />} />
                  <Route
                    path="/cart"
                    element={
                      <ProtectedRoute requiredRole="cliente">
                        <CartPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute requiredRole="cliente">
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute requiredRole="cliente">
                        <OrdersHistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute requiredRole="restaurante">
                        <RestaurantDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/home-media"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <HomeMediaPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/home-hero"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <HomeHeroPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Páginas legales (públicas, sin auth) */}
                  <Route path="/terminos" element={<TerminosPage />} />
                  <Route path="/privacidad" element={<PrivacidadPage />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  {/* Merchant Agreement es público (lectura) pero la
                      firma del botón "Acepto" requiere auth del dueño. */}
                  <Route path="/legal/restaurante" element={<MerchantAgreementPage />} />

                  {/* POS (Fase 1+): personal del restaurante. Cubre cualquier
                      rol staff (cajero/mesero/cocina/restaurante/admin). */}
                  <Route
                    path="/pos"
                    element={
                      <ProtectedRoute allowedRoles={['cajero','mesero','cocina','restaurante','admin']}>
                        <POSLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<POSHomePage />} />
                    <Route path="mesas"    element={<FloorPlanPage />} />
                    <Route path="pedidos"  element={<OrdersListPage />} />
                    <Route path="pedidos/nuevo" element={<TakeOrderPage />} />
                    <Route path="cocina"   element={<KDSPage />} />
                    <Route path="caja"     element={<CashierPage />} />
                    <Route path="caja/cierre/:sesionId" element={<CashClosingPage />} />
                    <Route
                      path="inventario"
                      element={
                        <ProtectedRoute allowedRoles={['restaurante','admin']}>
                          <InventoryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="reportes"
                      element={
                        <ProtectedRoute allowedRoles={['restaurante','admin']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="configuracion"
                      element={
                        <ProtectedRoute allowedRoles={['restaurante','admin']}>
                          <ConfigPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="personal"
                      element={
                        <ProtectedRoute allowedRoles={['restaurante','admin']}>
                          <StaffPage />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  {/* Ruta 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </main>

            <Footer />

            {/* Botón flotante de ayuda "?" + tour guiado (Fase 13).
                Solo aparece en /dashboard y /pos/* para roles staff.
                IMPORTANTE: debe ir DENTRO del <AuthProvider> porque
                usa useAuth() para saber si hay un usuario logueado
                y leer `user.otros_datos.onboarding.dashboard_tour_completed`. */}
            <HelpButton />

            {/* Botón flotante para que el dueño comparta el enlace público de
                su local con sus clientes (WhatsApp / copiar / share nativo).
                Solo para rol 'restaurante' en /dashboard y /pos. */}
            <ShareLinkButton />

            {/* Botón "?" para CLIENTES. Es el equivalente del HelpButton
                del dueño, pero:
                  - Solo se monta si user.tipo_usuario === 'cliente'
                  - Solo en rutas de cliente (/, /restaurant/*, /cart, etc.)
                  - Lee/escribe flags `onboarding.client_*` (separados del dueño) */}
            <ClientHelpButton />

            {/* Banner de cookies: aparece en cualquier página si el usuario
                nunca aceptó/rechazó o si pasaron 12 meses. Es invisible si
                ya hay consentimiento vigente. */}
            <CookiesBanner />
            {/* Gate legal: bloquea la app hasta que el usuario logueado haya
                aceptado los documentos que correspondan a su rol (TyC+Privacidad
                para clientes, + Merchant para dueños de restaurantes). Es
                invisible si ya están todos aceptados.
                IMPORTANTE: debe ir DENTRO del <AuthProvider> porque usa
                useAuth() para saber si hay un usuario logueado. */}
            <LegalGate />

            {/* Modal de completar perfil para clientes que entran con Google
                (sin dirección/teléfono). Usa z-[90], por debajo del LegalGate
                (z-100), así aparece recién tras aceptar los documentos. */}
            <CompleteProfileGate />

            {/* Toast "nueva versión disponible" de la PWA (service worker en
                modo prompt). Invisible salvo cuando hay un update esperando. */}
            <PWAUpdatePrompt />
          </div>
        </CartProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">404</h1>
        <p className="text-gray-600 mb-6">Página no encontrada</p>
        <a href="/" className="btn btn-primary">
          Volver al Inicio
        </a>
      </div>
    </div>
  );
}
