import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botConfigApi } from '../../lib/api';
import { Save, Volume2, VolumeX, Mic } from 'lucide-react';
import toast from 'react-hot-toast';

const TTSConfigSection = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    ttsEnabled: false,
    ttsReplyMode: 'text_only',
    ttsProvider: 'elevenlabs',
    ttsVoiceId: '',
  });

  const { data: settings } = useQuery({
    queryKey: ['tts-settings'],
    queryFn: async () => {
      const res = await botConfigApi.getTTSSettings();
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ttsEnabled: settings.ttsEnabled || false,
        ttsReplyMode: settings.ttsReplyMode || 'text_only',
        ttsProvider: settings.ttsProvider || 'elevenlabs',
        ttsVoiceId: settings.ttsVoiceId || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await botConfigApi.saveTTSSettings(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
      toast.success('TTS settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save TTS settings');
    },
  });

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>🎙️ Text-to-Speech (TTS) Settings</strong> - Configure voice reply behavior. 
          Requires ElevenLabs API key (configured in Settings page). Customers can override per their preference.
        </p>
      </div>

      {/* TTS Enable Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
              {formData.ttsEnabled ? (
                <Volume2 className="w-5 h-5 text-green-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-400" />
              )}
              Enable Text-to-Speech
            </h3>
            <p className="text-sm text-gray-600">
              Allow bot to reply with voice messages (requires ElevenLabs API key)
            </p>
          </div>
          <input
            type="checkbox"
            checked={formData.ttsEnabled}
            onChange={(e) => setFormData({ ...formData, ttsEnabled: e.target.checked })}
            className="w-6 h-6"
          />
        </label>
      </div>

      {/* TTS Reply Mode */}
      {formData.ttsEnabled && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-600" />
            Reply Mode
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            Choose how the bot should respond to messages:
          </p>

          <div className="space-y-3">
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="ttsReplyMode"
                value="text_only"
                checked={formData.ttsReplyMode === 'text_only'}
                onChange={(e) => setFormData({ ...formData, ttsReplyMode: e.target.value as any })}
                className="w-4 h-4 text-blue-600"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Text Only (Default)</p>
                <p className="text-sm text-gray-600">
                  Bot always replies with text messages, never voice
                </p>
              </div>
            </label>

            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="ttsReplyMode"
                value="voice_only"
                checked={formData.ttsReplyMode === 'voice_only'}
                onChange={(e) => setFormData({ ...formData, ttsReplyMode: e.target.value as any })}
                className="w-4 h-4 text-blue-600"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Voice Only</p>
                <p className="text-sm text-gray-600">
                  Bot always replies with voice messages (falls back to text if TTS fails)
                </p>
              </div>
            </label>

            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="ttsReplyMode"
                value="voice_on_voice"
                checked={formData.ttsReplyMode === 'voice_on_voice'}
                onChange={(e) => setFormData({ ...formData, ttsReplyMode: e.target.value as any })}
                className="w-4 h-4 text-blue-600"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Voice on Voice (Recommended)</p>
                <p className="text-sm text-gray-600">
                  Bot replies with voice when customer sends voice, text otherwise
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Voice Configuration */}
      {formData.ttsEnabled && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TTS Provider
              </label>
              <select
                value={formData.ttsProvider}
                onChange={(e) => setFormData({ ...formData, ttsProvider: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="elevenlabs">ElevenLabs (Recommended)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Currently only ElevenLabs is supported
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice ID (Optional)
              </label>
              <input
                type="text"
                value={formData.ttsVoiceId}
                onChange={(e) => setFormData({ ...formData, ttsVoiceId: e.target.value })}
                placeholder="Leave empty for default voice"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find voice IDs in your ElevenLabs dashboard. Default uses multilingual voice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Overrides Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>ℹ️ Customer Preferences:</strong> Individual customers can override these settings 
          (e.g., request text-only even if voice is enabled). Customer preferences take priority over global settings.
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
          {saveMutation.isPending ? 'Saving...' : 'Save TTS Settings'}
        </button>
      </div>
    </div>
  );
};

export default TTSConfigSection;
