import { useState } from 'react';
import { Building2, Mail, Briefcase, Calendar, Users } from 'lucide-react';
import BusinessDetailsTab from '../components/business-settings/BusinessDetailsTab';
import ConfirmationTemplatesTab from '../components/business-settings/ConfirmationTemplatesTab';
import ServicesTab from '../components/business/ServicesTab';
import BookingConfigTab from '../components/business-settings/BookingConfigTab';
import TeamMembers from './TeamMembers';

const BusinessSettings = () => {
  const [activeTab, setActiveTab] = useState<'business' | 'templates' | 'services' | 'booking' | 'team'>('business');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-gray-600 mt-2">Manage your business details, services, team members, confirmation templates, and booking configuration</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('business')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'business'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Business Details
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Mail className="w-4 h-4" />
              Confirmation Templates
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'services'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Services
            </button>
            <button
              onClick={() => setActiveTab('booking')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'booking'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Booking Configuration
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Team Members
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'business' && <BusinessDetailsTab />}
      {activeTab === 'templates' && <ConfirmationTemplatesTab />}
      {activeTab === 'services' && <ServicesTab />}
      {activeTab === 'booking' && <BookingConfigTab />}
      {activeTab === 'team' && <TeamMembers />}
    </div>
  );
};

export default BusinessSettings;
