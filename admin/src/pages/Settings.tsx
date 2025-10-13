import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../lib/api';
import type { Setting } from '../types';
import { Key, Bot, Smartphone, Calendar, Save, Power, User } from 'lucide-react';
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

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue || '');
  };

  const handleSave = (key: string, isSecret: boolean) => {
    updateSettingMutation.mutate({ key, value: editValue, isSecret });
  };

  const getSetting = (key: string) => settings?.find((s: Setting) => s.key === key);
  const botEnabled = getSetting('bot_enabled')?.value === 'true';

  const apiIntegrations = [
    { key: 'openai_api_key', label: 'OpenAI API Key', isSecret: true },
    { key: 'deepgram_api_key', label: 'Deepgram API Key', isSecret: true },
    { key: 'sendgrid_api_key', label: 'SendGrid API Key', isSecret: true },
    { key: 'sendgrid_from_email', label: 'SendGrid From Email', isSecret: false },
    { key: 'elevenlabs_api_key', label: 'ElevenLabs API Key', isSecret: true },
  ];

  const calendarSettings = [
    { key: 'calendar_provider', label: 'Calendar Provider', type: 'select', options: ['google', 'outlook', 'apple', 'other'] },
    { key: 'calendar_ical_url', label: 'iCal URL', type: 'text' },
  ];

  const secretarySettings = [
    { key: 'secretary_email', label: 'Secretary Email', type: 'email' },
    { key: 'daily_summary_time', label: 'Daily Summary Time', type: 'time', placeholder: 'HH:MM (24-hour format)' },
    { key: 'cancellation_policy_hours', label: 'Cancellation Policy (Hours)', type: 'number' },
    { key: 'cancellation_penalty_fee', label: 'Cancellation Penalty Fee ($)', type: 'number' },
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
              onClick={() => toggleBotMutation.mutate()}
              disabled={toggleBotMutation.isPending}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${
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
            <Key className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">API Integrations</h2>
          </div>
          
          <div className="space-y-4">
            {apiIntegrations.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Calendar Settings</h2>
          </div>
          
          <div className="space-y-4">
            {calendarSettings.map(renderSettingField)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Secretary & Policy Settings</h2>
          </div>
          
          <div className="space-y-4">
            {secretarySettings.map(renderSettingField)}
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
