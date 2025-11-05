import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Shield, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const AdvancedControlsSection = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    // Feature Toggles
    enable_auto_response: true,
    enable_booking: true,
    enable_questionnaires: true,
    enable_promotions: true,
    enable_campaigns: true,
    enable_birthday_wishes: true,
    enable_testimonials: true,
    enable_service_documents: true,
    enable_recurring_reminders: true,
    enable_payment_links: true,
    enable_crm_extraction: true,
    enable_multi_session_booking: true,
    
    // Safety Safeguards
    confidence_threshold: 0.7,
    require_approval_low_confidence: true,
    frustration_approval_threshold: 0.8,
    sentiment_approval_threshold: -0.6,
    max_auto_discount_chf: 20,
    fallback_message: '',
    escalate_on_uncertainty: true,
    
    // Response Controls
    max_response_length: 500,
    response_delay_ms: 1000,
    enable_typing_indicator: true,
    
    // Brand Protection
    block_inappropriate_requests: true,
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
      const getSetting = (key: string, defaultValue: any = '') => {
        const setting = settings.find((s: any) => s.key === key);
        if (!setting?.value) return defaultValue;
        
        // Handle boolean values
        if (typeof defaultValue === 'boolean') {
          return setting.value === 'true' || setting.value === true;
        }
        
        // Handle numbers
        if (typeof defaultValue === 'number') {
          return parseFloat(setting.value) || defaultValue;
        }
        
        return setting.value;
      };

      setFormData({
        enable_auto_response: getSetting('enable_auto_response', true),
        enable_booking: getSetting('enable_booking', true),
        enable_questionnaires: getSetting('enable_questionnaires', true),
        enable_promotions: getSetting('enable_promotions', true),
        enable_campaigns: getSetting('enable_campaigns', true),
        enable_birthday_wishes: getSetting('enable_birthday_wishes', true),
        enable_testimonials: getSetting('enable_testimonials', true),
        enable_service_documents: getSetting('enable_service_documents', true),
        enable_recurring_reminders: getSetting('enable_recurring_reminders', true),
        enable_payment_links: getSetting('enable_payment_links', true),
        enable_crm_extraction: getSetting('enable_crm_extraction', true),
        enable_multi_session_booking: getSetting('enable_multi_session_booking', true),
        
        confidence_threshold: getSetting('confidence_threshold', 0.7),
        require_approval_low_confidence: getSetting('require_approval_low_confidence', true),
        frustration_approval_threshold: getSetting('frustration_approval_threshold', 0.8),
        sentiment_approval_threshold: getSetting('sentiment_approval_threshold', -0.6),
        max_auto_discount_chf: getSetting('max_auto_discount_chf', 20),
        fallback_message: getSetting('fallback_message', 
          "I'm not entirely sure I understood that correctly. Let me connect you with our team who can help you better."),
        escalate_on_uncertainty: getSetting('escalate_on_uncertainty', true),
        
        max_response_length: getSetting('max_response_length', 500),
        response_delay_ms: getSetting('response_delay_ms', 1000),
        enable_typing_indicator: getSetting('enable_typing_indicator', true),
        
        block_inappropriate_requests: getSetting('block_inappropriate_requests', true),
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
      toast.success('Advanced controls saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save advanced controls');
    },
  });

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>⚠️ Advanced Controls</strong> - These settings control which features are enabled 
          and configure safety guardrails to protect your brand and ensure quality interactions.
        </p>
      </div>

      {/* Feature Toggles */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-600" />
          Feature Toggles
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Enable or disable specific bot capabilities. Disabled features will not be accessible to customers.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Auto-Response</p>
              <p className="text-sm text-gray-600">Bot responds to messages automatically</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_auto_response}
              onChange={(e) => setFormData({ ...formData, enable_auto_response: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Booking System</p>
              <p className="text-sm text-gray-600">Allow appointment bookings via bot</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_booking}
              onChange={(e) => setFormData({ ...formData, enable_booking: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Questionnaires</p>
              <p className="text-sm text-gray-600">Collect data via questionnaires</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_questionnaires}
              onChange={(e) => setFormData({ ...formData, enable_questionnaires: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Promotions</p>
              <p className="text-sm text-gray-600">Offer discounts and promotions</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_promotions}
              onChange={(e) => setFormData({ ...formData, enable_promotions: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Campaigns</p>
              <p className="text-sm text-gray-600">Send marketing campaigns to customers</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_campaigns}
              onChange={(e) => setFormData({ ...formData, enable_campaigns: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Birthday Wishes</p>
              <p className="text-sm text-gray-600">Automated birthday messages with promotions</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_birthday_wishes}
              onChange={(e) => setFormData({ ...formData, enable_birthday_wishes: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Testimonials</p>
              <p className="text-sm text-gray-600">Request and manage customer testimonials</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_testimonials}
              onChange={(e) => setFormData({ ...formData, enable_testimonials: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Service Documents</p>
              <p className="text-sm text-gray-600">Deliver documents at specific booking stages</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_service_documents}
              onChange={(e) => setFormData({ ...formData, enable_service_documents: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Recurring Reminders</p>
              <p className="text-sm text-gray-600">Remind customers about recurring services</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_recurring_reminders}
              onChange={(e) => setFormData({ ...formData, enable_recurring_reminders: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Payment Links</p>
              <p className="text-sm text-gray-600">Generate Stripe payment links</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_payment_links}
              onChange={(e) => setFormData({ ...formData, enable_payment_links: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">CRM Data Extraction</p>
              <p className="text-sm text-gray-600">Auto-extract preferences from conversations</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_crm_extraction}
              onChange={(e) => setFormData({ ...formData, enable_crm_extraction: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div>
              <p className="font-medium text-gray-900">Multi-Session Booking</p>
              <p className="text-sm text-gray-600">Handle services requiring multiple appointments</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_multi_session_booking}
              onChange={(e) => setFormData({ ...formData, enable_multi_session_booking: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* Safety Safeguards */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-600" />
          Safety Safeguards
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Configure quality controls and safety measures to ensure reliable bot behavior.
        </p>

        <div className="space-y-4">
          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Threshold (AI Response Quality)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.confidence_threshold}
                onChange={(e) =>
                  setFormData({ ...formData, confidence_threshold: parseFloat(e.target.value) })
                }
                className="flex-1"
              />
              <span className="font-semibold text-blue-600 min-w-[60px]">
                {(formData.confidence_threshold * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Bot will escalate if confidence drops below this threshold. Higher = stricter quality control.
            </p>
          </div>

          {/* Low Confidence Approval */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.require_approval_low_confidence}
              onChange={(e) =>
                setFormData({ ...formData, require_approval_low_confidence: e.target.checked })
              }
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Require approval for low-confidence responses</span>
              <p className="text-xs text-gray-500">
                Bot will ask agent to review messages before sending if confidence is low, frustration is high, or sentiment is negative
              </p>
            </div>
          </label>

          {/* Frustration Approval Threshold - Only visible if approval is enabled */}
          {formData.require_approval_low_confidence && (
            <div className="ml-6 border-l-2 border-orange-300 pl-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frustration Approval Threshold (Brand Protection)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.frustration_approval_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, frustration_approval_threshold: parseFloat(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="font-semibold text-orange-600 min-w-[60px]">
                    {(formData.frustration_approval_threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Require approval when customer frustration exceeds this level (Default: 80%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Negative Sentiment Approval Threshold
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="-1"
                    max="0"
                    step="0.1"
                    value={formData.sentiment_approval_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, sentiment_approval_threshold: parseFloat(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="font-semibold text-red-600 min-w-[60px]">
                    {formData.sentiment_approval_threshold.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Require approval when sentiment score drops below this value (Default: -0.6, Range: -1.0 to 0)
                </p>
              </div>
            </div>
          )}

          {/* Escalate on Uncertainty */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.escalate_on_uncertainty}
              onChange={(e) =>
                setFormData({ ...formData, escalate_on_uncertainty: e.target.checked })
              }
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Auto-escalate when uncertain</span>
              <p className="text-xs text-gray-500">
                If bot doesn't understand the request, escalate to human instead of guessing
              </p>
            </div>
          </label>

          {/* Max Auto Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Auto-Discount (CHF)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={formData.max_auto_discount_chf}
                onChange={(e) =>
                  setFormData({ ...formData, max_auto_discount_chf: parseFloat(e.target.value) })
                }
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">CHF</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Bot can autonomously offer discounts up to this amount. Higher values require agent approval.
            </p>
          </div>

          {/* Fallback Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fallback Message (When Bot is Uncertain)
            </label>
            <textarea
              value={formData.fallback_message}
              onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
              rows={3}
              placeholder="I'm not entirely sure I understood that correctly. Let me connect you with our team who can help you better."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sent when bot confidence is low or request is unclear
            </p>
          </div>
        </div>
      </div>

      {/* Response Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-purple-600" />
          Response Controls
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Response Length (characters)
            </label>
            <input
              type="number"
              min="100"
              max="2000"
              step="50"
              value={formData.max_response_length}
              onChange={(e) =>
                setFormData({ ...formData, max_response_length: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Keep responses concise for better readability
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Delay (milliseconds)
            </label>
            <input
              type="number"
              min="0"
              max="5000"
              step="500"
              value={formData.response_delay_ms}
              onChange={(e) =>
                setFormData({ ...formData, response_delay_ms: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Delay before sending (makes bot feel more human)
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enable_typing_indicator}
              onChange={(e) =>
                setFormData({ ...formData, enable_typing_indicator: e.target.checked })
              }
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Show typing indicator</span>
              <p className="text-xs text-gray-500">
                Display "typing..." while bot is preparing response (more natural conversation flow)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Brand Protection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Brand Protection
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.block_inappropriate_requests}
              onChange={(e) =>
                setFormData({ ...formData, block_inappropriate_requests: e.target.checked })
              }
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Block inappropriate requests</span>
              <p className="text-xs text-gray-500">
                Automatically detect and decline inappropriate or off-topic requests
              </p>
            </div>
          </label>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>ℹ️ Note:</strong> Escalation trigger keywords are configured in the "Escalation Rules" tab above.
            </p>
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">
          <strong>⚠️ Important:</strong> Disabling core features (auto-response, booking) may significantly 
          reduce bot functionality. Changes take effect immediately for all conversations.
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
          {saveMutation.isPending ? 'Saving...' : 'Save Advanced Controls'}
        </button>
      </div>
    </div>
  );
};

export default AdvancedControlsSection;
