import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const ConfirmationTemplatesTab = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    whatsapp_confirmation_enabled: true,
    whatsapp_confirmation_template: '',
    email_confirmation_enabled: true,
    email_confirmation_subject: '',
    email_confirmation_template: '',
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
        whatsapp_confirmation_enabled: getSetting('whatsapp_confirmation_enabled') === 'true',
        whatsapp_confirmation_template: getSetting('whatsapp_confirmation_template'),
        email_confirmation_enabled: getSetting('email_confirmation_enabled') === 'true',
        email_confirmation_subject: getSetting('email_confirmation_subject'),
        email_confirmation_template: getSetting('email_confirmation_template'),
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const promises = Object.entries(data).map(([key, value]) =>
        settingsApi.update(key, String(value))
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Confirmation templates saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save confirmation templates');
    },
  });

  const placeholders = [
    { key: '{{name}}', desc: "Customer's name" },
    { key: '{{service}}', desc: 'Service name' },
    { key: '{{datetime}}', desc: 'Appointment date & time' },
    { key: '{{date}}', desc: 'Date only' },
    { key: '{{time}}', desc: 'Time only' },
    { key: '{{cost}}', desc: 'Service cost in CHF' },
    { key: '{{location}}', desc: 'Business location' },
    { key: '{{directions}}', desc: 'How to get there' },
    { key: '{{business_name}}', desc: 'Your business name' },
  ];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Confirmation Templates</strong> are sent to customers after successful bookings. 
          Use placeholders (e.g., {'{'}{'{'} name{'}'}{'}'}) to personalize messages automatically.
        </p>
      </div>

      {/* Placeholder Reference */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Placeholders</h3>
        <div className="grid grid-cols-3 gap-3">
          {placeholders.map((p) => (
            <div key={p.key} className="p-2 bg-gray-50 rounded border border-gray-200">
              <code className="text-sm text-blue-600 font-mono">{p.key}</code>
              <p className="text-xs text-gray-600 mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Confirmation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            WhatsApp Confirmation
          </h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.whatsapp_confirmation_enabled}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp_confirmation_enabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Enabled</span>
          </label>
        </div>

        <textarea
          value={formData.whatsapp_confirmation_template}
          onChange={(e) =>
            setFormData({ ...formData, whatsapp_confirmation_template: e.target.value })
          }
          placeholder="✅ Booking Confirmed!&#10;&#10;Hi {{name}}, your appointment is confirmed.&#10;&#10;📅 Service: {{service}}&#10;🕐 Date & Time: {{datetime}}&#10;💰 Cost: CHF {{cost}}&#10;📍 Location: {{location}}&#10;&#10;{{directions}}&#10;&#10;See you soon!&#10;{{business_name}}"
          rows={10}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
      </div>

      {/* Email Confirmation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Email Confirmation
          </h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.email_confirmation_enabled}
              onChange={(e) =>
                setFormData({ ...formData, email_confirmation_enabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Enabled</span>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              value={formData.email_confirmation_subject}
              onChange={(e) =>
                setFormData({ ...formData, email_confirmation_subject: e.target.value })
              }
              placeholder="Booking Confirmation - {{service}} on {{date}}"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Body
            </label>
            <textarea
              value={formData.email_confirmation_template}
              onChange={(e) =>
                setFormData({ ...formData, email_confirmation_template: e.target.value })
              }
              placeholder="Dear {{name}},&#10;&#10;Your appointment has been confirmed.&#10;&#10;Service: {{service}}&#10;Date & Time: {{datetime}}&#10;Cost: CHF {{cost}}&#10;Location: {{location}}&#10;&#10;{{directions}}&#10;&#10;If you need to cancel or reschedule, please contact us at least 24 hours in advance.&#10;&#10;Best regards,&#10;{{business_name}}"
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Confirmation Templates'}
        </button>
      </div>
    </div>
  );
};

export default ConfirmationTemplatesTab;
