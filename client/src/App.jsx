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

// Code splitting: cada página se carga solo cuando se necesita
// Reduce el bundle inicial y mejora el time-to-interactive
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const RestaurantDetailsPage = lazy(() => import('./pages/RestaurantDetailsPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersHistoryPage = lazy(() => import('./pages/OrdersHistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RestaurantDashboardPage = lazy(() => import('./pages/RestaurantDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const HomeMediaPage = lazy(() => import('./pages/admin/HomeMediaPage'));

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

                  {/* Rutas Cliente */}
                  <Route
                    path="/restaurant/:id"
                    element={
                      <ProtectedRoute requiredRole="cliente">
                        <RestaurantDetailsPage />
                      </ProtectedRoute>
                    }
                  />
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
