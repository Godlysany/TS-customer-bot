import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import Bookings from './pages/Bookings';
import AdminManagement from './pages/AdminManagement';
import BotConfiguration from './pages/BotConfiguration';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import CustomersManagement from './pages/CustomersManagement';
import Escalations from './pages/Escalations';
import NurturingWrapper from './pages/NurturingWrapper';
import BusinessSettings from './pages/BusinessSettings';
import TeamMembers from './pages/TeamMembers';

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
              <Route path="bookings" element={<Bookings />} />
              <Route path="escalations" element={<Escalations />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="customers-management" element={<CustomersManagement />} />
              <Route
                path="team-members"
                element={
                  <ProtectedRoute requireMasterOrOperator>
                    <TeamMembers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="nurturing"
                element={
                  <ProtectedRoute requireMaster>
                    <NurturingWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="business-settings"
                element={
                  <ProtectedRoute requireMasterOrOperator>
                    <BusinessSettings />
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
                path="admin"
                element={
                  <ProtectedRoute requireMaster>
                    <AdminManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute requireMasterOrOperator>
                    <Settings />
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
