import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Star, Settings, TrendingUp, MessageSquare, Gift } from 'lucide-react';
import { nurturingApi } from '../lib/api';
import toast from 'react-hot-toast';

const Nurturing = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'settings' | 'birthday' | 'reviews' | 'stats'>('settings');

  const { data: settings } = useQuery({
    queryKey: ['nurturing-settings'],
    queryFn: async () => {
      const res = await nurturingApi.getSettings();
      return res.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['nurturing-stats'],
    queryFn: async () => {
      const res = await nurturingApi.getStats();
      return res.data;
    },
  });

  const { data: birthdayContacts } = useQuery({
    queryKey: ['birthday-contacts'],
    queryFn: async () => {
      const res = await nurturingApi.getBirthdayContacts();
      return res.data;
    },
  });

  const { data: reviewEligible } = useQuery({
    queryKey: ['review-eligible'],
    queryFn: async () => {
      const res = await nurturingApi.getReviewEligibleContacts();
      return res.data;
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => 
      nurturingApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-settings'] });
      toast.success('Setting updated successfully');
    },
    onError: () => {
      toast.error('Failed to update setting');
    },
  });

  const handleSettingChange = (key: string, value: string) => {
    updateSettingMutation.mutate({ key, value });
  };

  const getSetting = (key: string): string => {
    const setting = settings?.find((s: any) => s.settingKey === key);
    return setting?.settingValue || '';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-8 h-8 text-rose-500" />
            Customer Nurturing
          </h1>
          <p className="text-gray-600 mt-2">
            Build lasting relationships with automated birthday wishes, review requests, and engagement campaigns
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('birthday')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'birthday'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Birthday Wishes ({birthdayContacts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'reviews'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Star className="w-4 h-4 inline mr-2" />
            Review Requests ({reviewEligible?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Statistics
          </button>
        </nav>
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Google Review Configuration
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Configure your Google Business review link for automated review requests after appointments
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Review Link
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://g.page/r/YOUR_REVIEW_LINK"
                  value={getSetting('google_review_link')}
                  onChange={(e) => handleSettingChange('google_review_link', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your review link from Google Business Profile → Get more reviews
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Request Delay (hours)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="24"
                  value={getSetting('review_request_delay_hours')}
                  onChange={(e) => handleSettingChange('review_request_delay_hours', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wait time after appointment before sending review request
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Request Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Hi {name}! We hope you enjoyed your {service} appointment. We'd love to hear your feedback..."
                  value={getSetting('review_request_template')}
                  onChange={(e) => handleSettingChange('review_request_template', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{name}'}, {'{service}'}, {'{date}'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              Birthday Wishes Configuration
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Automatically send personalized birthday messages to your customers
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Enable Birthday Wishes
                  </label>
                  <p className="text-xs text-gray-500">
                    Automatically send birthday greetings to customers
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={getSetting('birthday_wishes_enabled') === 'true'}
                  onChange={(e) => handleSettingChange('birthday_wishes_enabled', e.target.checked ? 'true' : 'false')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birthday Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Happy Birthday {name}! 🎉 We hope you have a wonderful day..."
                  value={getSetting('birthday_message_template')}
                  onChange={(e) => handleSettingChange('birthday_message_template', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholder: {'{name}'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Include Birthday Discount
                  </label>
                  <p className="text-xs text-gray-500">
                    Offer a special discount on their birthday
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={getSetting('birthday_discount_enabled') === 'true'}
                  onChange={(e) => handleSettingChange('birthday_discount_enabled', e.target.checked ? 'true' : 'false')}
                />
              </div>

              {getSetting('birthday_discount_enabled') === 'true' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Birthday Discount Percentage
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="10"
                    value={getSetting('birthday_discount_percentage')}
                    onChange={(e) => handleSettingChange('birthday_discount_percentage', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Post-Appointment Follow-Up
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Send personalized follow-ups after appointments to maintain engagement
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Enable Follow-Up Messages
                  </label>
                  <p className="text-xs text-gray-500">
                    Automatically check in after appointments
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={getSetting('followup_enabled') === 'true'}
                  onChange={(e) => handleSettingChange('followup_enabled', e.target.checked ? 'true' : 'false')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-Up Delay (days)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="3"
                  value={getSetting('followup_delay_days')}
                  onChange={(e) => handleSettingChange('followup_delay_days', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-Up Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Hi {name}! How are you feeling after your {service} appointment?..."
                  value={getSetting('followup_message_template')}
                  onChange={(e) => handleSettingChange('followup_message_template', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'birthday' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Birthday Contacts Today
          </h2>
          
          {birthdayContacts && birthdayContacts.length > 0 ? (
            <div className="space-y-3">
              {birthdayContacts.map((contact: any) => (
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{contact.name || contact.phone}</h3>
                      <p className="text-sm text-gray-500">Birthday: {contact.birthdate}</p>
                    </div>
                    <Gift className="w-6 h-6 text-pink-500" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No birthdays today</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Review-Eligible Contacts
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Customers who completed appointments and haven't been asked for a review recently
          </p>
          
          {reviewEligible && reviewEligible.length > 0 ? (
            <div className="space-y-3">
              {reviewEligible.map((contact: any) => (
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{contact.name || contact.phone}</h3>
                      <p className="text-sm text-gray-500">
                        {contact.email && <span className="mr-4">{contact.email}</span>}
                        {contact.last_review_request_at && (
                          <span className="text-xs">
                            Last request: {new Date(contact.last_review_request_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <Star className="w-6 h-6 text-yellow-500" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No contacts eligible for review requests right now</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Activity Overview
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Sent</span>
                <span className="text-2xl font-bold text-blue-600">{stats?.totalSent || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed</span>
                <span className="text-2xl font-bold text-green-600">{stats?.totalCompleted || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Failed</span>
                <span className="text-2xl font-bold text-red-600">{stats?.totalFailed || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              By Activity Type
            </h2>
            <div className="space-y-3">
              {stats?.byType && Object.entries(stats.byType).map(([type, count]: [string, any]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-gray-600 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-lg font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {(!stats?.byType || Object.keys(stats.byType).length === 0) && (
                <p className="text-gray-500 text-center py-4">No activity data yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nurturing;
