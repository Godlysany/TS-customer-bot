import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, calendarApi } from '../lib/api';
import type { Setting } from '../types';
import { Key, Bot, Smartphone, Calendar, Save, Power, User, Bell, CheckCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const Settings = () => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.getAll();
      return res.data;
    },
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const res = await settingsApi.getWhatsAppStatus();
      return res.data;
    },
    refetchInterval: 5000,
  });

  const { data: calendarStatus } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: async () => {
      const res = await calendarApi.getStatus();
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: qrData } = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: async () => {
      const res = await settingsApi.getWhatsAppQr();
      return res.data;
    },
    refetchInterval: showQrModal ? 2000 : false, // Poll every 2s when modal is open
    enabled: showQrModal, // Only fetch when modal is shown
  });

  // Auto-close modal when WhatsApp connects
  if (showQrModal && whatsappStatus?.connected) {
    setShowQrModal(false);
    toast.success('WhatsApp connected successfully!');
  }

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value, isSecret }: { key: string; value: string; isSecret: boolean }) =>
      settingsApi.update(key, value, isSecret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditingKey(null);
      setEditValue('');
      toast.success('Setting updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update setting');
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: () => settingsApi.toggleBot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Bot status updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update bot status');
    },
  });

  const connectWhatsAppMutation = useMutation({
    mutationFn: () => settingsApi.connectWhatsApp(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      setShowQrModal(true); // Show QR modal after connection initiated
      toast.success('WhatsApp connection initiated - waiting for QR code...');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to connect WhatsApp');
    },
  });

  const disconnectWhatsAppMutation = useMutation({
    mutationFn: () => settingsApi.disconnectWhatsApp(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      toast.success('WhatsApp disconnected successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to disconnect WhatsApp');
    },
  });

  const disconnectCalendarMutation = useMutation({
    mutationFn: () => calendarApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
      toast.success('Calendar disconnected successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to disconnect calendar');
    },
  });

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue || '');
  };

  const handleSave = (key: string, isSecret: boolean) => {
    updateSettingMutation.mutate({ key, value: editValue, isSecret });
  };

  const getSetting = (key: string) => settings?.find((s: Setting) => s.key === key);
  const botEnabled = getSetting('bot_enabled')?.value === 'true';

  const botSettings = [
    { key: 'default_bot_language', label: 'Default Bot Language', type: 'select', options: ['de', 'en', 'fr', 'it', 'es', 'pt'] },
  ];

  const apiIntegrations = [
    { key: 'openai_api_key', label: 'OpenAI API Key', isSecret: true },
    { key: 'deepgram_api_key', label: 'Deepgram API Key', isSecret: true },
    { key: 'sendgrid_api_key', label: 'SendGrid API Key', isSecret: true },
    { key: 'sendgrid_from_email', label: 'SendGrid From Email', isSecret: false },
    { key: 'elevenlabs_api_key', label: 'ElevenLabs API Key', isSecret: true },
  ];

  const paymentSettings = [
    { key: 'payments_enabled', label: 'Enable Payments', type: 'select', options: ['true', 'false'] },
    { key: 'stripe_api_key', label: 'Stripe API Key (Secret Key)', isSecret: true },
    { key: 'stripe_webhook_secret', label: 'Stripe Webhook Secret', isSecret: true },
  ];

  const calendarSettings = [
    { key: 'calendar_provider', label: 'Calendar Provider', type: 'select', options: ['google', 'outlook', 'apple', 'other'] },
    { key: 'calendar_ical_url', label: 'iCal URL', type: 'text' },
  ];

  const secretarySettings = [
    { key: 'secretary_email', label: 'Secretary Email', type: 'email' },
    { key: 'daily_summary_time', label: 'Daily Summary Time', type: 'time', placeholder: 'HH:MM (24-hour format)' },
  ];

  const reminderSettings = [
    { key: 'whatsapp_reminders_enabled', label: 'Enable WhatsApp Reminders', type: 'select', options: ['true', 'false'] },
    { key: 'whatsapp_reminder_timing', label: 'WhatsApp Reminder Timing (hours before, comma-separated)', type: 'text', placeholder: '24,2' },
    { key: 'email_reminders_enabled', label: 'Enable Email Reminders', type: 'select', options: ['true', 'false'] },
    { key: 'email_reminder_timing', label: 'Email Reminder Timing (hours before, comma-separated)', type: 'text', placeholder: '48,24' },
  ];

  const renderSettingField = (config: any) => {
    const setting = getSetting(config.key);
    const isEditing = editingKey === config.key;

    return (
      <div key={config.key} className="border-b border-gray-100 pb-4 last:border-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {config.label}
            </label>
            {isEditing ? (
              config.type === 'select' ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {config.label}</option>
                  {config.options?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={config.isSecret ? 'password' : (config.type || 'text')}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={config.placeholder || `Enter ${config.label}`}
                />
              )
            ) : (
              <p className="text-sm text-gray-500">
                {config.isSecret ? (setting?.value ? '••••••••••••' : 'Not set') : (setting?.value || 'Not set')}
              </p>
            )}
          </div>
          <div className="ml-4">
            {isEditing ? (
              <button
                onClick={() => handleSave(config.key, config.isSecret || false)}
                disabled={updateSettingMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            ) : (
              <button
                onClick={() => handleEdit(config.key, setting?.value || '')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {botEnabled && !whatsappStatus?.connected && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-900 mb-1">Bot Enabled but WhatsApp Disconnected</h4>
                  <p className="text-sm text-red-700">
                    The bot is configured as enabled, but WhatsApp is not connected. The bot cannot respond to messages until you reconnect WhatsApp below.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                botEnabled ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Bot className={`w-6 h-6 ${botEnabled ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bot Control</h3>
                <p className="text-sm text-gray-500">
                  Bot is currently {botEnabled ? 'enabled' : 'disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!botEnabled && !whatsappStatus?.connected) {
                  toast.error('Cannot enable bot - WhatsApp is not connected. Please connect WhatsApp first.');
                  return;
                }
                toggleBotMutation.mutate();
              }}
              disabled={toggleBotMutation.isPending || (!botEnabled && !whatsappStatus?.connected)}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                botEnabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <Power className="w-5 h-5" />
              {botEnabled ? 'Disable Bot' : 'Enable Bot'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">WhatsApp Connection</h2>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${
              whatsappStatus?.connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-gray-700">
              {whatsappStatus?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => connectWhatsAppMutation.mutate()}
              disabled={connectWhatsAppMutation.isPending || whatsappStatus?.connected}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
            <button
              onClick={() => disconnectWhatsAppMutation.mutate()}
              disabled={disconnectWhatsAppMutation.isPending || !whatsappStatus?.connected}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect
            </button>
          </div>

        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Bot Settings</h2>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Default Bot Language:</strong> The language the bot will use when chatting with new customers. 
              Customers can request a language change, which will be stored in their profile.
            </p>
          </div>
          
          <div className="space-y-4">
            {botSettings.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">API Integrations</h2>
          </div>
          
          <div className="space-y-4">
            {apiIntegrations.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-6 h-6 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900">Payment Settings (Stripe)</h2>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Enable payments to allow customers to pay for bookings, deposits, and penalties via Stripe. 
              You'll need a Stripe account to get your API keys. Get them from: <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a>
            </p>
            <p className="text-sm text-yellow-800 mt-2">
              <strong>Webhook Secret:</strong> Required for production security. Set it up in Stripe Dashboard → Webhooks → Add endpoint. 
              Endpoint URL: <code className="bg-yellow-100 px-2 py-1 rounded">https://your-domain.com/api/payments/webhook</code>
            </p>
          </div>

          <div className="space-y-4">
            {paymentSettings.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Calendar Settings</h2>
              {calendarStatus?.connected && (
                <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              )}
            </div>
            {calendarStatus?.connected ? (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to disconnect Google Calendar?')) {
                    disconnectCalendarMutation.mutate();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Disconnect Calendar
              </button>
            ) : (
              <button
                onClick={() => {
                  const calendarProvider = getSetting('calendar_provider')?.value || 'google';
                  if (calendarProvider === 'google') {
                    window.location.href = '/api/calendar/oauth/connect';
                  } else {
                    toast.error('Only Google Calendar OAuth is currently supported');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Connect Calendar
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {calendarSettings.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Secretary & Policy Settings</h2>
          </div>
          
          <div className="space-y-4">
            {secretarySettings.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Reminder Settings</h2>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Configure when to send automated reminders for appointments. 
              Multiple timings can be set (comma-separated) for both WhatsApp and email reminders.
              For example: "48,24,2" will send reminders at 48 hours, 24 hours, and 2 hours before the appointment.
            </p>
          </div>

          <div className="space-y-4">
            {reminderSettings.map(renderSettingField)}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect WhatsApp</h3>
            
            {qrData?.qrCode ? (
              <div className="text-center">
                <p className="text-gray-600 mb-4">Scan this QR code with your WhatsApp mobile app:</p>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={qrData.qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                </div>
                <p className="text-sm text-gray-500 mt-4">Open WhatsApp → Settings → Linked Devices → Link a Device</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Generating QR code...</p>
              </div>
            )}

            <button
              onClick={() => setShowQrModal(false)}
              className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
};

export default Settings;
