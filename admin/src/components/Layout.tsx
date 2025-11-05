import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Settings, Calendar, LogOut, Shield, User, UserCog, AlertCircle, Heart, Bot, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureVisibility } from '../hooks/useFeatureVisibility';
import WhatsAppBanner from './WhatsAppBanner';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { agent, logout } = useAuth();
  const visibility = useFeatureVisibility();
  
  const isActive = (path: string) => location.pathname === path || (path === '/' && location.pathname === '/');
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['master', 'operator', 'support'], visible: true },
    { path: '/conversations', label: 'Conversations', icon: MessageSquare, roles: ['master', 'operator', 'support'], visible: true },
    { path: '/bookings', label: 'Bookings', icon: Calendar, roles: ['master', 'operator', 'support'], visible: visibility.showBookings },
    { path: '/escalations', label: 'Escalations', icon: AlertCircle, roles: ['master', 'operator', 'support'], visible: true },
    { path: '/customers-management', label: 'Customer Management', icon: UserCog, roles: ['master', 'operator', 'support'], visible: true },
    { path: '/nurturing', label: 'Nurturing', icon: Heart, roles: ['master', 'operator', 'support'], visible: visibility.showNurturing },
    { path: '/business-settings', label: 'Business Settings', icon: Briefcase, roles: ['master', 'operator'], visible: true },
    { path: '/bot-config', label: 'Bot Configuration', icon: Bot, roles: ['master'], visible: true },
    { path: '/admin', label: 'Admin Management', icon: Shield, roles: ['master'], visible: true },
    { path: '/settings', label: 'System Settings', icon: Settings, roles: ['master', 'operator'], visible: true },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(agent?.role || '') && item.visible
  );

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
              agent?.role === 'master' ? 'bg-purple-100' : agent?.role === 'operator' ? 'bg-indigo-100' : 'bg-blue-100'
            }`}>
              {agent?.role === 'master' ? (
                <Shield className="w-5 h-5 text-purple-600" />
              ) : (
                <User className={`w-5 h-5 ${agent?.role === 'operator' ? 'text-indigo-600' : 'text-blue-600'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{agent?.name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{agent?.role}</p>
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
