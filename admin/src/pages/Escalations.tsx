import { useState } from 'react';
import { AlertCircle, DollarSign } from 'lucide-react';
import ConversationReviews from '../components/escalations/ConversationReviews';
import PaymentReviews from '../components/escalations/PaymentReviews';

const Escalations = () => {
  const [activeTab, setActiveTab] = useState<'conversation' | 'payment'>('conversation');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Escalations</h1>
        <p className="text-gray-600 mt-2">Manage conversation escalations and payment issues</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('conversation')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'conversation'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Conversation Reviews
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'payment'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Payment Reviews
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'conversation' && <ConversationReviews />}
      {activeTab === 'payment' && <PaymentReviews />}
    </div>
  );
};

export default Escalations;
