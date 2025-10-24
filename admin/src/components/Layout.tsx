import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Settings, BarChart3, Mail, Calendar, Users, LogOut, Shield, User, FileText, Briefcase, Percent, CheckSquare, UserCog, AlertCircle, Heart, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import WhatsAppBanner from './WhatsAppBanner';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { agent, logout, isMaster } = useAuth();
  
  const isActive = (path: string) => location.pathname === path || (path === '/' && location.pathname === '/');
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['master', 'support'] },
    { path: '/conversations', label: 'Conversations', icon: MessageSquare, roles: ['master', 'support'] },
    { path: '/escalations', label: 'Escalations', icon: AlertCircle, roles: ['master', 'support'] },
    { path: '/customers-management', label: 'Customer Management', icon: UserCog, roles: ['master', 'support'] },
    { path: '/questionnaires', label: 'Questionnaires', icon: FileText, roles: ['master', 'support'] },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['master', 'support'] },
    { path: '/bookings', label: 'Bookings', icon: Calendar, roles: ['master', 'support'] },
    { path: '/payment-escalations', label: 'Payment Issues', icon: DollarSign, roles: ['master'] },
    { path: '/nurturing', label: 'Nurturing', icon: Heart, roles: ['master'] },
    { path: '/promotions', label: 'Promotions', icon: Percent, roles: ['master'] },
    { path: '/bot-discounts', label: 'Discount Approvals', icon: CheckSquare, roles: ['master'] },
    { path: '/services', label: 'Services', icon: Briefcase, roles: ['master'] },
    { path: '/bot-config', label: 'Bot Configuration', icon: Settings, roles: ['master'] },
    { path: '/marketing', label: 'Marketing', icon: Mail, roles: ['master'] },
    { path: '/admin', label: 'Admin Management', icon: Users, roles: ['master'] },
    { path: '/settings', label: 'System Settings', icon: Settings, roles: ['master'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(agent?.role || ''));

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">WhatsApp Bot Manager</p>
        </div>
        
        <nav className="px-4 space-y-1 flex-1">
          {filteredNavItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive(path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isMaster ? 'bg-purple-100' : 'bg-blue-100'
            }`}>
              {isMaster ? (
                <Shield className="w-5 h-5 text-purple-600" />
              ) : (
                <User className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{agent?.name}</p>
              <p className="text-xs text-gray-500 truncate">{agent?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <WhatsAppBanner />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
