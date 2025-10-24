import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Marketing from './pages/Marketing';
import Bookings from './pages/Bookings';
import AdminManagement from './pages/AdminManagement';
import BotConfiguration from './pages/BotConfiguration';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Questionnaires from './pages/Questionnaires';
import Services from './pages/Services';
import Promotions from './pages/Promotions';
import BotDiscounts from './pages/BotDiscounts';
import CustomersManagement from './pages/CustomersManagement';
import Escalations from './pages/Escalations';
import Nurturing from './pages/Nurturing';
import PaymentEscalations from './pages/PaymentEscalations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="conversations" element={<Conversations />} />
              <Route path="escalations" element={<Escalations />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="questionnaires" element={<Questionnaires />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="bookings" element={<Bookings />} />
              <Route
                path="services"
                element={
                  <ProtectedRoute requireMaster>
                    <Services />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bot-config"
                element={
                  <ProtectedRoute requireMaster>
                    <BotConfiguration />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute requireMaster>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="marketing"
                element={
                  <ProtectedRoute requireMaster>
                    <Marketing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireMaster>
                    <AdminManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="promotions"
                element={
                  <ProtectedRoute requireMaster>
                    <Promotions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bot-discounts"
                element={
                  <ProtectedRoute requireMaster>
                    <BotDiscounts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers-management"
                element={
                  <ProtectedRoute requireMaster>
                    <CustomersManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="nurturing"
                element={
                  <ProtectedRoute requireMaster>
                    <Nurturing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payment-escalations"
                element={
                  <ProtectedRoute requireMaster>
                    <PaymentEscalations />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
