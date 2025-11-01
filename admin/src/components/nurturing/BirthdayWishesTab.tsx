import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Calendar, Check, X } from 'lucide-react';
import { nurturingApi } from '../../lib/api';
import toast from 'react-hot-toast';

const BirthdayWishesTab = () => {
  const queryClient = useQueryClient();
  const [showPromotions, setShowPromotions] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['nurturing-settings'],
    queryFn: async () => {
      const res = await nurturingApi.getSettings();
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

  const { data: birthdayHistory } = useQuery({
    queryKey: ['birthday-history'],
    queryFn: async () => {
      const res = await nurturingApi.getContactActivities('birthday_wish');
      return res.data;
    },
  });

  const { data: promotions } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await nurturingApi.getPromotions();
      return res.data;
    },
    enabled: showPromotions,
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

  const enableBirthday = getSetting('enable_birthday_wishes') === 'true';
  const enablePromotion = getSetting('birthday_enable_promotion') === 'true';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-rose-500" />
          Birthday Wishes Settings
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Automatically send birthday wishes to customers on their special day
        </p>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable Birthday Wishes</h3>
              <p className="text-xs text-gray-500 mt-1">Send automated birthday messages to customers</p>
            </div>
            <button
              onClick={() => handleSettingChange('enable_birthday_wishes', (!enableBirthday).toString())}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableBirthday ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enableBirthday ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {enableBirthday && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birthday Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Happy Birthday {name}! 🎉 Wishing you a wonderful day filled with joy..."
                  value={getSetting('birthday_message_template')}
                  onChange={(e) => handleSettingChange('birthday_message_template', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{name}'}, {'{age}'}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Include Promotion</h3>
                  <p className="text-xs text-gray-500 mt-1">Attach a special birthday promotion to the message</p>
                </div>
                <button
                  onClick={() => {
                    handleSettingChange('birthday_enable_promotion', (!enablePromotion).toString());
                    if (!enablePromotion) setShowPromotions(true);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enablePromotion ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enablePromotion ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {enablePromotion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Promotion
                  </label>
                  <select
                    value={getSetting('birthday_promotion_id')}
                    onChange={(e) => handleSettingChange('birthday_promotion_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No promotion selected</option>
                    {promotions?.map((promo: any) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.name} - {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `CHF ${promo.discountValue}`} off
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          Upcoming Birthdays
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Customers with birthdays in the next 30 days
        </p>

        {birthdayContacts && birthdayContacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birthday</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Until</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {birthdayContacts.map((contact: any) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.phone_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(contact.birthdate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {contact.daysUntil} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No upcoming birthdays in the next 30 days</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Birthday Wishes History</h2>
        <p className="text-sm text-gray-600 mb-4">
          Past birthday wishes sent to customers
        </p>

        {birthdayHistory && birthdayHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promotion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {birthdayHistory.map((activity: any) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{activity.contact?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{activity.details}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activity.metadata?.promotionName || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {activity.status === 'completed' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No birthday wishes sent yet</p>
        )}
      </div>
    </div>
  );
};

export default BirthdayWishesTab;
