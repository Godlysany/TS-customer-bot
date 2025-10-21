import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi, questionnaireApi } from '../lib/api';
import { promotionApi } from '../lib/promotion-api';
import type { MarketingCampaign } from '../types';
import { Filter, Send, Calendar as CalendarIcon, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

const Marketing = () => {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
    sentiment: '',
    hasAppointment: '',
    lastInteractionDays: '',
  });
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState('');
  const [promotionAfterCompletion, setPromotionAfterCompletion] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [sendImmediately, setSendImmediately] = useState(true);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await marketingApi.getCampaigns();
      return res.data;
    },
  });

  const { data: promotions } = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: async () => {
      const res = await promotionApi.getActive();
      return res.data;
    },
  });

  const { data: questionnaires } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const res = await questionnaireApi.getAll();
      return res.data;
    },
  });

  const filterContactsMutation = useMutation({
    mutationFn: (criteria: any) => marketingApi.filterContacts(criteria),
    onSuccess: (res) => {
      setFilteredCount(res.data.count);
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => marketingApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowFilterModal(false);
      setCampaignName('');
      setCampaignMessage('');
      setSelectedPromotionId('');
      setSelectedQuestionnaireId('');
      setPromotionAfterCompletion(false);
      setScheduledDate('');
      setScheduledTime('');
      setSendImmediately(true);
      setFilterCriteria({ sentiment: '', hasAppointment: '', lastInteractionDays: '' });
      setFilteredCount(null);
      toast.success('Campaign created successfully');
    },
    onError: () => {
      toast.error('Failed to create campaign');
    },
  });

  const handlePreviewFilter = () => {
    const criteria: any = {};
    if (filterCriteria.sentiment) criteria.sentiment = filterCriteria.sentiment;
    if (filterCriteria.hasAppointment) criteria.hasAppointment = filterCriteria.hasAppointment === 'true';
    if (filterCriteria.lastInteractionDays) criteria.lastInteractionDays = parseInt(filterCriteria.lastInteractionDays);
    
    filterContactsMutation.mutate(criteria);
  };

  const handleCreateCampaign = () => {
    // Validation: Check if scheduling for later without both date and time
    if (!sendImmediately && (!scheduledDate || !scheduledTime)) {
      toast.error('Please select both date and time for scheduled campaigns');
      return;
    }

    const criteria: any = {};
    if (filterCriteria.sentiment) criteria.sentiment = filterCriteria.sentiment;
    if (filterCriteria.hasAppointment) criteria.hasAppointment = filterCriteria.hasAppointment === 'true';
    if (filterCriteria.lastInteractionDays) criteria.lastInteractionDays = parseInt(filterCriteria.lastInteractionDays);

    // Calculate scheduledAt
    let scheduledAt = null;
    let status = 'draft';
    
    if (sendImmediately) {
      scheduledAt = new Date().toISOString();
      status = 'ready'; // Ready to be sent by scheduler
    } else if (scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      status = 'scheduled';
    }

    createCampaignMutation.mutate({
      name: campaignName,
      filterCriteria: criteria,
      messageTemplate: campaignMessage,
      promotionId: selectedPromotionId || null,
      questionnaireId: selectedQuestionnaireId || null,
      promotionAfterCompletion: promotionAfterCompletion,
      scheduledAt,
      status,
    });
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketing Campaigns</h1>
          <button
            onClick={() => setShowFilterModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
            New Campaign
          </button>
        </div>

        <div className="space-y-4">
          {campaigns?.map((campaign: MarketingCampaign) => (
            <div
              key={campaign.id}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {campaign.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {campaign.message}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className={`px-3 py-1 rounded-full ${getCampaignStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                    {campaign.scheduledFor && (
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          Scheduled: {new Date(campaign.scheduledFor).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {campaigns?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No campaigns yet. Create your first campaign!
            </div>
          )}
        </div>

        {showFilterModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Campaign</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Summer Sale 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your campaign message..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 inline-block mr-1" />
                    Link Promotion (Optional)
                  </label>
                  <select
                    value={selectedPromotionId}
                    onChange={(e) => setSelectedPromotionId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No promotion</option>
                    {promotions?.map((promo: any) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.name} - {promo.discount_type === 'fixed_chf' ? `${promo.discount_value} CHF` : `${promo.discount_value}%`} off
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    When linked, the bot can intelligently offer this promotion during customer conversations.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link Questionnaire (Optional)
                  </label>
                  <select
                    value={selectedQuestionnaireId}
                    onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No questionnaire</option>
                    {questionnaires?.map((q: any) => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({q.type})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Send a questionnaire to customers matching the campaign criteria.
                  </p>
                </div>

                {selectedQuestionnaireId && selectedPromotionId && (
                  <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <input
                      type="checkbox"
                      id="promotionAfterCompletion"
                      checked={promotionAfterCompletion}
                      onChange={(e) => setPromotionAfterCompletion(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="promotionAfterCompletion" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Give promotion after questionnaire completion
                    </label>
                    <p className="text-xs text-gray-600 ml-6">
                      Bot will automatically offer the linked promotion once the customer completes the questionnaire.
                    </p>
                  </div>
                )}

                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarIcon className="w-5 h-5 text-gray-700" />
                    <h3 className="text-lg font-semibold text-gray-900">Schedule Campaign</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="sendNow"
                        name="sendTiming"
                        checked={sendImmediately}
                        onChange={() => setSendImmediately(true)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="sendNow" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Send immediately (processed by scheduler within 60 minutes)
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="sendLater"
                        name="sendTiming"
                        checked={!sendImmediately}
                        onChange={() => setSendImmediately(false)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="sendLater" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Schedule for specific date/time
                      </label>
                    </div>

                    {!sendImmediately && (
                      <div className="ml-6 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date
                          </label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Time
                          </label>
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-700" />
                    <h3 className="text-lg font-semibold text-gray-900">Filter Audience</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sentiment
                      </label>
                      <select
                        value={filterCriteria.sentiment}
                        onChange={(e) => setFilterCriteria({ ...filterCriteria, sentiment: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">All</option>
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Has Appointment
                      </label>
                      <select
                        value={filterCriteria.hasAppointment}
                        onChange={(e) => setFilterCriteria({ ...filterCriteria, hasAppointment: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Interaction (days)
                      </label>
                      <input
                        type="number"
                        value={filterCriteria.lastInteractionDays}
                        onChange={(e) => setFilterCriteria({ ...filterCriteria, lastInteractionDays: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="30"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePreviewFilter}
                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Preview Audience
                  </button>

                  {filteredCount !== null && (
                    <p className="mt-3 text-sm text-gray-600">
                      <strong>{filteredCount}</strong> contacts match this filter
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowFilterModal(false);
                    setFilteredCount(null);
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCampaign}
                  disabled={!campaignName || !campaignMessage || (!sendImmediately && (!scheduledDate || !scheduledTime))}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {sendImmediately ? 'Create & Queue for Sending' : 'Schedule Campaign'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketing;
