import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, AlertTriangle, Trash2, Plus, TestTube } from 'lucide-react';
import toast from 'react-hot-toast';

const EscalationConfigSection = () => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<any>({
    mode: 'sentiment_and_keyword',
    enabled: true,
    triggers: {
      keywords: [],
      sentiment_threshold: -0.3,
    },
    behavior: {
      escalation_message: "I understand this is important. Let me connect you with our team right away.",
      notify_agents: true,
      pause_bot: true,
    },
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      const escalationSetting = settings.find((s: any) => s.key === 'escalation_config');
      if (escalationSetting?.value) {
        try {
          const parsed = typeof escalationSetting.value === 'string' 
            ? JSON.parse(escalationSetting.value)
            : escalationSetting.value;
          setConfig(parsed);
        } catch (e) {
          console.error('Failed to parse escalation config:', e);
        }
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      await settingsApi.update('escalation_config', JSON.stringify(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Escalation configuration saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save escalation configuration');
    },
  });

  const addKeyword = () => {
    if (newKeyword && !config.triggers.keywords.includes(newKeyword.toLowerCase())) {
      setConfig({
        ...config,
        triggers: {
          ...config.triggers,
          keywords: [...config.triggers.keywords, newKeyword.toLowerCase()],
        },
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig({
      ...config,
      triggers: {
        ...config.triggers,
        keywords: config.triggers.keywords.filter((k: string) => k !== keyword),
      },
    });
  };

  const testEscalation = () => {
    // Simulate escalation logic
    const shouldEscalate = config.triggers.keywords.some((keyword: string) =>
      testMessage.toLowerCase().includes(keyword)
    );
    setTestResult({
      shouldEscalate,
      reason: shouldEscalate
        ? `Trigger keyword detected: "${config.triggers.keywords.find((k: string) => testMessage.toLowerCase().includes(k))}"`
        : 'No trigger conditions met',
      mode: config.mode,
    });
  };

  const modes = [
    {
      id: 'sentiment_and_keyword',
      name: 'Sentiment AND Keyword',
      description: 'Escalate if EITHER negative sentiment OR trigger keyword detected (Recommended)',
    },
    {
      id: 'keyword_only',
      name: 'Keyword Only',
      description: 'Escalate ONLY when trigger keywords detected. Ignore sentiment.',
    },
    {
      id: 'sentiment_only',
      name: 'Sentiment Only',
      description: 'Escalate ONLY when sentiment drops below threshold. Ignore keywords.',
    },
    {
      id: 'sentiment_then_keyword',
      name: 'Sentiment THEN Keyword',
      description: 'Escalate ONLY when BOTH negative sentiment AND keyword detected (Conservative)',
    },
    {
      id: 'manual_only',
      name: 'Manual Only',
      description: 'Never auto-escalate. Agents manually flag conversations.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>⚠️ Escalation Rules</strong> determine when the bot should hand over to a human agent. 
          Configure when automatic escalation happens based on sentiment analysis and trigger keywords.
        </p>
      </div>

      {/* Escalation Mode Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Escalation Mode
        </h3>

        <div className="space-y-3">
          {modes.map((mode) => (
            <label
              key={mode.id}
              className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                config.mode === mode.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="escalation_mode"
                value={mode.id}
                checked={config.mode === mode.id}
                onChange={(e) => setConfig({ ...config, mode: e.target.value })}
                className="mt-1"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">{mode.name}</p>
                <p className="text-sm text-gray-600">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Trigger Keywords */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trigger Keywords</h3>
        <p className="text-sm text-gray-600 mb-4">
          Keywords or phrases that trigger escalation (used in keyword-based modes)
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {config.triggers.keywords.map((keyword: string) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="hover:text-red-900"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="e.g., complaint, refund, angry, terrible"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addKeyword}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Sentiment Threshold */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Threshold</h3>
        <p className="text-sm text-gray-600 mb-4">
          Escalate when customer sentiment drops below this value (-1.0 = very negative, 0.0 = neutral)
        </p>

        <div className="space-y-3">
          <input
            type="range"
            min="-1"
            max="0"
            step="0.1"
            value={config.triggers.sentiment_threshold}
            onChange={(e) =>
              setConfig({
                ...config,
                triggers: { ...config.triggers, sentiment_threshold: parseFloat(e.target.value) },
              })
            }
            className="w-full"
          />
          <div className="flex justify-between text-sm">
            <span>Very Negative (-1.0)</span>
            <span className="font-semibold text-blue-600">
              Current: {config.triggers.sentiment_threshold.toFixed(1)}
            </span>
            <span>Neutral (0.0)</span>
          </div>
        </div>
      </div>

      {/* Escalation Behavior */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Escalation Behavior</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escalation Message (Sent to Customer)
            </label>
            <textarea
              value={config.behavior.escalation_message}
              onChange={(e) =>
                setConfig({
                  ...config,
                  behavior: { ...config.behavior, escalation_message: e.target.value },
                })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.behavior.notify_agents}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    behavior: { ...config.behavior, notify_agents: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Notify agents when escalated</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.behavior.pause_bot}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    behavior: { ...config.behavior, pause_bot: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              <div>
                <span className="text-sm text-gray-700">Pause bot for this customer after escalation</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  (Per-conversation pause - bot stops replying to this specific customer until escalation is resolved)
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Test Harness */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TestTube className="w-5 h-5 text-purple-600" />
          Test Escalation Logic
        </h3>

        <div className="space-y-3">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter a test message to see if it would trigger escalation..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={testEscalation}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Test
          </button>

          {testResult && (
            <div
              className={`p-4 rounded-lg ${
                testResult.shouldEscalate ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}
            >
              <p className={`font-semibold ${testResult.shouldEscalate ? 'text-red-900' : 'text-green-900'}`}>
                {testResult.shouldEscalate ? '🚨 Would Escalate' : '✅ No Escalation'}
              </p>
              <p className="text-sm mt-1 text-gray-700">Reason: {testResult.reason}</p>
              <p className="text-xs mt-1 text-gray-500">Mode: {testResult.mode}</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(config)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Escalation Configuration'}
        </button>
      </div>
    </div>
  );
};

export default EscalationConfigSection;
