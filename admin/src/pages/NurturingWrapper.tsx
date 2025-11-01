import { useState } from 'react';
import { FileText, Send, Tag } from 'lucide-react';
import QuestionnairesTab from '../components/nurturing/QuestionnairesTab';
import CampaignsTab from '../components/nurturing/CampaignsTab';
import PromotionsTab from '../components/nurturing/PromotionsTab';

const NurturingWrapper = () => {
  const [activeTab, setActiveTab] = useState<'questionnaires' | 'campaigns' | 'promotions'>('questionnaires');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nurturing</h1>
        <p className="text-gray-600 mt-2">Manage questionnaires, marketing campaigns, and promotional offers</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('questionnaires')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'questionnaires'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Questionnaires
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Send className="w-4 h-4" />
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'promotions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="w-4 h-4" />
              Promotions
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'questionnaires' && <QuestionnairesTab />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'promotions' && <PromotionsTab />}
    </div>
  );
};

export default NurturingWrapper;
