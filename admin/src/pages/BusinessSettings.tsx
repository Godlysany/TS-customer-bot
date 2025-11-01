import { useState } from 'react';
import { Briefcase, Heart } from 'lucide-react';
import ServicesTab from '../components/business/ServicesTab';
import NurturingSettingsTab from '../components/business/NurturingSettingsTab';

const BusinessSettings = () => {
  const [activeTab, setActiveTab] = useState<'services' | 'nurturing'>('services');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-gray-600 mt-2">Manage your services, nurturing automation, and business rules</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
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
              onClick={() => setActiveTab('nurturing')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'nurturing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Heart className="w-4 h-4" />
              Nurturing Settings
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'services' && <ServicesTab />}
      {activeTab === 'nurturing' && <NurturingSettingsTab />}
    </div>
  );
};

export default BusinessSettings;
