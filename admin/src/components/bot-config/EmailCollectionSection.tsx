import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const EmailCollectionSection = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email_collection_mode: 'gentle',
    email_collection_prompt_gentle: '',
    email_collection_prompt_mandatory: '',
  });

  const { data: settings } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      const getSetting = (key: string) => {
        const setting = settings.find((s: any) => s.key === key);
        return setting?.value || '';
      };

      setFormData({
        email_collection_mode: getSetting('email_collection_mode') || 'gentle',
        email_collection_prompt_gentle: getSetting('email_collection_prompt_gentle') || 
          'By the way, could I have your email address? This helps us send you appointment confirmations and reminders. (It\'s okay if you\'d prefer not to share it)',
        email_collection_prompt_mandatory: getSetting('email_collection_prompt_mandatory') || 
          'To complete your booking, I\'ll need your email address for confirmation and appointment reminders. Could you please share it?',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const promises = Object.entries(data).map(([key, value]) =>
        settingsApi.update(key, value)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Email collection settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save email collection settings');
    },
  });

  const modes = [
    {
      id: 'mandatory',
      name: 'Mandatory',
      description: 'Require email before booking. No appointment without email address.',
      icon: '🔒',
      color: 'red',
    },
    {
      id: 'gentle',
      name: 'Gentle Request',
      description: 'Ask nicely for email. Allow booking even if customer declines.',
      icon: '💬',
      color: 'green',
    },
    {
      id: 'skip',
      name: 'Skip Collection',
      description: 'Don\'t ask for email at all. Book appointments without email.',
      icon: '⏭️',
      color: 'gray',
    },
  ];

  const getColorClasses = (color: string, selected: boolean) => {
    if (selected) {
      switch (color) {
        case 'red': return 'border-red-500 bg-red-50';
        case 'green': return 'border-green-500 bg-green-50';
        case 'gray': return 'border-gray-500 bg-gray-50';
        default: return 'border-blue-500 bg-blue-50';
      }
    }
    return 'border-gray-200 hover:border-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Email Collection</strong> determines how aggressively the bot asks for customer email addresses. 
          Emails are used for appointment confirmations, reminders, and follow-up communications.
        </p>
      </div>

      {/* Collection Mode */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Email Collection Mode
        </h3>

        <div className="space-y-3">
          {modes.map((mode) => (
            <label
              key={mode.id}
              className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${getColorClasses(
                mode.color,
                formData.email_collection_mode === mode.id
              )}`}
            >
              <input
                type="radio"
                name="email_collection_mode"
                value={mode.id}
                checked={formData.email_collection_mode === mode.id}
                onChange={(e) => setFormData({ ...formData, email_collection_mode: e.target.value })}
                className="mt-1"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{mode.icon}</span>
                  <p className="font-medium text-gray-900">{mode.name}</p>
                </div>
                <p className="text-sm text-gray-600 mt-1">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Mode-specific recommendations */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Recommendation</p>
              {formData.email_collection_mode === 'mandatory' && (
                <p className="text-sm text-amber-800 mt-1">
                  <strong>Mandatory mode</strong> ensures you have email for all bookings, but may reduce conversion 
                  rates if customers are privacy-conscious. Best for businesses requiring email confirmations.
                </p>
              )}
              {formData.email_collection_mode === 'gentle' && (
                <p className="text-sm text-amber-800 mt-1">
                  <strong>Gentle mode</strong> balances data collection with customer comfort. This is the 
                  recommended default for most businesses - you'll collect most emails without being pushy.
                </p>
              )}
              {formData.email_collection_mode === 'skip' && (
                <p className="text-sm text-amber-800 mt-1">
                  <strong>Skip mode</strong> maximizes booking conversions but means you won't have email addresses 
                  for confirmations or reminders. Only recommended if you handle all communication via WhatsApp.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gentle Mode Prompt */}
      {formData.email_collection_mode === 'gentle' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gentle Request Prompt</h3>
          <p className="text-sm text-gray-600 mb-4">
            How the bot asks for email in gentle mode. Keep it friendly and emphasize the value 
            (confirmations, reminders) while making it clear they can decline.
          </p>

          <textarea
            value={formData.email_collection_prompt_gentle}
            onChange={(e) => setFormData({ ...formData, email_collection_prompt_gentle: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="By the way, could I have your email address? This helps us send you appointment confirmations and reminders. (It's okay if you'd prefer not to share it)"
          />

          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>💡 Best Practices:</strong> Explain the benefit (confirmations, reminders), use friendly 
              language, and explicitly mention they can decline. Example: "May I have your email for appointment 
              reminders? (No worries if you prefer not to share it)"
            </p>
          </div>
        </div>
      )}

      {/* Mandatory Mode Prompt */}
      {formData.email_collection_mode === 'mandatory' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mandatory Request Prompt</h3>
          <p className="text-sm text-gray-600 mb-4">
            How the bot requests email in mandatory mode. Be clear and professional about the requirement 
            while explaining why it's needed.
          </p>

          <textarea
            value={formData.email_collection_prompt_mandatory}
            onChange={(e) => setFormData({ ...formData, email_collection_prompt_mandatory: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="To complete your booking, I'll need your email address for confirmation and appointment reminders. Could you please share it?"
          />

          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>⚠️ Important:</strong> In mandatory mode, the bot will not proceed with booking until 
              an email is provided. Make sure your prompt clearly explains this requirement and why it's necessary.
            </p>
          </div>
        </div>
      )}

      {/* Skip Mode Notice */}
      {formData.email_collection_mode === 'skip' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Skip Mode Active:</strong> The bot will not ask for email addresses. All confirmations 
              and reminders will be sent via WhatsApp only. Make sure your WhatsApp confirmation templates 
              are properly configured.
            </p>
          </div>
        </div>
      )}

      {/* Email Collection Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Impact</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-600 font-medium">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {formData.email_collection_mode === 'mandatory' ? '~85%' : 
               formData.email_collection_mode === 'gentle' ? '~95%' : '~100%'}
            </p>
            <p className="text-xs text-blue-700 mt-1">Expected booking completion rate</p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-600 font-medium">Email Collection</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {formData.email_collection_mode === 'mandatory' ? '~100%' : 
               formData.email_collection_mode === 'gentle' ? '~75%' : '~0%'}
            </p>
            <p className="text-xs text-green-700 mt-1">Customers providing email</p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600 font-medium">Communication</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">
              {formData.email_collection_mode === 'skip' ? 'WhatsApp' : 'Multi-Channel'}
            </p>
            <p className="text-xs text-purple-700 mt-1">Available channels</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          * Estimates based on typical customer behavior patterns
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Email Collection Settings'}
        </button>
      </div>
    </div>
  );
};

export default EmailCollectionSection;
