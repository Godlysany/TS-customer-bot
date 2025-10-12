import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationsApi, analyticsApi } from '../lib/api';
import type { Conversation } from '../types';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

const Analytics = () => {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await conversationsApi.getAll();
      return res.data;
    },
  });

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', selectedContact],
    queryFn: async () => {
      if (!selectedContact) return null;
      const res = await analyticsApi.getCustomer(selectedContact);
      return res.data;
    },
    enabled: !!selectedContact,
  });

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Minus className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUpsellColor = (potential: string) => {
    switch (potential) {
      case 'high':
        return 'bg-purple-100 text-purple-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Customer Analytics</h2>
        </div>
        <div className="overflow-y-auto">
          {conversations?.map((conv: Conversation) => (
            <div
              key={conv.id}
              onClick={() => setSelectedContact(conv.contactId)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedContact === conv.contactId ? 'bg-blue-50' : ''
              }`}
            >
              <p className="font-medium text-gray-900">
                {conv.contact?.name || conv.contact?.phone || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500">
                {conv.contact?.phone}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-gray-50 p-8">
        {selectedContact && analytics ? (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900">Customer Insights</h3>
              <button
                onClick={() => refetchAnalytics()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  {getSentimentIcon(analytics.sentiment)}
                  <h4 className="text-sm font-medium text-gray-600">Sentiment</h4>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  getSentimentColor(analytics.sentiment)
                }`}>
                  {analytics.sentiment}
                </span>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Upsell Potential</h4>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  getUpsellColor(analytics.upsellPotential)
                }`}>
                  {analytics.upsellPotential}
                </span>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Engagement Score</h4>
                <p className="text-3xl font-bold text-gray-900">
                  {analytics.lastEngagementScore}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {analytics.keywords?.map((keyword: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Appointment History</h4>
              <p className="text-4xl font-bold text-gray-900">
                {analytics.appointmentHistory}
              </p>
              <p className="text-sm text-gray-500 mt-2">Total appointments booked</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a customer to view analytics
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
