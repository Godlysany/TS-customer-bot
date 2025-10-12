import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../lib/api';
import type { Setting } from '../types';
import { Key, Bot, Smartphone, Calendar, Save, Power } from 'lucide-react';

const Settings = () => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
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

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value, isSecret }: { key: string; value: string; isSecret: boolean }) =>
      settingsApi.update(key, value, isSecret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditingKey(null);
      setEditValue('');
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: () => settingsApi.toggleBot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = (key: string, isSecret: boolean) => {
    updateSettingMutation.mutate({ key, value: editValue, isSecret });
  };

  const botEnabled = settings?.find((s: Setting) => s.key === 'bot_enabled')?.value === 'true';

  const settingGroups = {
    integrations: settings?.filter((s: Setting) => s.category === 'integrations') || [],
    bot_control: settings?.filter((s: Setting) => s.category === 'bot_control') || [],
    calendar: settings?.filter((s: Setting) => s.category === 'calendar') || [],
  };

  return (
    <div className="p-8">
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
                <h3 className="text-lg font-semibold text-gray-900">Bot Status</h3>
                <p className="text-sm text-gray-500">
                  Bot is currently {botEnabled ? 'enabled' : 'disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleBotMutation.mutate()}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
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
          
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${
              whatsappStatus?.connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-gray-700">
              {whatsappStatus?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {whatsappStatus?.qrCode && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Scan this QR code with WhatsApp:</p>
              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                {whatsappStatus.qrCode}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">API Integrations</h2>
          </div>
          
          <div className="space-y-4">
            {settingGroups.integrations.map((setting: Setting) => (
              <div key={setting.key} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {setting.key.replace(/_/g, ' ').toUpperCase()}
                    </label>
                    {editingKey === setting.key ? (
                      <input
                        type={setting.isSecret ? 'password' : 'text'}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Enter ${setting.key.replace(/_/g, ' ')}`}
                      />
                    ) : (
                      <p className="text-sm text-gray-500">
                        {setting.isSecret ? '••••••••••••' : (setting.value || 'Not set')}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">
                    {editingKey === setting.key ? (
                      <button
                        onClick={() => handleSave(setting.key, setting.isSecret)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(setting.key, setting.value)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Calendar Settings</h2>
          </div>
          
          <div className="space-y-4">
            {settingGroups.calendar.map((setting: Setting) => (
              <div key={setting.key} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {setting.key.replace(/_/g, ' ').toUpperCase()}
                    </label>
                    {editingKey === setting.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Enter ${setting.key.replace(/_/g, ' ')}`}
                      />
                    ) : (
                      <p className="text-sm text-gray-500">
                        {setting.value || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">
                    {editingKey === setting.key ? (
                      <button
                        onClick={() => handleSave(setting.key, setting.isSecret)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(setting.key, setting.value)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
