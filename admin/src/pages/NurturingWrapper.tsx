import { useState } from 'react';
import { FileText, Send, Tag, Gift, Star, FolderOpen } from 'lucide-react';
import QuestionnairesTab from '../components/nurturing/QuestionnairesTab';
import CampaignsTab from '../components/nurturing/CampaignsTab';
import PromotionsTab from '../components/nurturing/PromotionsTab';
import BirthdayWishesTab from '../components/nurturing/BirthdayWishesTab';
import TestimonialsTab from '../components/nurturing/TestimonialsTab';
import ServiceDocumentsTab from '../components/nurturing/ServiceDocumentsTab';

const NurturingWrapper = () => {
  const [activeTab, setActiveTab] = useState<'questionnaires' | 'campaigns' | 'promotions' | 'birthday' | 'testimonials' | 'documents'>('questionnaires');

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
            <button
              onClick={() => setActiveTab('birthday')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'birthday'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Gift className="w-4 h-4" />
              Birthday Wishes
            </button>
            <button
              onClick={() => setActiveTab('testimonials')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'testimonials'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Star className="w-4 h-4" />
              Testimonials
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Service Documents
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'questionnaires' && <QuestionnairesTab />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'promotions' && <PromotionsTab />}
      {activeTab === 'birthday' && <BirthdayWishesTab />}
      {activeTab === 'testimonials' && <TestimonialsTab />}
      {activeTab === 'documents' && <ServiceDocumentsTab />}
    </div>
  );
};

export default NurturingWrapper;
